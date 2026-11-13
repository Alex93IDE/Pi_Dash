#!/bin/bash
# First-time setup on the Pi. Run from the repo: bash deploy/install.sh
# Safe to run again after changing .env (it rewrites the system config).
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="pi-dash"
NODE="$(command -v node || true)"

echo "==> Directory: $ROOT"

if [ -z "$NODE" ]; then
    echo "Node.js not found. Install Node 22.18+ (24 LTS recommended) first."
    exit 1
fi
# Type stripping (running .ts directly) needs 22.18+.
if ! "$NODE" -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=18)?0:1)'; then
    echo "Node $("$NODE" -v) is too old. Pi Dash needs 22.18 or newer (24 LTS recommended)."
    exit 1
fi

echo ""
echo "==> Checking .env..."
if [ ! -f "$ROOT/.env" ]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
    echo "    Created .env from .env.example — review it, then run this again."
    exit 1
fi

# Read a single key out of .env without sourcing it. An empty value stays
# empty: that's how a metric is switched off.
env_get() {
    if grep -qE "^$1=" "$ROOT/.env"; then
        grep -E "^$1=" "$ROOT/.env" | tail -n1 | cut -d= -f2-
    else
        echo "$2"
    fi
}

echo ""
echo "==> Installing dependencies and building the dashboard..."
cd "$ROOT"
npm ci
npm run build

echo ""
echo "==> Setting up sudoers (read-only commands, no password)..."
WG_INTERFACE="$(env_get WG_INTERFACE wg0)"
NVME_DEVICE="$(env_get NVME_DEVICE /dev/nvme0)"
F2B_JAIL="$(env_get F2B_JAIL sshd)"
CS_ENABLE="$(env_get CS_ENABLE false)"

# Only grant what this host actually collects.
{
    echo "# Lets the $SERVICE_NAME service read these without a password"
    [ -n "$WG_INTERFACE" ] && echo "$USER ALL=(root) NOPASSWD: /usr/bin/wg show $WG_INTERFACE latest-handshakes"
    [ -n "$NVME_DEVICE" ]  && echo "$USER ALL=(root) NOPASSWD: /usr/sbin/smartctl -A $NVME_DEVICE"
    [ -n "$F2B_JAIL" ]     && echo "$USER ALL=(root) NOPASSWD: /usr/bin/fail2ban-client status $F2B_JAIL"
    [ "$CS_ENABLE" = "true" ] && echo "$USER ALL=(root) NOPASSWD: /usr/bin/cscli decisions list -o json"
    echo "$USER ALL=(root) NOPASSWD: /usr/sbin/ufw status numbered"
    true
} > /tmp/pi-dash.sudoers
sudo visudo -cf /tmp/pi-dash.sudoers > /dev/null
sudo install -m 440 -o root -g root /tmp/pi-dash.sudoers /etc/sudoers.d/$SERVICE_NAME
rm -f /tmp/pi-dash.sudoers
echo "    $(sudo grep -c NOPASSWD /etc/sudoers.d/$SERVICE_NAME) command(s) — see /etc/sudoers.d/$SERVICE_NAME"

echo ""
POLKIT_RULE="/etc/polkit-1/rules.d/50-$SERVICE_NAME.rules"
if [ "$(env_get UNIT_CONTROL true)" = "true" ]; then
    echo "==> Allowing $USER to start/stop/restart services (polkit)..."
    # Only these three verbs on systemd units — not enable, mask, reboot...
    sudo tee "$POLKIT_RULE" > /dev/null <<EOF
polkit.addRule(function (action, subject) {
    if (action.id == "org.freedesktop.systemd1.manage-units" && subject.user == "$USER") {
        var verb = action.lookup("verb");
        if (verb == "start" || verb == "stop" || verb == "restart") {
            return polkit.Result.YES;
        }
    }
});
EOF
    if command -v docker > /dev/null && ! id -nG "$USER" | grep -qw docker; then
        echo "    Note: $USER is not in the docker group, so containers can't be listed"
        echo "    or controlled. To allow it: sudo usermod -aG docker $USER (then log in again)."
    fi
else
    echo "==> UNIT_CONTROL=false: removing the polkit rule, if any..."
    sudo rm -f "$POLKIT_RULE"
fi

# vcgencmd (power supply / throttling) talks to the firmware through /dev/vcio.
if command -v vcgencmd > /dev/null && ! id -nG "$USER" | grep -qw video; then
    echo ""
    echo "    Note: $USER is not in the video group, so power and throttling"
    echo "    can't be read. To allow it: sudo usermod -aG video $USER"
fi

echo ""
echo "==> Creating systemd service..."
sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null <<EOF
[Unit]
Description=Pi Dash — Raspberry Pi dashboard
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$ROOT
ExecStart=$NODE $ROOT/server/src/index.ts
Environment=NODE_ENV=production
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl restart $SERVICE_NAME

echo ""
echo "==> Done! Open http://$(hostname -I | awk '{print $1}'):$(env_get PORT 3010)"
sudo systemctl status $SERVICE_NAME --no-pager
