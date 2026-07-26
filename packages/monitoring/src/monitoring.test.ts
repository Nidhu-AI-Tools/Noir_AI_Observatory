import {
  monitorConfigSchema,
  type HealthCheck,
  type HealthRunReport,
  type MonitorConfig,
  type MonitorRegistry,
} from "@noir/core";
import type {
  HealthCheckStore,
  HealthRunReportStore,
  MonitorRegistryStore,
} from "@noir/storage";
import { describe, expect, it } from "vitest";

import { probeMonitor } from "./probe";
import { MonitorRunner } from "./monitor-runner";

const monitor: MonitorConfig = monitorConfigSchema.parse({
  id: "api-github",
  displayName: "GitHub API",
  url: "https://api.github.com/",
  method: "GET",
  expectedStatuses: [200],
  timeoutMs: 10_000,
  degradedAfterMs: 1_500,
  categoryId: "developer-tool",
  tags: ["github"],
  enabled: true,
  createdAt: "2026-07-26T00:00:00.000Z",
  updatedAt: "2026-07-26T00:00:00.000Z",
});
function clock(...milliseconds: number[]) {
  let index = 0;
  return () => new Date(milliseconds[index++] ?? milliseconds.at(-1) ?? 0);
}

describe("API monitoring", () => {
  it("rejects private, non-HTTPS, credential-bearing, and invalid thresholds", () => {
    for (const url of [
      "http://example.com",
      "https://localhost/health",
      "https://user:secret@example.com",
      "https://192.168.1.1/health",
      "https://[::1]/health",
      "https://example.com/health?api_key=secret",
    ]) {
      expect(() => monitorConfigSchema.parse({ ...monitor, url })).toThrow();
    }
    expect(() =>
      monitorConfigSchema.parse({ ...monitor, degradedAfterMs: 10_000 }),
    ).toThrow();
  });
  it("classifies expected fast and slow responses", async () => {
    const healthy = await probeMonitor(monitor, "run-1", {
      fetcher: async () => new Response(null, { status: 200 }),
      clock: clock(0, 200),
    });
    const degraded = await probeMonitor(monitor, "run-2", {
      fetcher: async () => new Response(null, { status: 200 }),
      clock: clock(0, 2_000),
    });
    expect(healthy).toMatchObject({
      status: "healthy",
      latencyMs: 200,
      expectedStatus: true,
    });
    expect(degraded).toMatchObject({
      status: "degraded",
      latencyMs: 2_000,
      expectedStatus: true,
    });
  });
  it("records unexpected status and network errors as down observations", async () => {
    const unexpected = await probeMonitor(monitor, "run-3", {
      fetcher: async () => new Response(null, { status: 503 }),
      clock: clock(0, 100),
    });
    const timeout = await probeMonitor(monitor, "run-4", {
      fetcher: async () => {
        throw new Error("request timeout");
      },
      clock: clock(0, 10_000),
    });
    expect(unexpected).toMatchObject({
      status: "down",
      statusCode: 503,
      errorCode: "unexpected-status",
    });
    expect(timeout).toMatchObject({ status: "down", errorCode: "timeout" });
  });
  it("rejects redirects to a different host", async () => {
    const check = await probeMonitor(monitor, "run-5", {
      fetcher: async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://attacker.example/" },
        }),
      clock: clock(0, 10),
    });
    expect(check).toMatchObject({ status: "down", errorCode: "redirect" });
  });
  it("treats endpoint downtime as successful monitoring data", async () => {
    const checks: HealthCheck[] = [];
    const reports: HealthRunReport[] = [];
    const registryStore: MonitorRegistryStore = {
      read: async (): Promise<MonitorRegistry> => ({
        version: 1,
        monitors: [monitor],
      }),
      write: async () => undefined,
    };
    const checkStore: HealthCheckStore = {
      readAll: async () => checks,
      append: async (items) => {
        checks.push(...items);
        return items.length;
      },
    };
    const reportStore: HealthRunReportStore = {
      readAll: async () => reports,
      write: async (report) => {
        reports.push(report);
      },
    };
    const runner = new MonitorRunner(
      registryStore,
      checkStore,
      reportStore,
      async () => new Response(null, { status: 503 }),
      clock(0, 100, 200),
    );
    const result = await runner.run({
      runId: "scheduled-1",
      trigger: "schedule",
    });
    expect(result.report.status).toBe("success");
    expect(result.report.totals.down).toBe(1);
    expect(checks).toHaveLength(1);
    expect(reports).toHaveLength(1);
    expect(checks[0]?.vantage).toBe("github-actions-ubuntu");
  });
});
