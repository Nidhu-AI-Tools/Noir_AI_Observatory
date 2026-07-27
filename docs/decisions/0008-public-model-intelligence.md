# ADR 0008: Public, repository-first model intelligence

## Status

Accepted

## Decision

Model Radar derives a normalized release-event dataset from existing public Hugging Face observations and reviewed first-party metadata. Stable identities, explicit provenance, deterministic classification, immutable event records, and separate run reports remain repository managed. API-only models and metadata corrections enter through issue forms and reviewed pull requests.

The pipeline does not call inference models, rank model quality, or require paid provider keys. “Latest” means most recently released or first observed, never “best.” Storage and dashboard boundaries remain abstract enough to add other public feeds or evidence-backed benchmarks later.

## Consequences

The first useful dataset can run daily at no inference cost and can be audited from source evidence. Coverage depends on tracked public sources and maintainer-reviewed additions, while automatic category assignment remains intentionally conservative. Future benchmark data can complement release intelligence without replacing its event contract.
