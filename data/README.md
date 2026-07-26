# Generated data

Collectors write normalized, date-partitioned observations here. Generated records should not be edited manually.

The layout is:

```text
observations/YYYY/MM/DD.jsonl   normalized provider observations
runs/YYYY/MM/DD/RUN_ID.json     auditable collection reports
state/SOURCE_ID.json            per-source incremental cursors
health-checks/YYYY/MM/DD.jsonl  periodic API availability and latency samples
health-runs/YYYY/MM/DD/RUN_ID.json  auditable monitoring reports
```

Observation and health-check files are append-friendly JSONL with stable IDs. Writers merge and sort records atomically, making retries idempotent. Health checks store metadata only; response bodies, credentials, authorization headers, private data, and large raw responses must not be committed.

Dashboard-specific summaries belong in `apps/web/public/generated` and are reproducible from these committed records.
