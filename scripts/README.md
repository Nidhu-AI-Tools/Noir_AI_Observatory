# Scripts

Command-line entry points cover registry management, collection, observation validation, and dashboard generation. Monitoring commands will be introduced with API health work.

Scripts should delegate business logic to workspace packages so they remain thin orchestration layers.

- `collect.ts` runs all enabled sources or one selected source and supports non-writing dry runs.
- `validate-observations.ts` validates observations, reports, and configured source states.
- `generate-activity.ts` produces the frontend-sized activity feed.
- `generate-sources.ts` produces the frontend-sized source registry.
