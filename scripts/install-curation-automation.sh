#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LABEL="com.noir.ai-observatory-curation"
AGENT_FILE="$HOME/Library/LaunchAgents/$LABEL.plist"
COREPACK_PATH="$(command -v corepack || true)"

if [[ -z "$COREPACK_PATH" ]]; then
  echo "corepack is not available on PATH." >&2
  exit 1
fi

if [[ -n "$(git -C "$ROOT_DIR" status --porcelain)" ]]; then
  echo "Install from a clean dedicated automation clone." >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$ROOT_DIR/.noir"

sed \
  -e "s|__ROOT_DIR__|$ROOT_DIR|g" \
  "$ROOT_DIR/config/com.noir.ai-observatory-curation.plist.template" >"$AGENT_FILE"

launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$AGENT_FILE"
launchctl enable "gui/$(id -u)/$LABEL"

echo "Installed daily curation automation: $AGENT_FILE"
echo "It runs at 12:45 Asia/Kolkata while this Mac is available."
echo "Test now with: launchctl kickstart -k gui/$(id -u)/$LABEL"
