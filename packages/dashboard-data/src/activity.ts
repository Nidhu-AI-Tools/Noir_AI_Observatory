import type { CollectionRunReport, Observation } from "@noir/core";

export interface ActivityDashboardData {
  schemaVersion: 1;
  generatedAt: string;
  summary: {
    releases: number;
    modelRevisions: number;
    last24Hours: number;
    last7Days: number;
  };
  latestRun?: {
    runId: string;
    status: "success" | "partial" | "failure";
    startedAt: string;
    finishedAt: string;
    observations: number;
    succeeded: number;
    failed: number;
  };
  filters: {
    categories: string[];
    tags: string[];
    types: Observation["type"][];
  };
  recent: Observation[];
}

export function buildActivityDashboardData(
  observations: Observation[],
  reports: CollectionRunReport[],
  generatedAt = new Date(),
  recentLimit = 200,
): ActivityDashboardData {
  const now = generatedAt.valueOf();
  const sorted = [...observations].sort(
    (left, right) =>
      right.occurredAt.localeCompare(left.occurredAt) ||
      left.id.localeCompare(right.id),
  );
  const latest = [...reports].sort((left, right) =>
    right.finishedAt.localeCompare(left.finishedAt),
  )[0];
  const categories = [
    ...new Set(observations.map((item) => item.categoryId)),
  ].sort();
  const tags = [
    ...new Set(observations.flatMap((item) => item.sourceTags)),
  ].sort();
  const types = [
    ...new Set(observations.map((item) => item.type)),
  ].sort() as Observation["type"][];
  return {
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
    summary: {
      releases: observations.filter((item) => item.type === "github_release")
        .length,
      modelRevisions: observations.filter(
        (item) => item.type === "huggingface_model_revision",
      ).length,
      last24Hours: observations.filter(
        (item) => now - new Date(item.occurredAt).valueOf() <= 86_400_000,
      ).length,
      last7Days: observations.filter(
        (item) => now - new Date(item.occurredAt).valueOf() <= 604_800_000,
      ).length,
    },
    ...(latest
      ? {
          latestRun: {
            runId: latest.runId,
            status: latest.status,
            startedAt: latest.startedAt,
            finishedAt: latest.finishedAt,
            observations: latest.totals.observations,
            succeeded: latest.totals.succeeded,
            failed: latest.totals.failed,
          },
        }
      : {}),
    filters: { categories, tags, types },
    recent: sorted.slice(0, recentLimit),
  };
}
