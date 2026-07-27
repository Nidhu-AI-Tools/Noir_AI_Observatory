# Scripts

Command-line entry points cover registry management, collection, health monitoring, validation, and dashboard generation.

Scripts should delegate business logic to workspace packages so they remain thin orchestration layers.

- `collect.ts` runs all enabled sources or one selected source and supports non-writing dry runs.
- `validate-observations.ts` validates observations, reports, and configured source states.
- `generate-dashboard.ts` produces the overview feed, radar, digest index, daily digest files, and the backward-compatible activity feed.
- `generate-activity.ts` remains available for backward-compatible activity-only generation.
- `generate-sources.ts` produces the frontend-sized source registry.
- `monitor-cli.ts` manages and dry-checks public API monitors.
- `monitor-health.ts` executes enabled monitors and persists normalized samples.
- `validate-health.ts` validates monitor configuration and health datasets.
- `generate-health.ts` creates bounded health index and monitor-detail artifacts.
- `research-cli.ts` manages and dry-checks arXiv query and RSS/Atom sources.
- `collect-research.ts` runs incremental research collection and writes a run report even when nothing changes.
- `validate-research.ts` validates research configuration, canonical items, and reports.
- `generate-research.ts` creates the bounded Research dashboard index and daily artifacts.
- `model-intelligence-cli.ts` manages reviewed model metadata and categories.
- `collect-model-intelligence.ts` materializes deduplicated model release events from public observations and reviewed overrides.
- `validate-model-intelligence.ts` validates model configuration, events, and run reports.
- `generate-model-radar.ts` creates the Model Radar dashboard artifact.
