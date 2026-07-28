# Daily Curation Studio

Daily Curation Studio turns recent Observatory evidence into a short Markdown draft using local Ollama or Codex. It is intentionally local: GitHub-hosted runners cannot access the Ollama service on your Mac, and no provider is allowed to commit or push.

## Default setup

The committed default is `llama3.1:8b` at `http://127.0.0.1:11434`. Start the Ollama application or daemon, then verify both the provider and your Git author identity:

```bash
corepack pnpm curation:doctor
```

Override the model for one run with `--model`, or set `OLLAMA_MODEL` in your shell. `qwen2.5:3b-instruct` is a faster installed fallback.

## One-command draft

Pull the latest committed Observatory data, then run:

```bash
git pull
corepack pnpm curation:daily
```

The command reads the newest 48 hours, deterministically selects at most 12 candidates with category balancing, writes the ignored context to `.noir/curation`, asks Ollama for schema-constrained output, validates every source ID and URL, and creates an uncommitted Markdown draft under `data/curation/YYYY/MM/DD.md`.

Useful alternatives:

```bash
corepack pnpm curation:prepare
corepack pnpm curation:daily -- --model qwen2.5:3b-instruct
corepack pnpm curation:daily -- --provider codex
corepack pnpm curation:status
```

Codex uses the existing local Codex authentication and configuration. Its process is ephemeral and read-only; the Observatory writes the response only after schema and evidence validation.

If no suitable evidence exists, the command exits successfully without creating an empty note. An existing draft is protected unless `--overwrite` is explicitly passed, and a published note cannot be replaced through the store.

## Review and contribution

Read the complete draft and open every evidence link. To revise wording, edit the structured YAML frontmatter, then regenerate the matching readable body and publish:

```bash
corepack pnpm curation:render
corepack pnpm curation:publish
corepack pnpm curation:validate
git diff
git add data/curation
git commit -m "curation: publish AI observatory note for $(date -u +%F)"
git push
```

Publication requires typing the displayed confirmation. `--yes` exists for an already completed non-interactive review, but should not be used to bypass review. Confirm that `git config user.email` is connected to your GitHub account if you expect the commit to appear on your contribution graph.

## What is selected

Eligible evidence includes GitHub releases, Hugging Face revisions, Model Radar events, research papers, official announcements, and API health transitions. Routine healthy samples are excluded. Duplicate URLs are collapsed, higher-value release kinds rank first, and category caps stop one noisy source from dominating.

Source text is untrusted. Prompts explicitly treat embedded instructions as data. The model cannot introduce a new source ID or change a supplied URL, and each highlight must include a why-it-matters interpretation distinct from its factual summary.

## Safe local automation on macOS

Automate draft creation, not publication. First locate Corepack:

```bash
command -v corepack
```

Create `~/Library/LaunchAgents/com.noir.curation.plist` with your absolute Corepack path and repository path:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.noir.curation</string>
  <key>ProgramArguments</key>
  <array>
    <string>/ABSOLUTE/PATH/TO/corepack</string>
    <string>pnpm</string>
    <string>curation:daily</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/ABSOLUTE/PATH/TO/Noir_AI_Observatory</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>18</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>StandardOutPath</key><string>/tmp/noir-curation.log</string>
  <key>StandardErrorPath</key><string>/tmp/noir-curation-error.log</string>
</dict>
</plist>
```

Load it with `launchctl load ~/Library/LaunchAgents/com.noir.curation.plist`. The Mac must be awake and Ollama must be reachable. This job does not pull, publish, commit, or push; review remains a separate deliberate action.

## Troubleshooting

- **Ollama unavailable:** start Ollama and rerun `curation:doctor`.
- **Model not installed:** pass one shown by the doctor or run `ollama pull MODEL`.
- **No candidates:** pull the latest generated data or increase `selection.lookbackHours` in a reviewed configuration change.
- **Invalid provider response:** retry once, use the fallback model, or switch to Codex. Raw invalid output is not committed.
- **Draft already exists:** review it; use `--overwrite` only when replacement is intentional.
- **Published note cannot be replaced:** make a normal reviewed correction commit rather than silently regenerating history.
