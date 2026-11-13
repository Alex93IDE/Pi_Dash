import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { checkUrl } from "../src/appStatus.ts";

test("checkUrl: up on any answer below 500, down otherwise", async () => {
  const server = createServer((req, res) => {
    res.statusCode = req.url === "/broken" ? 502 : req.url === "/login" ? 401 : 200;
    res.end("ok");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  try {
    assert.equal((await checkUrl(`http://{host}:${port}/`)).up, true);
    assert.equal((await checkUrl(`http://{host}:${port}/login`)).up, true);
    const broken = await checkUrl(`http://{host}:${port}/broken`);
    assert.deepEqual([broken.up, broken.error], [false, "HTTP 502"]);
  } finally {
    server.close();
  }
  // Nothing listens on port 1.
  const refused = await checkUrl("http://127.0.0.1:1/");
  assert.deepEqual([refused.up, refused.error], [false, "connection refused"]);
});
