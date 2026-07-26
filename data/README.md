# Generated data

Collectors write normalized, date-partitioned observations here. Generated records should not be edited manually.

The layout is:

```text
observations/YYYY/MM/DD.jsonl   normalized provider observations
runs/YYYY/MM/DD/RUN_ID.json     auditable collection reports
state/SOURCE_ID.json            per-source incremental cursors
```

Observation files are append-friendly JSONL with stable IDs. Writers merge and sort records atomically, making retries idempotent. Large raw responses, model outputs, paper files, credentials, authorization headers, and private data must not be committed.

Dashboard-specific summaries belong in `apps/web/public/generated` and are reproducible from these committed records.
