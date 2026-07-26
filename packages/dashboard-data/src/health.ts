import type { HealthCheck, HealthRunReport, MonitorRegistry } from "@noir/core";
import type { RegistrySnapshot } from "@noir/storage";

export type DashboardHealthStatus =
  "healthy" | "degraded" | "down" | "stale" | "unknown" | "disabled";
export interface HealthMonitorSummary {
  id: string;
  displayName: string;
  description?: string;
  url: string;
  method: "GET" | "HEAD";
  category: { id: string; name: string };
  tags: string[];
  linkedSourceId?: string;
  enabled: boolean;
  status: DashboardHealthStatus;
  lastCheck?: HealthCheck;
  consecutiveFailures: number;
  windows: {
    last24Hours: HealthWindow;
    last7Days: HealthWindow;
    last30Days: HealthWindow;
  };
}
export interface HealthWindow {
  checks: number;
  observedAvailability: number | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
}
export interface HealthIndexData {
  schemaVersion: 1;
  generatedAt: string;
  summary: {
    total: number;
    enabled: number;
    healthy: number;
    degraded: number;
    down: number;
    stale: number;
    unknown: number;
    observedAvailability24Hours: number | null;
  };
  latestRun?: HealthRunReport;
  filters: { categories: { id: string; name: string }[]; tags: string[] };
  monitors: HealthMonitorSummary[];
}
export interface HealthMonitorDetailData {
  schemaVersion: 1;
  generatedAt: string;
  monitor: HealthMonitorSummary;
  checks: HealthCheck[];
  transitions: {
    at: string;
    from: HealthCheck["status"];
    to: HealthCheck["status"];
  }[];
}
export interface HealthDashboardBuild {
  index: HealthIndexData;
  details: Map<string, HealthMonitorDetailData>;
}

function percentile(values: number[], percentileValue: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return (
    sorted[
      Math.min(
        sorted.length - 1,
        Math.ceil(percentileValue * sorted.length) - 1,
      )
    ] ?? null
  );
}
function window(
  checks: HealthCheck[],
  now: number,
  milliseconds: number,
): HealthWindow {
  const selected = checks.filter((item) => {
    const value = new Date(item.checkedAt).valueOf();
    return value <= now && value >= now - milliseconds;
  });
  const responsive = selected.filter((item) => item.expectedStatus);
  const latencies = responsive.map((item) => item.latencyMs);
  return {
    checks: selected.length,
    observedAvailability: selected.length
      ? responsive.length / selected.length
      : null,
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
  };
}
function status(
  enabled: boolean,
  last: HealthCheck | undefined,
  now: number,
): DashboardHealthStatus {
  if (!enabled) return "disabled";
  if (!last) return "unknown";
  if (now - new Date(last.checkedAt).valueOf() > 54_000_000) return "stale";
  return last.status;
}
export function buildHealthDashboardData(
  registry: MonitorRegistry,
  snapshot: RegistrySnapshot,
  checks: HealthCheck[],
  reports: HealthRunReport[],
  generatedAt = new Date(),
): HealthDashboardBuild {
  const now = generatedAt.valueOf();
  const categories = new Map(
    snapshot.taxonomy.categories.map((item) => [item.id, item.name]),
  );
  const byMonitor = new Map<string, HealthCheck[]>();
  for (const check of [...checks]
    .filter((item) => new Date(item.checkedAt).valueOf() <= now)
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt)))
    byMonitor.set(check.monitorId, [
      ...(byMonitor.get(check.monitorId) ?? []),
      check,
    ]);
  const monitors = registry.monitors
    .map((monitor): HealthMonitorSummary => {
      const monitorChecks = byMonitor.get(monitor.id) ?? [];
      const last = monitorChecks[0];
      let consecutiveFailures = 0;
      for (const check of monitorChecks) {
        if (check.status !== "down") break;
        consecutiveFailures += 1;
      }
      return {
        id: monitor.id,
        displayName: monitor.displayName,
        ...(monitor.description ? { description: monitor.description } : {}),
        url: monitor.url,
        method: monitor.method,
        category: {
          id: monitor.categoryId,
          name: categories.get(monitor.categoryId) ?? monitor.categoryId,
        },
        tags: monitor.tags,
        ...(monitor.linkedSourceId
          ? { linkedSourceId: monitor.linkedSourceId }
          : {}),
        enabled: monitor.enabled,
        status: status(monitor.enabled, last, now),
        ...(last ? { lastCheck: last } : {}),
        consecutiveFailures,
        windows: {
          last24Hours: window(monitorChecks, now, 86_400_000),
          last7Days: window(monitorChecks, now, 604_800_000),
          last30Days: window(monitorChecks, now, 2_592_000_000),
        },
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const all24 = window(checks, now, 86_400_000);
  const index: HealthIndexData = {
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
    summary: {
      total: monitors.length,
      enabled: monitors.filter((item) => item.enabled).length,
      healthy: monitors.filter((item) => item.status === "healthy").length,
      degraded: monitors.filter((item) => item.status === "degraded").length,
      down: monitors.filter((item) => item.status === "down").length,
      stale: monitors.filter((item) => item.status === "stale").length,
      unknown: monitors.filter((item) => item.status === "unknown").length,
      observedAvailability24Hours: all24.observedAvailability,
    },
    ...([...reports].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))[0]
      ? {
          latestRun: [...reports].sort((a, b) =>
            b.finishedAt.localeCompare(a.finishedAt),
          )[0],
        }
      : {}),
    filters: {
      categories: [...new Set(monitors.map((item) => item.category.id))]
        .map((id) => ({ id, name: categories.get(id) ?? id }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      tags: [...new Set(monitors.flatMap((item) => item.tags))].sort(),
    },
    monitors,
  };
  const details = new Map<string, HealthMonitorDetailData>();
  for (const monitor of monitors) {
    const monitorChecks = (byMonitor.get(monitor.id) ?? [])
      .filter(
        (item) => now - new Date(item.checkedAt).valueOf() <= 2_592_000_000,
      )
      .slice(0, 500);
    const chronological = [...monitorChecks].reverse();
    const transitions: HealthMonitorDetailData["transitions"] = [];
    for (let i = 1; i < chronological.length; i += 1) {
      const previous = chronological[i - 1];
      const current = chronological[i];
      if (previous && current && previous.status !== current.status)
        transitions.push({
          at: current.checkedAt,
          from: previous.status,
          to: current.status,
        });
    }
    details.set(monitor.id, {
      schemaVersion: 1,
      generatedAt: generatedAt.toISOString(),
      monitor,
      checks: monitorChecks,
      transitions: transitions.reverse(),
    });
  }
  return { index, details };
}
