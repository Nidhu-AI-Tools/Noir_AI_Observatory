import {
  healthRunReportSchema,
  type HealthCheck,
  type HealthRunReport,
} from "@noir/core";
import type {
  HealthCheckStore,
  HealthRunReportStore,
  MonitorRegistryStore,
} from "@noir/storage";

import { probeMonitor, type HttpFetch } from "./probe";

export interface MonitorRunOptions {
  runId: string;
  trigger: "schedule" | "manual" | "local";
  monitorId?: string;
  dryRun?: boolean;
}

export class MonitorRunner {
  constructor(
    private readonly registryStore: MonitorRegistryStore,
    private readonly checkStore: HealthCheckStore,
    private readonly reportStore: HealthRunReportStore,
    private readonly fetcher: HttpFetch = fetch,
    private readonly clock: () => Date = () => new Date(),
  ) {}
  async run(options: MonitorRunOptions): Promise<{
    report: HealthRunReport;
    checks: HealthCheck[];
    written: number;
  }> {
    const started = this.clock();
    const registry = await this.registryStore.read();
    const selected = options.monitorId
      ? registry.monitors.filter((item) => item.id === options.monitorId)
      : registry.monitors;
    if (options.monitorId && selected.length === 0)
      throw new Error(`Unknown monitor: ${options.monitorId}`);
    const enabled = selected.filter((item) => item.enabled);
    const checks: HealthCheck[] = [];
    for (let index = 0; index < enabled.length; index += 4) {
      checks.push(
        ...(await Promise.all(
          enabled.slice(index, index + 4).map((monitor) =>
            probeMonitor(monitor, options.runId, {
              fetcher: this.fetcher,
              clock: this.clock,
              vantage:
                options.trigger === "local" ? "local" : "github-actions-ubuntu",
            }),
          ),
        )),
      );
    }
    const written = options.dryRun ? 0 : await this.checkStore.append(checks);
    const monitors = selected.map((monitor) => {
      if (!monitor.enabled)
        return {
          monitorId: monitor.id,
          status: "skipped" as const,
          latencyMs: 0,
        };
      const check = checks.find((item) => item.monitorId === monitor.id);
      if (!check)
        return {
          monitorId: monitor.id,
          status: "failed" as const,
          latencyMs: 0,
          error: "Probe did not return a result.",
        };
      return {
        monitorId: monitor.id,
        status: check.status,
        latencyMs: check.latencyMs,
      };
    });
    const internalFailures = monitors.filter(
      (item) => item.status === "failed",
    ).length;
    const report = healthRunReportSchema.parse({
      schemaVersion: 1,
      runId: options.runId,
      trigger: options.trigger,
      startedAt: started.toISOString(),
      finishedAt: this.clock().toISOString(),
      status:
        internalFailures === 0
          ? "success"
          : internalFailures === monitors.length
            ? "failure"
            : "partial",
      totals: {
        configured: selected.length,
        attempted: enabled.length,
        skipped: selected.length - enabled.length,
        healthy: checks.filter((item) => item.status === "healthy").length,
        degraded: checks.filter((item) => item.status === "degraded").length,
        down: checks.filter((item) => item.status === "down").length,
        internalFailures,
      },
      monitors,
    });
    if (!options.dryRun && selected.length > 0)
      await this.reportStore.write(report);
    return { report, checks, written };
  }
}
