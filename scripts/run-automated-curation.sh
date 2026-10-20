#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CURATION_DATE="${CURATION_DATE:-$(TZ=Asia/Kolkata date +%F)}"
NOTE_PATH="data/curation/${CURATION_DATE:0:4}/${CURATION_DATE:5:2}/${CURATION_DATE:8:2}.md"
DAILY_BRANCH="${NOIR_DAILY_BRIEFING_BRANCH:-noir-daily-briefings}"

write_output() {
  local name="$1"
  local value="$2"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    printf '%s=%s\n' "$name" "$value" >>"$GITHUB_OUTPUT"
  fi
}

log() {
  printf '[%s] %s\n' "$(TZ=Asia/Kolkata date '+%Y-%m-%dT%H:%M:%S%z')" "$*"
}

cd "$ROOT_DIR"
log "START daily curation for $CURATION_DATE"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "The automation checkout is not clean." >&2
  exit 1
fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git fetch --no-tags origin '+refs/heads/main:refs/remotes/origin/main'
if git ls-remote --exit-code --heads origin "$DAILY_BRANCH" >/dev/null; then
  git fetch --no-tags origin \
    "+refs/heads/$DAILY_BRANCH:refs/remotes/origin/$DAILY_BRANCH"
fi

# A briefing branch represents one reviewable draft. If it contains an open
# draft, leave it untouched rather than adding a second day to the same PR.
# Otherwise rebuild it directly from main. This keeps the persistent clone
# from accumulating merge commits when a run fails before its push.
if git show-ref --verify --quiet "refs/remotes/origin/$DAILY_BRANCH"; then
  pending_note="$(git diff --name-only "origin/main...origin/$DAILY_BRANCH" -- 'data/curation/**/*.md' | sort | tail -1)"
  if [[ -n "$pending_note" ]] && git show "origin/$DAILY_BRANCH:$pending_note" | grep -q '^status: draft$'; then
    pending_date="$(git show "origin/$DAILY_BRANCH:$pending_note" | sed -n 's/^date: //p' | head -1)"
    if ! git cat-file -e "origin/main:$pending_note" 2>/dev/null || ! git show "origin/main:$pending_note" | grep -q '^status: published$'; then
      log "SKIP daily curation: draft $pending_date is awaiting review on $DAILY_BRANCH"
      write_output has_note false
      exit 0
    fi
  fi
fi

git checkout --detach origin/main
git switch -C "$DAILY_BRANCH" origin/main

# The automation clone persists between runs. Refresh dependencies after
# merging so newly added quality checks cannot fail only in this checkout.
corepack pnpm install --frozen-lockfile

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
  git commit -m "curation: prepare daily briefing for $CURATION_DATE"
fi

git push --force-with-lease="refs/heads/$DAILY_BRANCH" origin "HEAD:$DAILY_BRANCH"
log "PASS pushed $DAILY_BRANCH at $(git rev-parse --short HEAD)"
write_output has_note true
write_output note_date "$CURATION_DATE"
write_output note_path "$NOTE_PATH"
