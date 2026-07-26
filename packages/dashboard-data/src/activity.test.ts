import {
  collectionRunReportSchema,
  createObservationId,
  observationSchema,
} from "@noir/core";
import { describe, expect, it } from "vitest";

import { buildActivityDashboardData } from "./activity";

describe("buildActivityDashboardData", () => {
  it("builds current totals and latest run metadata", () => {
    const observation = observationSchema.parse({
      schemaVersion: 1,
      id: createObservationId("github_release", "github-test-test", "1"),
      type: "github_release",
      provider: "github",
      sourceId: "github-test-test",
      externalId: "1",
      title: "v1",
      url: "https://github.com/test/test/releases/tag/v1",
      occurredAt: "2026-07-26T11:00:00.000Z",
      collectedAt: "2026-07-26T12:00:00.000Z",
      categoryId: "developer-tool",
      sourceTags: ["llm"],
      details: {
        releaseId: "1",
        tagName: "v1",
        createdAt: "2026-07-26T10:00:00.000Z",
        publishedAt: "2026-07-26T11:00:00.000Z",
        prerelease: false,
        assetCount: 0,
      },
    });
    const report = collectionRunReportSchema.parse({
      schemaVersion: 1,
      runId: "1",
      trigger: "local",
      startedAt: "2026-07-26T12:00:00.000Z",
      finishedAt: "2026-07-26T12:01:00.000Z",
      status: "success",
      totals: {
        configured: 1,
        attempted: 1,
        succeeded: 1,
        failed: 0,
        skipped: 0,
        observations: 1,
      },
      sources: [],
    });
    const data = buildActivityDashboardData(
      [observation],
      [report],
      new Date("2026-07-26T12:00:00.000Z"),
    );
    expect(data.summary).toEqual({
      releases: 1,
      modelRevisions: 0,
      last24Hours: 1,
      last7Days: 1,
    });
    expect(data.latestRun?.runId).toBe("1");
  });
});
