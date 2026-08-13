#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CURATION_DATE="$(date +%F)"
DRAFT_ONLY=false
OPEN_NOTE=true
PROVIDER=""
MODEL=""

usage() {
  cat <<'EOF'
Usage: corepack pnpm curation:run [-- --date YYYY-MM-DD] [options]

Options:
  --date YYYY-MM-DD   Curate a specific local date (default: today)
  --provider NAME     Use ollama or codex
  --model NAME        Override the configured model
  --draft-only        Generate the draft, then stop before review or Git
  --no-open           Do not open the draft automatically
  --help              Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --)
      shift
      ;;
    --date)
      CURATION_DATE="${2:-}"
      shift 2
      ;;
    --provider)
      PROVIDER="${2:-}"
      shift 2
      ;;
    --model)
      MODEL="${2:-}"
      shift 2
      ;;
    --draft-only)
      DRAFT_ONLY=true
      shift
      ;;
    --no-open)
      OPEN_NOTE=false
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ ! "$CURATION_DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "Date must use YYYY-MM-DD: $CURATION_DATE" >&2
  exit 2
fi

NOTE_PATH="data/curation/${CURATION_DATE:0:4}/${CURATION_DATE:5:2}/${CURATION_DATE:8:2}.md"
GENERATION_ARGS=(--date "$CURATION_DATE")
DOCTOR_ARGS=()
[[ -n "$PROVIDER" ]] && GENERATION_ARGS+=(--provider "$PROVIDER")
[[ -n "$MODEL" ]] && GENERATION_ARGS+=(--model "$MODEL")
[[ -n "$PROVIDER" ]] && DOCTOR_ARGS+=(--provider "$PROVIDER")
[[ -n "$MODEL" ]] && DOCTOR_ARGS+=(--model "$MODEL")

cd "$ROOT_DIR"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "The repository has uncommitted changes. Commit or stash them before starting the daily run." >&2
  exit 1
fi

echo "Updating Noir and merging the latest automated Observatory data from main..."
git switch Noir
git pull --ff-only origin Noir
git fetch origin main
git merge --no-edit origin/main

echo "Checking the local curation provider..."
if [[ "$PROVIDER" != "codex" ]]; then
  "$SCRIPT_DIR/ensure-ollama.sh"
fi
if [[ -n "$PROVIDER" || -n "$MODEL" ]]; then
  corepack pnpm curation:doctor -- "${DOCTOR_ARGS[@]}"
else
  corepack pnpm curation:doctor
fi

echo "Generating the $CURATION_DATE draft. Ollama may take a few minutes; this script will wait."
corepack pnpm curation:daily -- "${GENERATION_ARGS[@]}"

if [[ ! -f "$NOTE_PATH" ]]; then
  echo "No note was created because no suitable recent evidence was available."
  exit 0
fi

corepack pnpm curation:status -- --date "$CURATION_DATE"

if [[ "$OPEN_NOTE" == true ]]; then
  if command -v open >/dev/null 2>&1; then
    open "$NOTE_PATH"
  else
    echo "Open and review: $NOTE_PATH"
  fi
else
  echo "Review: $NOTE_PATH"
fi

if [[ "$DRAFT_ONLY" == true ]]; then
  echo "Draft-only run complete. Nothing was published, committed, or pushed."
  exit 0
fi

if [[ ! -t 0 ]]; then
  echo "No interactive terminal detected. Leaving the note as a draft."
  exit 0
fi

echo
echo "Review and edit the YAML frontmatter in $NOTE_PATH."
printf 'When finished, type "publish %s" (or press Enter to leave it as a draft): ' "$CURATION_DATE"
read -r CONFIRMATION

if [[ "$CONFIRMATION" != "publish $CURATION_DATE" ]]; then
  echo "Draft kept. Nothing was published, committed, or pushed."
  exit 0
fi

corepack pnpm curation:render -- --date "$CURATION_DATE"
corepack pnpm curation:validate
corepack pnpm curation:publish -- --date "$CURATION_DATE" --yes

git add -- "$NOTE_PATH"
git diff --cached -- "$NOTE_PATH"
git commit -m "curation: publish AI briefing for $CURATION_DATE"

printf 'Push this commit to origin/Noir now? [y/N]: '
read -r PUSH_CONFIRMATION
if [[ "$PUSH_CONFIRMATION" =~ ^[Yy]$ ]]; then
  git push origin Noir
  echo "Daily curation pushed to Noir. Create or update its pull request into main."
else
  echo "Daily curation committed locally. Push later with: git push origin Noir"
fi
