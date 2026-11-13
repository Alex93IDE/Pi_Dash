#!/bin/bash
# Removes the service and its system config. The repo and data/ (history,
# favorites, apps) are left alone.
set -e

SERVICE_NAME="pi-dash"

echo "==> Stopping and disabling service..."
sudo systemctl stop $SERVICE_NAME 2>/dev/null || true
sudo systemctl disable $SERVICE_NAME 2>/dev/null || true

echo "==> Removing system config..."
sudo rm -f /etc/systemd/system/$SERVICE_NAME.service
sudo rm -f /etc/sudoers.d/$SERVICE_NAME
sudo rm -f /etc/polkit-1/rules.d/50-$SERVICE_NAME.rules
sudo systemctl daemon-reload

echo ""
echo "==> Done. The repo and data/ were left untouched."
echo "    To reinstall: bash deploy/install.sh"
