# Pi Dash

A live dashboard for a Raspberry Pi 5 in a Pironman5 case — metrics, history, services, containers, firewall and case controls — in a single Node.js service.

It merges [Pi5_MQTT](https://github.com/Alex93IDE/Pi5_MQTT) and [Pi5_Dashboard](https://github.com/Alex93IDE/Pi5_Dashboard) into one: no broker, no Python daemon, nothing to keep in sync.

![The dashboard](docs/dashboard.png)

## Features

- **Live metrics** — CPU (per core, load, temperature, fan), RAM, disk and NVMe health, network throughput, WireGuard peers. Pushed every second over Server-Sent Events.
- **History** — one averaged sample per minute in SQLite, charted over 1 hour, 24 hours, 7 days or 30 days.
- **Services and Docker** — every systemd unit and container, searchable, with favorites. Start, stop and restart them from the browser. Containers show their live CPU and RAM, sortable to find the busy one.
- **Apps** — your own links to whatever else runs on the Pi (Keeper, WGDashboard…), with each app's own icon and a dot saying whether it's answering.
- **Power supply** — the Pi's input voltage and under-voltage / throttling, now and since boot (`vcgencmd`).
- **AdGuard Home** — queries, blocked share, response time and the most blocked domains, from its API.
- **Alerts** — failed units, stopped containers, apps down, under-voltage, AdGuard off, firewall down, hot or full hardware, with the count in the browser tab.
- **Telegram notifications** — the same alerts on your phone, once when they start and once when they're fixed.
- **UFW** rules, **Fail2ban** and **CrowdSec** ban counts.
- **Pironman5 controls** — OLED, RGB and fan mode.
- **Works on a phone** — responsive, swipe between tabs, installable as a PWA.

| History | Docker |
|---|---|
| ![Metrics history](docs/history.png) | ![Docker containers with CPU and RAM](docs/docker.png) |

| Services | Apps |
|---|---|
| ![systemd services](docs/services.png) | ![App links with status](docs/apps.png) |

| Firewall | Pironman |
|---|---|
| ![Firewall rules](docs/firewall.png) | ![Pironman controls](docs/pironman.png) |

| On a phone | |
|---|---|
| ![Home on a phone](docs/mobile.png) | ![Docker on a phone](docs/mobile-docker.png) |

Screenshots use mock data.

## How it works

```
Browser (Vue 3)  ◄── SSE: live data ──  Node.js server on the Pi (Express 5)
                 ── HTTP: commands ──►   reads /proc, systemctl, docker, smartctl,
                                         ufw, wg, the Pironman API; keeps SQLite
```

One process collects everything on a schedule, keeps the history and favorites in `data/pi-dash.db`, and serves both the API and the built dashboard.

```
server/   Express API, collectors, SQLite      (TypeScript, run directly by Node)
web/      the dashboard                        (Vue 3, Pinia, Vite, PWA)
shared/   types used by both sides
deploy/   install, update, uninstall and release scripts
```

## Requirements

- Raspberry Pi with a systemd-based distro (Raspberry Pi OS Bookworm or later)
- **Node.js 22.18+** (24 LTS recommended) — the server runs its TypeScript directly, and uses the built-in `node:sqlite`
- Optional: Pironman5 software, Docker, WireGuard, Fail2ban, CrowdSec, smartmontools. Anything missing just reports empty or zero values.

## Installation

On the Pi:

```bash
git clone https://github.com/Alex93IDE/Pi_Dash.git ~/pi-dash
cd ~/pi-dash
cp .env.example .env   # review it
bash deploy/install.sh
```

`install.sh` installs dependencies, builds the dashboard and sets up:

- a systemd service, `pi-dash`
- a sudoers rule for a few **read-only** commands (`ufw status`, `wg show`, `smartctl -A`, `fail2ban-client status`), only for the metrics enabled in `.env`
- with `UNIT_CONTROL=true`, a polkit rule letting the service user **start, stop and restart** systemd units — nothing else (no enable, mask or reboot)

Docker containers are listed and controlled through the `docker` group, and power is read through the `video` group; the script tells you if your user is missing either.

Then open `http://<pi-address>:3010`.

Update with `bash deploy/update.sh`. Remove with `bash deploy/uninstall.sh` (your `data/` is kept).

Logs: `journalctl -u pi-dash -f`

## Configuration

Everything lives in `.env` — see [`.env.example`](.env.example): port, intervals, history retention, which metrics to collect, and whether units can be controlled.

### Action PIN

Set `ACTION_PIN` to ask for a PIN before starting, stopping or restarting anything and before editing apps. Looking stays open; the PIN is asked once per browser tab. Five wrong tries lock actions for five minutes.

### AdGuard Home

Set `ADGUARD_URL` (e.g. `http://127.0.0.1:80`) plus the user and password you log into AdGuard with, and a card appears on Home. They stay in `.env`, on the Pi.

### Telegram notifications

1. In Telegram, talk to [@BotFather](https://t.me/BotFather), send `/newbot` and follow the steps. It gives you a token like `123456:ABC-DEF…` — that's `TELEGRAM_BOT_TOKEN`.
2. Open a chat with your new bot and send it anything (bots can't write to you first).
3. Open `https://api.telegram.org/bot<token>/getUpdates` in a browser and find `"chat":{"id":…}` — that number is `TELEGRAM_CHAT_ID`. For a group, add the bot to it and use the group's id (negative).
4. Put both in `.env` and run `bash deploy/install.sh` again (or `sudo systemctl restart pi-dash`). A **Telegram test** button appears on the Alerts card.

A problem has to last a minute before it's sent, and be gone a minute before "OK again" is, so a container restarting or a CPU spike stays quiet. What was sent is remembered in `data/`, so restarting the dashboard doesn't send it again. One message carries everything that changed at once.

The Pi can't tell you it's off. For that, watch it from somewhere else — Uptime Kuma on another machine, for instance.

### Apps

The **Apps** tab holds links to other things on the Pi. Use `{host}` in the URL, e.g. `http://{host}:10086`: it becomes whatever address you opened the dashboard on, so the same link works on the LAN, over the VPN or by hostname.

## Development

Works on macOS or Linux; off the Pi, Linux-only metrics just read as zero.

```bash
npm install
npm run dev        # server on :3010 + Vite on :5173 with hot reload
npm test           # server tests
npm run typecheck
npm run build      # web/dist, served by the server in production
```

Releases follow [SemVer](https://semver.org): `bash deploy/release.sh patch|minor|major` on a clean `main`. The version lives in the root `package.json` and shows in the footer.

## Security

**There is no login, by design.** Anyone who can open the page can see your machine (IPs, ports, services, containers) and, with `UNIT_CONTROL=true`, stop and start services. So:

- Keep it on your LAN or behind a VPN. Never expose the port to the internet.
- Set `HOST` to the LAN or VPN address to keep it off other interfaces.
- Set `ACTION_PIN` so that seeing the dashboard isn't enough to stop things, or `UNIT_CONTROL=false` if you only want to look.
- `PROTECTED_UNITS` can be restarted but never stopped — by default `ssh` and the dashboard itself, so you can't lock yourself out.

Cross-origin requests that change something are refused, so another web page open in your browser can't act on the Pi behind your back.

Nothing secret is stored in the repo or the built bundle: `.env` and `data/` are git-ignored. The Telegram token never leaves the server.

Telegram messages go out through Telegram's servers, so they carry what an alert says (unit, container and app names, temperatures) — nothing else.

## License

MIT — see [LICENSE](LICENSE).
