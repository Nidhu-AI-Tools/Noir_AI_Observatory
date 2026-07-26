# How to run Noir AI Observatory

This is the canonical operating guide for maintainers. Update it whenever a phase adds a new scheduled job, secret, deployment step, or routine command.

## Normal operation

No daily manual command is required. The **Collect AI observations** workflow runs every day at `02:17 UTC` (`07:47 Asia/Kolkata`) from the latest `main` branch. A scheduled run may start a few minutes late.

Each run:

1. Reads enabled sources from `config/sources.yaml`.
2. Collects GitHub releases and Hugging Face model revisions.
3. Validates and writes normalized records under `data/`.
4. Creates a commit named `data: collect AI observations for YYYY-MM-DD`.
5. Generates the Overview, Radar, Sources, and Daily Digest view models.
6. Rebuilds and deploys the GitHub Pages dashboard.

The daily commit is meaningful even when there are no new observations because it contains an auditable run report. Do not edit generated files under `data/` manually.

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

## Acceptance checklist

- [ ] First complete manual run succeeded.
- [ ] A `data:` commit touched only approved generated paths.
- [ ] Run report contents were inspected.
- [ ] A second run introduced no duplicate observations.
- [ ] `pnpm observations:validate` passed after pulling generated data.
- [ ] GitHub Pages displayed the latest run.
- [ ] A scheduled run completed without manual intervention.
- [ ] A zero-observation run still produced a report.
