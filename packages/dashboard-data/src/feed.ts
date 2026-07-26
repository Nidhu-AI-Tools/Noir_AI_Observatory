import type { CollectionRunReport, Observation } from "@noir/core";
import type { RegistrySnapshot } from "@noir/storage";

import {
  buildObservationViews,
  isWithinWindow,
  type DashboardObservation,
} from "./observation-view";

export interface DashboardFeedData {
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
    finishedAt: string;
    succeeded: number;
    failed: number;
  };
  recent: DashboardObservation[];
  categories: { id: string; name: string; observations: number }[];
}

export function buildDashboardFeedData(
  snapshot: RegistrySnapshot,
  observations: Observation[],
  reports: CollectionRunReport[],
  generatedAt = new Date(),
  recentLimit = 20,
): DashboardFeedData {
  const views = buildObservationViews(snapshot, observations);
  const latestRun = [...reports].sort((left, right) =>
    right.finishedAt.localeCompare(left.finishedAt),
  )[0];
  const categoryCounts = new Map<string, { name: string; count: number }>();
  for (const observation of views) {
    const current = categoryCounts.get(observation.category.id);
    categoryCounts.set(observation.category.id, {
      name: observation.category.name,
      count: (current?.count ?? 0) + 1,
    });
  }
  return {
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
    summary: {
      releases: views.filter((item) => item.type === "github_release").length,
      modelRevisions: views.filter(
        (item) => item.type === "huggingface_model_revision",
      ).length,
      last24Hours: views.filter((item) =>
        isWithinWindow(item.occurredAt, generatedAt, 86_400_000),
      ).length,
      last7Days: views.filter((item) =>
        isWithinWindow(item.occurredAt, generatedAt, 604_800_000),
      ).length,
    },
    ...(latestRun
      ? {
          latestRun: {
            runId: latestRun.runId,
            status: latestRun.status,
            finishedAt: latestRun.finishedAt,
            succeeded: latestRun.totals.succeeded,
            failed: latestRun.totals.failed,
          },
        }
      : {}),
    recent: views.slice(0, recentLimit),
    categories: [...categoryCounts.entries()]
      .map(([id, value]) => ({
        id,
        name: value.name,
        observations: value.count,
      }))
      .sort(
        (left, right) =>
          right.observations - left.observations ||
          left.name.localeCompare(right.name),
      ),
  };
}
