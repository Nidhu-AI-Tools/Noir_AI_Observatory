# Model Radar

Model Radar maintains a public, auditable timeline of AI model releases. It answers “what was released recently, by whom, and in which category?” It does not claim that the newest model is the best model.

## Inputs and cost

The daily job consumes two repository-owned inputs:

1. `huggingface_model_revision` observations already collected from tracked Hugging Face organizations.
2. Reviewed entries in `config/model-overrides.yaml` for API-only models, corrections, deprecations, and releases that are not visible through an existing collector.

It performs deterministic parsing and classification locally. It makes no inference calls, uses no paid API, and needs no OpenAI, Anthropic, or Google model key. `HF_TOKEN` remains optional for the separate Hugging Face collector when higher rate limits are useful.

## Add or correct a model through GitHub

Create the `model:approved` label with this description:

> Approved Model Radar metadata or source relationship change.

Use **Issues → New issue → Add a model release** for an API-only or otherwise unobserved model. Use **Edit Model Radar metadata** to correct categories, tags, availability, version, or lifecycle. Supply a public first-party model card, repository, announcement, paper, or API-documentation URL.

After review, apply `model:approved`. The workflow validates the form and opens a configuration pull request. Review and merge that pull request; approval does not write directly to `main`.

Local equivalents are:

```bash
corepack pnpm model-category:list
corepack pnpm model:list
corepack pnpm model:add
corepack pnpm model:edit MODEL_ID
corepack pnpm model:validate
```

Categories and tags remain editable after creation. Prefer the edit issue form for an auditable GUI workflow, or use `model:edit` locally and submit the resulting YAML change normally.

## Daily operation

The **Collect model intelligence** workflow runs daily at `05:17 UTC` (`10:47 Asia/Kolkata`) and can also be dispatched manually. Run the normal observation collector first when testing fresh Hugging Face sources, then run Model Intelligence. A successful run:

- reads all existing observations and reviewed overrides;
- creates only unseen events under `data/model-events/YYYY/MM/DD.jsonl`;
- always writes a report under `data/model-runs/YYYY/MM/DD/`, including on zero-change days;
- rebuilds and deploys GitHub Pages.

The event limit is configured in `config/model-intelligence.yaml`. Repeating a run over unchanged inputs produces no duplicate event. The run report records eligible observations, produced events, duplicates, manual models, and bounded errors.

Preview locally without writing:

```bash
corepack pnpm model-intelligence:collect -- --dry-run
corepack pnpm model-intelligence:validate
corepack pnpm generate:model-radar
```

## Classification and provenance

Hugging Face pipeline tags and model tags map conservatively to stable categories in `config/model-categories.yaml`. When metadata is insufficient, the first version falls back to `language-models`. Reviewed overrides take precedence for category, tags, modalities, availability, organization, and descriptive metadata.

Every event preserves its public URL, source ID, observation time, release time, and whether a timestamp was inferred. Historical events are append-only; corrections create a new reviewed event rather than silently rewriting history.

## First-run acceptance

1. Confirm at least one enabled Hugging Face organization has produced a model observation, or merge one reviewed model override.
2. Run **Actions → Collect model intelligence → Run workflow**.
3. Confirm the commit touches only `data/model-events/**` and `data/model-runs/**`.
4. Confirm the Models page shows the release, evidence link, category, and availability.
5. Run the workflow again and confirm it writes a new run report but no duplicate event.
6. Let the next scheduled run finish without manual approval and confirm Pages updates.
