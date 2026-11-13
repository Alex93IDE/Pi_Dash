// Collects on a schedule, keeps the latest of each payload, and pushes it to
// every open browser over Server-Sent Events.
import type { Response } from "express";
import type { StreamEvents } from "../../shared/types.ts";

type Topic = Exclude<keyof StreamEvents, "hello">;

/**
 * One payload on its own clock. Each runs independently, so a slow collector
 * (smartctl, systemctl) can't hold up the once-a-second metrics. The schedule
 * is fixed rather than "sleep after work", so the interval doesn't creep by
 * however long the collection took.
 */
export class Publisher<T extends Topic> {
  readonly topic: T;
  private every: number;
  private collect: () => Promise<StreamEvents[T]>;
  private hub: Hub;
  private timer: NodeJS.Timeout | undefined;
  private next = 0;
  private running = false;
  private again = false;
  private stopped = false;

  constructor(hub: Hub, topic: T, every: number, collect: () => Promise<StreamEvents[T]>) {
    this.hub = hub;
    this.topic = topic;
    this.every = every;
    this.collect = collect;
  }

  start(): void {
    this.next = performance.now();
    void this.tick();
  }

  stop(): void {
    this.stopped = true;
    clearTimeout(this.timer);
  }

  /** Publish now instead of waiting for the next tick (after an action). */
  trigger(): void {
    if (this.running) this.again = true;
    else void this.run();
  }

  private async tick(): Promise<void> {
    await this.run();
    if (this.stopped) return;
    this.next += this.every;
    // Fell more than a whole interval behind (suspend, a very slow
    // collector): skip the missed ticks instead of bursting.
    const now = performance.now();
    if (this.next < now) this.next = now + this.every;
    this.timer = setTimeout(() => void this.tick(), this.next - now);
  }

  private async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      do {
        this.again = false;
        this.hub.publish(this.topic, await this.collect());
      } while (this.again && !this.stopped);
    } catch (e) {
      // One bad tick shouldn't stop the publisher.
      console.error(`[${this.topic}] collect failed:`, e);
    } finally {
      this.running = false;
    }
  }
}

export class Hub {
  private latest: Partial<StreamEvents> = {};
  private clients = new Set<Response>();
  private hello: () => StreamEvents["hello"];
  private listeners: { [K in Topic]?: ((data: StreamEvents[K]) => void)[] } = {};

  constructor(hello: () => StreamEvents["hello"]) {
    this.hello = hello;
  }

  get<T extends Topic>(topic: T): StreamEvents[T] | undefined {
    return this.latest[topic] as StreamEvents[T] | undefined;
  }

  on<T extends Topic>(topic: T, fn: (data: StreamEvents[T]) => void): void {
    ((this.listeners[topic] ??= []) as ((data: StreamEvents[T]) => void)[]).push(fn);
  }

  publish<T extends Topic>(topic: T, data: StreamEvents[T]): void {
    this.latest[topic] = data;
    for (const fn of (this.listeners[topic] ?? []) as ((d: StreamEvents[T]) => void)[]) fn(data);
    const frame = `event: ${topic}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of this.clients) res.write(frame);
  }

  /** Attach a browser: hello, then the latest of everything, then live. */
  subscribe(res: Response): void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // nginx in front: don't buffer the stream.
      "X-Accel-Buffering": "no",
    });
    // How long the browser waits before reconnecting after a drop.
    res.write(`retry: 3000\n\n`);
    res.write(`event: hello\ndata: ${JSON.stringify(this.hello())}\n\n`);
    for (const [topic, data] of Object.entries(this.latest)) {
      res.write(`event: ${topic}\ndata: ${JSON.stringify(data)}\n\n`);
    }
    this.clients.add(res);
    res.on("close", () => this.clients.delete(res));
  }

  /** A comment line every so often keeps proxies from closing an idle stream. */
  keepAlive(): void {
    for (const res of this.clients) res.write(": ping\n\n");
  }

  closeAll(): void {
    for (const res of this.clients) res.end();
    this.clients.clear();
  }
}
