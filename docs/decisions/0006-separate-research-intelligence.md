# ADR 0006: Keep research intelligence separate from release observations

## Status

Accepted

## Decision

Research papers and official announcements use a separate registry, normalized record union, cursor state, run reports, and storage paths. The dashboard combines these view models only during deterministic generation.

arXiv is the first paper provider and public RSS/Atom feeds are the first announcement provider. OpenAlex enrichment is deferred.

## Rationale

The same paper can match several tracked queries and must merge provenance. Papers also have authors, subject categories, versions, abstracts, and PDF links that do not fit release observations. A parallel boundary avoids weakening the existing observation identity contract and leaves room for later multi-provider enrichment.

Canonical records contain metadata and bounded excerpts only. Match scoring belongs to generated dashboard data rather than the canonical dataset because it is a presentation policy, not a source fact.
