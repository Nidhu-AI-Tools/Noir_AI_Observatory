# 0003: Isolate providers behind source adapters

- Status: Accepted
- Date: 2026-07-26

## Context

GitHub, Hugging Face, research indexes, and announcement feeds expose different identifiers, pagination, rate limits, and payloads.

## Decision

Each provider integration implements a shared collector contract and returns normalized domain records. Provider payloads do not cross into storage or frontend packages.

## Consequences

Adding a source type does not require changing the collection pipeline or dashboard. Provider-specific behavior remains independently testable with fixtures.
