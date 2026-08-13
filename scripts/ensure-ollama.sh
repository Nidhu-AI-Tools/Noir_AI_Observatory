#!/usr/bin/env bash

set -euo pipefail

OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"
OLLAMA_LOG="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/noir-ollama.log"

ready() {
  curl --silent --show-error --fail --max-time 5 "$OLLAMA_URL/api/tags" >/dev/null 2>&1
}

if ready; then
  echo "Ollama is already running."
  exit 0
fi

if [[ "$(uname -s)" == "Darwin" && -d /Applications/Ollama.app ]]; then
  echo "Starting the Ollama macOS application..."
  open -gja Ollama || true
  for _ in {1..10}; do
    ready && exit 0
    sleep 2
  done
fi

if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama is not installed or is not available on PATH." >&2
  exit 1
fi

echo "Starting ollama serve in the background..."
nohup ollama serve >"$OLLAMA_LOG" 2>&1 &

for _ in {1..80}; do
  if ready; then
    echo "Ollama is ready."
    exit 0
  fi
  sleep 2
done

echo "Ollama did not become ready within three minutes." >&2
[[ -f "$OLLAMA_LOG" ]] && tail -50 "$OLLAMA_LOG" >&2
exit 1
