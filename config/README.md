# Configuration

This directory contains human-managed, versioned configuration.

- `sources.yaml` is the canonical registry of tracked GitHub repositories and Hugging Face organizations.
- `taxonomy.yaml` defines stable categories referenced by sources.
- `monitors.yaml` defines public HTTPS endpoints, expected statuses, latency thresholds, and optional source links.
- `research-sources.yaml` defines arXiv queries and official public RSS or Atom feeds.

Use the source-management commands rather than editing YAML when possible. They normalize tags, detect duplicates, verify providers, and write files atomically.

Source IDs and category IDs are immutable. Display names, descriptions, source categories, tags, and enabled state can be edited. Disabling is preferred to deletion so future historical data retains its source relationship.

Configuration will be validated before collection. Secrets must be referenced by environment-variable name and must never be stored here.
