# Noir AI Observatory

Noir AI Observatory is a continuously updated view of the AI ecosystem. It tracks releases from GitHub, model revisions from Hugging Face, AI papers and official announcements, and sampled availability and latency for public AI-related APIs.

The project is currently in **Phase 7: Daily Curation Studio**. A local Ollama model or read-only Codex process can turn bounded Observatory evidence into a source-grounded Markdown draft. A maintainer must review and publish every note before committing it.

## Architecture

```text
source registry -> collectors and monitors -> normalized observations
                                                |
                                                v
                                  dashboard data generation
                                                |
                                                v
                                      static web dashboard
```

The initial architecture is repository-first: configuration and normalized observations will be versioned as files. Storage is accessed through package boundaries so a database can be introduced later without coupling collectors to the frontend.

For setup, first-run verification, daily operation, source management, and troubleshooting, follow the [maintainer operations guide](docs/how-to-run.md).

## Requirements

- Node.js 20.19 or newer
- Corepack
- pnpm 10.34.5

Enable the pinned package manager and install dependencies:

```bash
corepack enable
corepack prepare pnpm@10.34.5 --activate
pnpm install
```

## Development

```bash
pnpm dev
```

The dashboard is available at [http://localhost:3000](http://localhost:3000).

## Managing sources

Start the interactive source wizard:

```bash
pnpm source:add
```

Common commands:

```bash
pnpm source:list
pnpm source:edit github-qdrant-qdrant
pnpm source:check github-qdrant-qdrant
pnpm source:disable github-qdrant-qdrant
pnpm source:enable github-qdrant-qdrant
pnpm category:add
pnpm registry:validate
```

Commands also accept flags for automation. For example:

```bash
pnpm source:add -- --kind github_repo --locator qdrant/qdrant \
  --category vector-database --tags vector-search,rag
```

Set `GITHUB_TOKEN` or `HF_TOKEN` when higher API limits or access to private resources is required. Secrets are never stored in registry YAML. See [Source management](docs/source-management.md) for configuration and remote request details.

## Monitoring APIs

Add and test a public endpoint:

```bash
pnpm monitor:add -- --display-name "GitHub API" --url https://api.github.com \
  --category developer-tool --tags github,developer-api
pnpm monitor:check api-api-github-com
pnpm health:run -- --dry-run
```

Only public HTTPS `GET` and `HEAD` endpoints are supported. Tokens, custom headers, request bodies, and private-network targets are intentionally rejected. See [API health monitoring](docs/api-health.md).

## Collecting observations

Preview a single source without writing data:

```bash
pnpm collect -- --source github-qdrant-qdrant --dry-run
```

Run the complete enabled registry and validate the resulting dataset:

```bash
pnpm collect
pnpm observations:validate
pnpm generate:dashboard
```

New sources bootstrap from a seven-day lookback. Later runs continue from versioned per-source cursors, and stable observation IDs make reruns safe. See [Collection](docs/collection.md) for data contracts, scheduling, recovery, and repository settings. See [Dashboard](docs/dashboard.md) for generated view models, filters, and empty-state behavior.

## Tracking research

Add and dry-check an arXiv query:

```bash
pnpm research-source:add -- --kind arxiv_query \
  --display-name "arXiv Machine Learning" --query "cat:cs.LG" \
  --category research-paper --tags machine-learning,research
pnpm research-source:check arxiv-query-arxiv-machine-learning
pnpm research:collect -- --dry-run
```

Official RSS or Atom feeds use `--kind rss_feed`, `--url`, and `--publisher`. See [Research and announcement intelligence](docs/research.md) for management, identity, safety, and scheduled-operation details.

## Tracking model releases

Validate the model taxonomy, add reviewed metadata, and preview collection:

```bash
pnpm model:add
pnpm model:list
pnpm model:validate
pnpm model-intelligence:collect -- --dry-run
```

The normal path is the **Add a model release** or **Edit Model Radar metadata** issue form. Approved changes open a reviewable pull request. See [Model Radar](docs/model-radar.md) for provenance, classification, and operation details.

## Creating a daily curated note

With Ollama running and `llama3.1:8b` installed:

```bash
corepack pnpm curation:doctor
corepack pnpm curation:daily
```

Review the generated Markdown, then publish it locally:

```bash
corepack pnpm curation:publish
git diff
git add data/curation
git commit -m "curation: publish daily AI observatory note"
git push
```

Use Codex instead with `corepack pnpm curation:daily -- --provider codex`. Both routes use the same structured output contract and neither route can commit or push. See [Daily Curation Studio](docs/daily-curation.md).

## Quality checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run the complete verification suite with:

```bash
pnpm check
```

## Workspace

```text
apps/web                  Static Next.js dashboard
packages/core             Shared domain primitives and schemas
packages/collectors       External source adapters and orchestration
packages/monitoring       API health and model measurement logic
packages/research         Research registries, provider adapters, and orchestration
packages/model-intelligence Public metadata reconciliation and release materialization
packages/curation         Deterministic selection and local AI-assisted daily notes
packages/storage          Registry and observation persistence
packages/dashboard-data   Frontend-facing aggregation
config                    Human-managed source configuration
data                      Generated, date-partitioned observations
docs/decisions            Architecture decision records
scripts                   Project automation entry points
```

## Roadmap

1. **Phase 0 · Foundation** — workspace, dashboard shell, tests, CI, and deployment. ✓
2. **Phase 1 · Source registry** — validated GitHub and Hugging Face source management. ✓
3. **Phase 2 · Collection** — normalized releases, models, and daily run reports. ✓
4. **Phase 3 · Dashboard** — real overview, radar, source, and digest views. ✓
5. **Phase 4 · API health** — scheduled endpoint checks and historical summaries. ✓
6. **Phase 5 · Research** — papers and official announcement feeds. ✓
7. **Phase 6 · Model Intelligence** — categorized public model releases and lifecycle tracking. ✓
8. **Phase 7 · Daily Curation Studio** — local AI-assisted, human-reviewed daily notes. ✓

## Automated data

Generated commits are labeled clearly as automated observations. Collection code, source attribution, schemas, and aggregation methods remain visible so the dataset and dashboard can be audited.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local checks and repository conventions.

## License

No license has been selected yet. Until one is added, the repository remains under standard copyright terms.
