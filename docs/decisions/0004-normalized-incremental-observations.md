# 0004: Store normalized incremental observations

- Status: Accepted
- Date: 2026-07-26

## Context

Provider APIs expose incompatible records and can return the same items on every poll. The public dataset needs stable identities, safe reruns, bounded initial imports, and enough operational history to explain missing data.

## Decision

Normalize provider activity into a versioned observation union. Partition observations as JSONL by UTC collection date, identify records deterministically, and keep independent cursors for each source. Persist a structured report for every non-dry collection run.

GitHub collection initially covers published releases. Hugging Face collection covers model revisions. Raw payloads are discarded after normalization.

## Consequences

The dataset remains inspectable and append-friendly, retries do not create duplicate observations, and one provider failure does not block other sources. Cursor and ID behavior must remain backward compatible within a schema version. Query performance will eventually justify a database or compact index, but storage interfaces isolate that future migration.
