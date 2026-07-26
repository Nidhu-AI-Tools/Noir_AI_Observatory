# Model Consensus Lab

The Model Lab creates an auditable comparison dataset for one narrow, useful task: classifying AI ecosystem releases, papers, and announcements. Every provider receives the same versioned prompt and JSON schema. Responses retain the input snapshot, provenance, timing, token usage, and hashes of the prompt, input, and model configuration.

## Safety and cost gates

The repository starts with no model profiles and `policy.scheduleEnabled: false`. A scheduled call occurs only when all four conditions are true:

1. At least one enabled profile exists in `config/model-lab.yaml`.
2. The corresponding Actions secret exists: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GOOGLE_AI_API_KEY`.
3. `policy.scheduleEnabled` is changed to `true` in a reviewed pull request.
4. The Actions repository variable `MODEL_LAB_ENABLED` is exactly `true`.

The runner is sequential, stores no raw provider envelope, sets `store: false` for OpenAI, bounds input/output sizes, and caps calls at `maxRequestsPerRun`. The initial cap is six. Missing secrets create no provider request.

## Manage profiles

Use the **Add a Model Lab profile** issue form and apply `model-lab:approved` after review. Automation opens a pull request and never calls the provider. Local equivalents are:

```bash
corepack pnpm model:add -- --provider openai --display-name "OpenAI model" --model PROVIDER_MODEL_ID
corepack pnpm model:list
corepack pnpm model:edit PROFILE_ID -- --model NEW_PROVIDER_MODEL_ID
corepack pnpm model:disable PROFILE_ID
corepack pnpm model:enable PROFILE_ID
corepack pnpm model-lab:validate
```

Provider model IDs change over time; choose exact IDs from current official provider documentation and review upgrades through pull requests.

## Preview and run

Preview selection without writing data or calling a provider:

```bash
corepack pnpm model-lab:run -- --dry-run
```

Run one gold case and one model locally:

```bash
OPENAI_API_KEY=... corepack pnpm model-lab:run -- \
  --case gold-vector-database-release --model PROFILE_ID
```

For production, use **Actions → Run Model Consensus Lab → Run workflow**. A repeated successful input/prompt/model tuple is reused rather than called again. Use `retry_failed` only after understanding a prior provider failure.

## Dataset and dashboard

- `config/model-lab.yaml`: policy and model profiles; never secrets.
- `config/model-lab-suites.yaml`: versioned task definitions.
- `config/model-lab-cases.yaml`: synthetic gold cases.
- `data/model-lab-responses/YYYY/MM/DD.jsonl`: normalized responses.
- `data/model-lab-runs/YYYY/MM/DD/`: run reports and consensus scores.

The dashboard reports categorical agreement, set similarity, evidence quotes that occur in the source input, gold-case scores, latency, and token usage. Agreement can reveal ambiguity or behavioral differences, but even unanimous models can be wrong.

## Extending the lab

Add a new suite version instead of silently changing a prompt or output schema. Preserve existing response records. Add fixture-based adapter tests; CI must never require credentials or network access.
