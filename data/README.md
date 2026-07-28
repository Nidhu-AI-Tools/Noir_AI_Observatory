# Generated data

Collectors write normalized, date-partitioned observations here. Generated records should not be edited manually.

The layout is:

```text
observations/YYYY/MM/DD.jsonl   normalized provider observations
runs/YYYY/MM/DD/RUN_ID.json     auditable collection reports
state/SOURCE_ID.json            per-source incremental cursors
health-checks/YYYY/MM/DD.jsonl  periodic API availability and latency samples
health-runs/YYYY/MM/DD/RUN_ID.json  auditable monitoring reports
research-items/YYYY/MM/DD.jsonl  normalized paper and announcement metadata
research-runs/YYYY/MM/DD/RUN_ID.json  auditable research collection reports
research-state/SOURCE_ID.json  per-source research cursors
model-events/YYYY/MM/DD.jsonl  normalized model release and lifecycle events
model-runs/YYYY/MM/DD/RUN_ID.json  model-intelligence reports
curation/YYYY/MM/DD.md         AI-assisted, human-reviewed daily notes
```

Observation, health-check, and research-item files use stable IDs. Writers merge and sort records atomically, making retries idempotent. Curation notes are the exception to the generated-data rule: they may be edited while in draft, but become immutable through the curation store after publication. Health and research records store metadata only; response bodies, PDFs, credentials, authorization headers, private data, and large raw responses must not be committed.

Dashboard-specific summaries belong in `apps/web/public/generated` and are reproducible from these committed records.
