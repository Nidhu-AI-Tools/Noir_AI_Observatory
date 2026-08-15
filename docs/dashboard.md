# Dashboard

The dashboard turns the repository dataset into a useful static interface without introducing a database or server runtime. The build reads the same validated registries, observations, events, checks, notes, and run reports used by collection.

## Views

- **Today** is the homepage and UTC daily archive. It combines the published reviewed note, deterministic ecosystem releases, model signals, research highlights, API transitions, collection status, and data freshness for one selected date.
- **Radar** shows every tracked GitHub repository and Hugging Face organization, its activity in the last 24 hours, 7 days, 30 days, and all time, and its reviewed configuration. Search and filters are encoded in the URL, so a focused view can be shared. Add and edit requests use the existing GitHub Issue Forms.

**API Health** shows current endpoint state, observed availability, latency percentiles, consecutive failures, and recent checks. **Research** shows normalized papers and official announcements with provenance-backed organization, venue, and topic facets, deterministic search, and static pagination. **Models** separates confirmed releases, first observations, revisions, and lifecycle changes in a compact model catalog. Published curation notes appear in their matching Today edition; draft notes are never generated for the public site.

## Generated artifacts

Run:

```bash
corepack pnpm generate:dashboard
corepack pnpm generate:health
corepack pnpm generate:research
corepack pnpm generate:model-radar
```

The commands write:

```text
apps/web/public/generated/radar.json
apps/web/public/generated/today/index.json
apps/web/public/generated/today/YYYY-MM-DD.json
apps/web/public/generated/health/index.json
apps/web/public/generated/health/monitors/MONITOR_ID.json
apps/web/public/generated/research/index.json
apps/web/public/generated/research/pages/NNNN.json
apps/web/public/generated/research/search/index.json
apps/web/public/generated/models/index.json
```

Generated files are ignored and recreated by `pnpm dev`, `pnpm build`, and GitHub Pages deployment. The old `/digests/` and `/curation/` pages redirect to Today and preserve a requested `date` query parameter. The old `/sources/` page redirects to Radar and preserves compatible filters. Their superseded generated payloads are no longer emitted.

Today artifacts are bounded to the newest 90 UTC dates. Each edition carries full counts but only the cards rendered by the homepage: up to 6 ecosystem releases, 6 model signals, 8 research items, and 6 API transitions. Public notes and model signals are compact projections; complete provenance remains in canonical records under `data/`. A selected edition therefore loads without downloading an entire historical catalog.

The newest edition is selected by default. `/?date=YYYY-MM-DD` is the shareable archive URL. A successful collection report creates an edition even when it found no changes, allowing the page to distinguish a quiet successful day from missing data.

Research initially loads its compact index and one 24-record page. The global search index is fetched only when a query, facet, date filter, or non-default sort requires catalog-wide matching. Full page shards are cached in the browser. Organization and venue facets require an authoritative configured source; topic facets come from reviewed provider-category mappings or source configuration.

## Time and status semantics

Activity windows are calculated relative to the artifact's `generatedAt` timestamp. Future timestamps are excluded. Today dates use the UTC date in normalized ISO timestamps rather than the reader's locale. `lastUpdatedAt` is derived from the latest contributing collection, research, observation, event, health, or review timestamp; it is not merely the website build time.

Today uses one normalized representation per logical signal. A Hugging Face observation promoted to a model event is not repeated in the ecosystem section, and an item featured in a published note is not repeated below that note. Section totals still describe every logical signal for the date.

Models and Research derive run badges from the recorded run result and its age at generation time. A recent success or valid no-op is current, partial work is labeled partial, failures need attention, and an old report is delayed.

The Models index is a versioned public projection. It does not embed canonical event histories. Category leaders reference a model ID in the single compact catalog representation. Complete append-only model events remain under `data/model-events/`.

Radar status is derived from the latest observation:

- `today`: within 24 hours
- `this-week`: within 7 days
- `this-month`: within 30 days
- `earlier`: older than 30 days
- `none`: no observation has been collected
- `disabled`: the registry entry is disabled

Radar is the management surface for GitHub repository and Hugging Face organization sources only. Research feeds and API monitors remain managed from their respective dashboards. Source IDs, kinds, and locators are immutable; display metadata, category, tags, and enabled state can be changed through a reviewed edit request.

An empty observation set is valid. The dashboard explains how to run collection, and any available run report remains visible. A missing generated file produces a retryable error state instead of rendering sample content.

## Extension boundary

Frontend pages consume exported types from `@noir/dashboard-data`; they do not read YAML or JSONL directly. New collectors should first normalize records in `@noir/core`, then add deterministic aggregation here. This keeps future storage migrations and richer UI work from requiring page rewrites.
