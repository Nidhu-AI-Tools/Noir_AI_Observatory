# Scripts

Command-line entry points cover registry management, collection, observation validation, and dashboard generation. Monitoring commands will be introduced with API health work.

Scripts should delegate business logic to workspace packages so they remain thin orchestration layers.

- `collect.ts` runs all enabled sources or one selected source and supports non-writing dry runs.
- `validate-observations.ts` validates observations, reports, and configured source states.
- `generate-dashboard.ts` produces the overview feed, radar, digest index, daily digest files, and the backward-compatible activity feed.
- `generate-activity.ts` remains available for backward-compatible activity-only generation.
- `generate-sources.ts` produces the frontend-sized source registry.
