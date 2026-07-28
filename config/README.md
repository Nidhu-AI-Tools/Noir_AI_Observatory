# Configuration

This directory contains human-managed, versioned configuration.

- `sources.yaml` is the canonical registry of tracked GitHub repositories and Hugging Face organizations.
- `taxonomy.yaml` defines stable categories referenced by sources.
- `monitors.yaml` defines public HTTPS endpoints, expected statuses, latency thresholds, and optional source links.
- `research-sources.yaml` defines arXiv queries and official public RSS or Atom feeds.
- `model-categories.yaml` defines the stable Model Radar taxonomy.
- `model-overrides.yaml` stores reviewed metadata for API-only models and corrections to automatically observed models.
- `model-intelligence.yaml` bounds daily release-event materialization.
- `curation.yaml` configures bounded evidence selection and the local Ollama default. It contains no credentials.

Use the source-management commands rather than editing YAML when possible. They normalize tags, detect duplicates, verify providers, and write files atomically.

Source IDs and category IDs are immutable. Display names, descriptions, source categories, tags, and enabled state can be edited. Disabling is preferred to deletion so future historical data retains its source relationship.

Configuration will be validated before collection. Model Intelligence uses public observations and needs no paid model API credentials. Secrets used by other collectors must be referenced by environment-variable name and must never be stored here.
