# Dashboard

Phase 3 turns the repository dataset into a useful static interface without introducing a database or server runtime. The build reads the same validated source registry, observations, and run reports used by collection.

## Views

- **Overview** shows aggregate release/model counts, the latest observations, the most active categories, and the latest collection result.
- **Radar** shows every tracked source and its activity in the last 24 hours, 7 days, 30 days, and all time. Search and filters are encoded in the URL where practical, so a focused view can be shared.
- **Digests** groups observations by UTC day, category, and source. A collection report creates a digest date even when the run found no changes.
- **Sources** remains the registry-management view and now links each source to its latest observation and focused Radar view.

**API Health** shows current endpoint state, observed availability, latency percentiles, consecutive failures, and recent checks. **Research** shows normalized papers and official announcements with shareable filters, transparent match reasons, and deterministic seven-day trends. **Models** shows the latest categorized model releases, a model catalog, lifecycle and availability filters, and category leaders. **Curation** displays only human-reviewed daily notes, with AI-assistance disclosure and direct evidence links.

## Generated artifacts

Run:

```bash
corepack pnpm generate:sources
corepack pnpm generate:dashboard
corepack pnpm generate:research
corepack pnpm generate:model-radar
corepack pnpm generate:curation
```

The commands write:

```text
apps/web/public/generated/sources.json
apps/web/public/generated/activity.json
apps/web/public/generated/feed.json
apps/web/public/generated/radar.json
apps/web/public/generated/digests/index.json
apps/web/public/generated/digests/YYYY-MM-DD.json
apps/web/public/generated/health/index.json
apps/web/public/generated/health/monitors/MONITOR_ID.json
apps/web/public/generated/research/index.json
apps/web/public/generated/research/days/YYYY-MM-DD.json
apps/web/public/generated/models/index.json
apps/web/public/generated/curation/index.json
```

`activity.json` is retained for compatibility with Phase 2. New pages use the enriched feed, radar, and digest artifacts. Generated files are ignored and recreated by `pnpm dev`, `pnpm build`, and GitHub Pages deployment.

Daily artifacts are bounded to the newest 90 UTC dates and 500 displayed observations per date. A digest reports the number omitted if a high-volume day crosses the display bound. The source observations under `data/` remain the complete canonical record.

## Time and status semantics

Activity windows are calculated relative to the artifact's `generatedAt` timestamp. Future timestamps are excluded. Digest dates use the UTC date in normalized ISO timestamps rather than the reader's locale.

Radar status is derived from the latest observation:

- `today`: within 24 hours
- `this-week`: within 7 days
- `this-month`: within 30 days
- `earlier`: older than 30 days
- `none`: no observation has been collected
- `disabled`: the registry entry is disabled

An empty observation set is valid. The dashboard explains how to run collection, and any available run report remains visible. A missing generated file produces a retryable error state instead of rendering sample content.

## Extension boundary

Frontend pages consume exported types from `@noir/dashboard-data`; they do not read YAML or JSONL directly. New collectors should first normalize records in `@noir/core`, then add deterministic aggregation here. This keeps future storage migrations and richer UI work from requiring page rewrites.
