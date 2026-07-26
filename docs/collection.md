# Collection

Phase 2 collects high-signal public activity from enabled sources. GitHub repositories produce published release observations. Hugging Face organizations produce model-revision observations through the official `@huggingface/hub` client.

## Local commands

Use a dry run to inspect provider output without modifying `data/`:

```bash
pnpm collect -- --dry-run
pnpm collect -- --source github-qdrant-qdrant --dry-run
```

Persist a run, validate it, and rebuild the frontend-sized activity feed:

```bash
pnpm collect
pnpm observations:validate
pnpm generate:activity
```

The default first-run lookback is seven days. Override it only when intentionally bootstrapping more history:

```bash
pnpm collect -- --lookback-days 30
```

`GITHUB_TOKEN` and `HF_TOKEN` are optional for public resources. Tokens belong in the process environment or GitHub Actions secrets, never in command arguments, configuration, observations, reports, or committed environment files.

## Incremental behavior

Each source has an independent cursor under `data/state`. State advances only after that source succeeds. A source failure therefore retries the same window later without blocking successful sources.

Observation IDs are derived from provider identity. GitHub release IDs identify releases; a Hugging Face model ID and revision SHA identify model revisions. The JSONL store rejects duplicates across reruns before writing.

New sources use a bounded seven-day bootstrap. Collection is capped at 100 observations per source per run. A source that reaches the cap is marked `truncated` in the run report so the condition is visible.

## Scheduled workflow

`.github/workflows/collect.yml` runs daily at 02:17 UTC and can be launched manually. It validates configuration, collects observations, validates the generated dataset, builds the dashboard, commits only `data/observations`, `data/runs`, and `data/state`, and invokes the Pages deployment workflow directly.

The direct Pages call is necessary because commits created with the Actions `GITHUB_TOKEN` do not start another push-triggered workflow.

The workflow requires write access to repository contents. If the `main` ruleset requires pull requests, allow the GitHub Actions app to bypass that rule for generated data commits or accept that scheduled pushes will fail. Avoid introducing a personal token solely for this purpose.

Add an optional Actions secret named `HF_TOKEN` if Hugging Face begins rate-limiting unauthenticated collection. GitHub authentication uses the built-in workflow token.

## Failure and recovery

Run reports use `success`, `partial`, or `failure` status. Partial runs preserve successful observations and leave failed-source cursors unchanged. When every attempted source fails, the workflow persists the report and then fails visibly.

To retry, use **Actions → Collect AI observations → Run workflow**. Stable IDs make an overlapping rerun safe.

If one source is problematic, run only that source from the workflow input or locally with `--source`. Disable a permanently unavailable source through the normal source-management flow rather than deleting its historical records.
