# ADR 0007: Bounded, repository-first model consensus lab

## Status

Accepted

## Decision

Model comparisons use a narrow versioned classification schema, provider adapters behind one interface, deterministic case selection, append-only normalized responses, and separate run reports. Scheduled execution requires both a committed policy gate and an Actions variable, while credentials remain in provider-specific secrets. Calls are sequential and capped per run.

## Consequences

The dataset is reproducible and cheap enough to operate incrementally. Providers can be added without changing dashboard storage contracts. The first version does not support free-form chat evaluation, streaming, judge-model scoring, or automatic claims of correctness. Prompt or schema changes require explicit versioning.
