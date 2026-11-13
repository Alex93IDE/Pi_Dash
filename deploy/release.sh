#!/bin/bash
# Bump the version, commit and tag it: bash deploy/release.sh patch|minor|major
# npm version does the bump, commit and tag, the same on macOS and Linux.
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PART="$1"
cd "$ROOT"

if [[ "$PART" != "patch" && "$PART" != "minor" && "$PART" != "major" ]]; then
    echo "Usage: bash deploy/release.sh patch|minor|major"
    exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then
    echo "You are on '$BRANCH'. Releases are made from main."
    exit 1
fi

# Refuses on a dirty tree by itself.
NEW="$(npm version "$PART" -m "%s")"
echo "==> Created commit and tag $NEW"

echo ""
read -r -p "Push to origin now? [y/N] " ANSWER
if [[ "$ANSWER" =~ ^[yY]$ ]]; then
    git push origin main
    git push origin "$NEW"
else
    echo "Not pushed. When ready: git push origin main && git push origin $NEW"
fi
