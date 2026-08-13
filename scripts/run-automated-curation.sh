#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CURATION_DATE="${CURATION_DATE:-$(TZ=Asia/Kolkata date +%F)}"
NOTE_PATH="data/curation/${CURATION_DATE:0:4}/${CURATION_DATE:5:2}/${CURATION_DATE:8:2}.md"

write_output() {
  local name="$1"
  local value="$2"
  [[ -n "${GITHUB_OUTPUT:-}" ]] && printf '%s=%s\n' "$name" "$value" >>"$GITHUB_OUTPUT"
}

cd "$ROOT_DIR"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "The automation checkout is not clean." >&2
  exit 1
fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git fetch --no-tags origin \
  '+refs/heads/main:refs/remotes/origin/main' \
  '+refs/heads/Noir:refs/remotes/origin/Noir'
git checkout Noir
git merge --ff-only origin/Noir
git merge --no-edit origin/main

if [[ -f "$NOTE_PATH" ]] && grep -q '^status: published$' "$NOTE_PATH"; then
  echo "$CURATION_DATE is already published."
  write_output has_note false
  exit 0
fi

if [[ ! -f "$NOTE_PATH" ]]; then
  "$SCRIPT_DIR/ensure-ollama.sh"
  corepack pnpm curation:doctor
  corepack pnpm curation:daily -- --date "$CURATION_DATE"
fi

if [[ ! -f "$NOTE_PATH" ]]; then
  echo "No suitable evidence was available for $CURATION_DATE."
  write_output has_note false
  exit 0
fi

corepack pnpm curation:validate
corepack pnpm check

git add -- "$NOTE_PATH"
if ! git diff --cached --quiet; then
  git commit -m "curation: propose AI briefing for $CURATION_DATE"
fi

git push origin HEAD:Noir
write_output has_note true
write_output note_date "$CURATION_DATE"
write_output note_path "$NOTE_PATH"
