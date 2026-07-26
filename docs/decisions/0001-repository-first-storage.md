# 0001: Start with repository-first storage

- Status: Accepted
- Date: 2026-07-26

## Context

The initial product needs scheduled collection, a public dataset, daily version history, and a read-only dashboard. Operating a database and authenticated control plane would slow the first useful release.

## Decision

Store human-managed configuration and normalized observations as versioned files. Access them through storage interfaces rather than direct filesystem calls in collectors or UI components.

## Consequences

The project remains inexpensive and auditable. A database should be introduced when query volume, data size, remote editing, or multiple users justify it. New storage adapters can then replace file implementations without changing domain contracts.
