# How to run the daily curation

GitHub Actions collects the Observatory data automatically. Run the command below after `11:00 Asia/Kolkata` to merge that data into `Noir`, create a local Ollama draft, review it, and publish your note.

## One-time setup

Install the project dependencies and make sure Ollama is running with `llama3.1:8b`:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm curation:doctor
```

## Daily command

```bash
corepack pnpm curation:run
```

The script updates `Noir`, merges the latest `main`, checks Ollama, waits for the draft, and opens it. Review and edit the YAML frontmatter, then follow the prompts to publish, commit, and optionally push `Noir`. Finish by creating or updating the pull request from `Noir` into `main`.

To generate a draft without publishing or using Git:

```bash
corepack pnpm curation:run -- --draft-only
```

The AI creates only a draft. The script cannot publish until you confirm that you reviewed it, and it never pushes directly to `main`.

For unattended draft and pull-request creation, follow the one-time [automated curation setup](automated-curation.md).
