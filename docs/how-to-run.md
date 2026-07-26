# How to run Noir AI Observatory

This is the canonical operating guide for maintainers. Update it whenever a phase adds a new scheduled job, secret, deployment step, or routine command.

## Normal operation

No routine manual command is required. **Collect AI observations** runs daily at `02:17 UTC` (`07:47 Asia/Kolkata`). **Collect research intelligence** runs daily at `04:37 UTC` (`10:07 Asia/Kolkata`). **Monitor API health** runs at minute `23` every six hours. Scheduled runs may start late.

Each run:

1. Reads enabled sources from `config/sources.yaml`.
2. Collects GitHub releases and Hugging Face model revisions.
3. Validates and writes normalized records under `data/`.
4. Creates a commit named `data: collect AI observations for YYYY-MM-DD`.
5. Generates the Overview, Radar, Sources, and Daily Digest view models.
6. Rebuilds and deploys the GitHub Pages dashboard.

The daily commit is meaningful even when there are no new observations because it contains an auditable run report. Do not edit generated files under `data/` manually.

Research collection follows the same operating model with `config/research-sources.yaml`, `data/research-items`, `data/research-runs`, and `data/research-state`. Its deployment updates Research, Overview, and Daily Digests.

## First production acceptance test

Perform this once after collection changes are merged into `main`.

### 1. Run the complete registry manually

1. Open the repository on GitHub.
2. Select **Actions**.
3. Select **Collect AI observations** in the workflow list.
4. Select **Run workflow**.
5. Choose the `main` branch.
6. Leave **Optional source ID** empty.
7. Leave **Bootstrap lookback window** set to `7`.
8. Select the green **Run workflow** button.
9. Open the new run and wait for both `collect` and `deploy` to finish.

The workflow is successful when both jobs are green. A `partial` collection can still produce data, but its run log and report should be inspected for failed sources.

### 2. Confirm the automated commit

Open **Code → Commits** and inspect the newest commit. Its message should resemble:

```text
data: collect AI observations for 2026-07-26
```

The commit may change only these paths:

```text
data/observations/**
data/runs/**
data/state/**
```

Confirm that it does not contain configuration, application code, environment files, tokens, or files under `data/raw`.

### 3. Confirm the run report

Open the new file under:

```text
data/runs/YYYY/MM/DD/RUN_ID.json
```

Check:

- `status` is `success` or an understood `partial` result.
- `totals.configured` matches the selected registry scope.
- `totals.failed` is `0` for a clean run.
- Every enabled source has a source result.
- No error contains credentials or authorization headers.

### 4. Confirm observations and cursors

When the run finds recent activity, inspect:

```text
data/observations/YYYY/MM/DD.jsonl
```

Each line must be valid JSON and contain a stable `id`, `sourceId`, provider URL, occurrence time, and collection time.

Each successfully checked source should also have a cursor:

```text
data/state/SOURCE_ID.json
```

Sources that failed must not advance their state.

### 5. Run it a second time

Immediately repeat the manual workflow with the same inputs.

For an ordinary no-change rerun:

- A new file appears under `data/runs`.
- Source-state timestamps advance.
- `totals.observations` is `0`.
- The observation JSONL file is unchanged.

If genuine provider activity occurs between the runs, the observation count may be greater than zero. In that case, verify deduplication locally instead of assuming the count must be zero:

```bash
git switch main
git pull --ff-only
corepack pnpm observations:validate
```

The command fails if duplicate observation IDs or invalid generated records exist.

### 6. Confirm the Pages deployment

Return to the collection workflow run and open the `deploy` job. Use its deployment URL to open the dashboard.

Confirm that:

- The site loads successfully.
- **Overview** shows the latest run status and recent observations.
- **Radar** lists every configured source, including sources with no activity.
- **Digests** opens the most recent UTC day, including a zero-change day.
- **Sources** links each registry entry to its latest activity when available.
- Release and model-revision totals match the generated data.

If the previous dashboard remains visible, wait briefly and perform a hard refresh after the deployment job finishes.

### 7. Confirm an unattended scheduled run

After the manual checks pass, take no action until the next scheduled window at approximately `07:47 Asia/Kolkata`.

Then verify:

- A new **Collect AI observations** run exists with the `schedule` event.
- It did not request manual workflow approval.
- It created the expected `data:` commit.
- It added a run report even when `totals.observations` is `0`.
- Its Pages deployment completed.

This scheduled run completes the production acceptance test.

## Local development workflow

Install the pinned dependencies:

```bash
corepack enable
corepack pnpm install --frozen-lockfile
```

Run the dashboard:

```bash
corepack pnpm dev
```

Run the complete verification suite before pushing code:

```bash
corepack pnpm check
```

## Safe collection commands

Preview all enabled sources without writing data:

```bash
corepack pnpm collect -- --dry-run
```

Preview one source:

```bash
corepack pnpm collect -- --source github-qdrant-qdrant --dry-run
```

Persist a local collection only when you intentionally want local generated files:

```bash
corepack pnpm collect
corepack pnpm observations:validate
corepack pnpm generate:dashboard
```

The scheduled GitHub workflow is preferred for production data because it records the run identity and deploys the matching dashboard automatically.

The dashboard command writes disposable files under `apps/web/public/generated/`. These files are ignored by Git because Pages regenerates them from the versioned registry and dataset during every build.

## Adding and editing sources

For normal remote operation, use the issue forms linked from the Sources dashboard:

1. Submit an **Add source** or **Edit source** issue.
2. Review the requested locator, category, and tags.
3. Apply `source:approved`.
4. Review the generated pull request.
5. Merge it after CI passes.

Newly added sources bootstrap automatically during the next collection run.

For local source management:

```bash
corepack pnpm source:list
corepack pnpm source:add
corepack pnpm source:edit SOURCE_ID
corepack pnpm source:check SOURCE_ID
corepack pnpm source:disable SOURCE_ID
corepack pnpm source:enable SOURCE_ID
```

Run `corepack pnpm registry:validate` after source or taxonomy changes.

## Adding and operating API monitors

Use **Add monitor** and **Request edit** from the API Health dashboard. After reviewing the public endpoint, apply `monitor:approved`; automation validates it, performs a non-persistent check, and opens a pull request.

Create the `monitor:approved` repository label before processing the first request.

Local commands:

```bash
corepack pnpm monitor:list
corepack pnpm monitor:add
corepack pnpm monitor:check MONITOR_ID
corepack pnpm monitor:edit MONITOR_ID
corepack pnpm monitor:disable MONITOR_ID
corepack pnpm monitor:enable MONITOR_ID
corepack pnpm monitor:validate
corepack pnpm health:run -- --dry-run
```

After the first monitor is merged, run **Actions → Monitor API health → Run workflow** once. Leave the monitor input empty to check the complete registry. Confirm that:

- The workflow commits only `data/health-checks/**` and `data/health-runs/**`.
- A healthy, degraded, or down sample exists for every enabled monitor.
- Endpoint failures appear as data and do not fail the workflow.
- API Health and Overview update after Pages deployment.
- A second execution creates a new sample; rerunning the same workflow run ID does not duplicate one.

The dashboard marks a monitor stale after 15 hours without a sample. Availability is a sampled observation from GitHub-hosted runners, not an SLA.

## Adding and operating research sources

Create the `research:approved` label before processing the first request. Use **Add research source** from the Research page or the matching issue form, review the arXiv query or official feed endpoint, and apply the label. Automation validates the request, parses up to five recent items without persisting them, and opens a configuration pull request.

Local commands:

```bash
corepack pnpm research-source:list
corepack pnpm research-source:add
corepack pnpm research-source:check RESEARCH_SOURCE_ID
corepack pnpm research-source:edit RESEARCH_SOURCE_ID
corepack pnpm research-source:disable RESEARCH_SOURCE_ID
corepack pnpm research-source:enable RESEARCH_SOURCE_ID
corepack pnpm research-source:validate
corepack pnpm research:collect -- --dry-run
```

After the first research source is merged, run **Actions → Collect research intelligence → Run workflow** with the source field empty and lookback set to `7`. Confirm that:

- Only `data/research-items/**`, `data/research-runs/**`, and `data/research-state/**` are committed.
- Papers or announcements contain canonical IDs, source attribution, timestamps, and bounded excerpts.
- The Research page loads filters and source-management links.
- Overview and the matching Daily Digest include research counts or items.
- A second run adds a run report without duplicating items.
- Overlapping arXiv queries produce one item with merged `sourceIds` and tags.
- A successful zero-change day still creates a research run report and deploys Pages.

Wait for the next scheduled `04:37 UTC` run and confirm it completes without manual approval. See [Research and announcement intelligence](research.md) for the complete data and safety contract.

## Routine maintenance

Check the Actions page periodically for failed scheduled runs. No intervention is needed for a successful zero-observation run.

Investigate these run states:

- `partial`: some sources succeeded and others failed.
- `failure`: every attempted source failed.
- `truncated`: a source reached the 100-observation safety limit.

Use a targeted manual run to retry one source by entering its immutable source ID in the workflow’s **Optional source ID** field.

Disable a permanently unavailable source through the source-management workflow. Do not delete its historical observations or cursor manually.

## Troubleshooting

### Push to `main` is rejected

The collection workflow writes generated data directly to `main`. Confirm that GitHub Actions has read/write workflow permissions and that the repository ruleset permits the GitHub Actions app to bypass the pull-request requirement for generated commits.

### No scheduled run appears

Confirm that:

- `collect.yml` exists on the default branch.
- GitHub Actions is enabled.
- The workflow is enabled on the Actions page.
- The repository has not had scheduled workflows disabled due to inactivity.

Use **Run workflow** to verify the same code path manually.

### Hugging Face sources fail or rate-limit

Create a read-only Hugging Face token and save it as the repository Actions secret `HF_TOKEN`. Never add the token to an issue, YAML registry, observation, run report, or committed environment file.

### One source repeatedly fails

Run it alone from the workflow input or locally in dry-run mode. If its locator is permanently unavailable, disable it through a source edit. Its last successful cursor and historical observations remain intact.

### Pages did not update

Open the collection run and inspect its `deploy` job. Confirm that GitHub Pages still uses **GitHub Actions** as its build and deployment source. Retry the workflow after correcting any build or environment error.

### A monitored API is down

Open its history in API Health and compare the HTTP status or error code. A down endpoint does not make the monitoring workflow red. Use a local `monitor:check` or targeted manual workflow run to confirm it, then disable the monitor if the endpoint was permanently removed.

### A research source fails

Run `research-source:check RESEARCH_SOURCE_ID` locally or target it from the manual research workflow. Verify that an arXiv query is valid or that the publisher still exposes a public HTTPS RSS/Atom document under the 2 MB limit. A failed source does not advance its cursor and does not stop successful sources from being persisted.

## Acceptance checklist

- [ ] First complete manual run succeeded.
- [ ] A `data:` commit touched only approved generated paths.
- [ ] Run report contents were inspected.
- [ ] A second run introduced no duplicate observations.
- [ ] `pnpm observations:validate` passed after pulling generated data.
- [ ] GitHub Pages displayed the latest run.
- [ ] A scheduled run completed without manual intervention.
- [ ] A zero-observation run still produced a report.
- [ ] The `monitor:approved` label exists.
- [ ] The first API monitor was added through the issue/PR flow.
- [ ] A manual health run committed samples and deployed Pages.
- [ ] API Health shows current status, latency, and observed availability.
- [ ] A scheduled health run completed without intervention.
- [ ] The `research:approved` label exists.
- [ ] The first research source was added through the issue/PR flow.
- [ ] A manual research run committed metadata and deployed Pages.
- [ ] A second research run introduced no duplicate items.
- [ ] Research appears in Research, Overview, and Daily Digests.
- [ ] A scheduled research run completed without intervention.
