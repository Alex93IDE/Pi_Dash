#!/bin/bash
# Pull the latest version and apply it: bash deploy/update.sh
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Pulling..."
git pull --ff-only

echo "==> Installing dependencies and building..."
npm ci
npm run build

echo "==> Restarting service..."
sudo systemctl restart pi-dash

echo ""
sudo systemctl status pi-dash --no-pager
