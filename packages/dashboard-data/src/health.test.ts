import type { HealthCheck, MonitorRegistry } from "@noir/core";
import type { RegistrySnapshot } from "@noir/storage";
import { describe, expect, it } from "vitest";

import { buildHealthDashboardData } from "./health";

const registry: MonitorRegistry = {
  version: 1,
  monitors: [
    {
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
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
};
const snapshot: RegistrySnapshot = {
  registry: { version: 1, sources: [] },
  taxonomy: {
    version: 1,
    categories: [{ id: "developer-tool", name: "Developer Tool" }],
  },
};
function check(
  id: string,
  checkedAt: string,
  status: HealthCheck["status"],
  latencyMs: number,
): HealthCheck {
  return {
    schemaVersion: 1,
    id,
    monitorId: "api-github",
    runId: id,
    checkedAt,
    finishedAt: checkedAt,
    status,
    ...(status === "down"
      ? { statusCode: 503, errorCode: "unexpected-status" as const }
      : { statusCode: 200 }),
    latencyMs,
    expectedStatus: status !== "down",
    vantage: "github-actions-ubuntu",
  };
}

describe("health dashboard aggregation", () => {
  it("calculates current status, availability, percentiles, and transitions", () => {
    const result = buildHealthDashboardData(
      registry,
      snapshot,
      [
        check("one", "2026-07-26T08:00:00.000Z", "healthy", 100),
        check("two", "2026-07-26T10:00:00.000Z", "down", 200),
        check("three", "2026-07-26T11:00:00.000Z", "down", 300),
      ],
      [],
      new Date("2026-07-26T12:00:00.000Z"),
    );
    expect(result.index.summary.observedAvailability24Hours).toBeCloseTo(1 / 3);
    expect(result.index.monitors[0]).toMatchObject({
      status: "down",
      consecutiveFailures: 2,
    });
    expect(result.index.monitors[0]?.windows.last24Hours.p95LatencyMs).toBe(
      100,
    );
    expect(result.details.get("api-github")?.transitions).toHaveLength(1);
  });
  it("marks old samples stale", () => {
    const result = buildHealthDashboardData(
      registry,
      snapshot,
      [check("old", "2026-07-25T00:00:00.000Z", "healthy", 100)],
      [],
      new Date("2026-07-26T12:00:00.000Z"),
    );
    expect(result.index.monitors[0]?.status).toBe("stale");
  });
});
