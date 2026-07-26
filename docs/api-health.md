# API health monitoring

Phase 4 samples public HTTPS APIs from GitHub-hosted Ubuntu runners. It reports **observed availability**, not contractual uptime: scheduled jobs can be delayed, measurements come from one non-guaranteed location, and the default cadence is four checks per day.

## Configuration

`config/monitors.yaml` is the canonical registry. Monitor URLs and methods are immutable so historical measurements keep one meaning. Display metadata, expected statuses, thresholds, tags, categories, optional source links, and enabled state can be edited.

Only HTTPS `GET` and `HEAD` endpoints are accepted. URLs containing credentials or credential-like query parameters, localhost, private IPv4 ranges, or IPv6 literals are rejected. Redirects are limited to three and must remain on the original HTTPS host. Response bodies are never read or stored.

## Commands

```bash
pnpm monitor:list
pnpm monitor:add
pnpm monitor:edit MONITOR_ID
pnpm monitor:check MONITOR_ID
pnpm monitor:disable MONITOR_ID
pnpm monitor:enable MONITOR_ID
pnpm monitor:validate
pnpm health:run -- --dry-run
pnpm health:run -- --monitor MONITOR_ID
pnpm health:validate
pnpm generate:health
```

An unexpected status, timeout, or network error becomes a `down` sample. It does not fail the monitoring workflow; failure to validate configuration or persist the dataset does.

## Automation and data

The **Monitor API health** workflow runs at minute 23 every six hours and supports manual execution for all monitors or one monitor ID. Collection and health workflows share a non-cancelling repository-write concurrency group.

Samples and reports are committed under:

```text
data/health-checks/YYYY/MM/DD.jsonl
data/health-runs/YYYY/MM/DD/RUN_ID.json
```

Dashboard details retain the newest 30 days and at most 500 samples per monitor. Canonical JSONL history remains available in `data/`.

## Remote management

Use **Add monitor** or **Request edit** on the API Health page. Review the public endpoint, apply the `monitor:approved` label, then review and merge the generated pull request. Never put a token in an issue or monitor URL.

Authenticated probes, POST requests, response assertions, notifications, multi-region monitoring, and formal SLA calculations are deferred.
