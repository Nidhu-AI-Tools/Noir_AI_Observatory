# Noir AI Observatory

Noir AI Observatory is a planned, continuously updated view of the AI ecosystem. It will track releases from GitHub and Hugging Face, research and announcements, API health, and—later—model behavior and consensus measurements.

The project is currently in **Phase 1: Source Registry**. GitHub repositories and Hugging Face organizations can be validated, categorized, tagged, edited, enabled, and disabled through a versioned registry. External release collection starts in Phase 2.

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
packages/storage          Registry and observation persistence
packages/dashboard-data   Frontend-facing aggregation
config                    Human-managed source configuration
data                      Generated, date-partitioned observations
docs/decisions            Architecture decision records
scripts                   Project automation entry points
```

## Roadmap

1. **Foundation** — workspace, dashboard shell, tests, CI, and deployment. ✓
2. **Source registry** — validated GitHub and Hugging Face source management. ✓
3. **Collection** — normalized releases, models, and daily run reports.
4. **Dashboard** — real radar, source, and digest views.
5. **API health** — scheduled endpoint checks and historical summaries.
6. **Research** — papers and official announcement feeds.
7. **Model lab** — versioned multi-provider behavior and consensus benchmarks.

## Automated data

Future generated commits will be labeled clearly as automated observations. Collection code, source attribution, schemas, and scoring methods will remain visible so the resulting dataset can be audited.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local checks and repository conventions.

## License

No license has been selected yet. Until one is added, the repository remains under standard copyright terms.
