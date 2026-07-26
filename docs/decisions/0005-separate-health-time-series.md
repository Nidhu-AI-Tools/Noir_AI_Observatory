# 0005: Keep health checks as a separate time series

- Status: Accepted
- Date: 2026-07-26

## Context

Release observations are incremental provider events with cursors. API health checks are periodic samples where repeated successful results remain meaningful and failures must be recorded without failing the runner.

## Decision

Store monitor configuration separately from source configuration and persist normalized health samples under dedicated JSONL partitions. Monitors may optionally link to a source. Dashboard aggregations and digest transitions can combine the domains without sharing their write contracts.

## Consequences

Existing collection identities and cursors remain stable. Health sampling can change cadence or move to specialized storage later. Availability figures must be described as observations from GitHub-hosted runners rather than SLA measurements.
