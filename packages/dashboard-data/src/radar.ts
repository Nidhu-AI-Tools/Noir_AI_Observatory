import type { Observation } from "@noir/core";
import type { RegistrySnapshot } from "@noir/storage";

import {
  buildObservationViews,
  isWithinWindow,
  type DashboardObservation,
} from "./observation-view";

export type RadarActivityStatus =
  "today" | "this-week" | "this-month" | "earlier" | "none" | "disabled";

export interface RadarSource {
  id: string;
  displayName: string;
  description?: string;
  locator: string;
  externalUrl: string;
  kind: "github_repo" | "huggingface_org";
  category: { id: string; name: string };
  tags: string[];
  enabled: boolean;
  activity: {
    total: number;
    last24Hours: number;
    last7Days: number;
    last30Days: number;
    lastObservedAt?: string;
    status: RadarActivityStatus;
  };
  latestObservation?: DashboardObservation;
}

export interface RadarDashboardData {
  schemaVersion: 1;
  generatedAt: string;
  summary: {
    tracked: number;
    enabled: number;
    withActivity: number;
    activeLast7Days: number;
  };
  filters: {
    categories: { id: string; name: string }[];
    tags: string[];
  };
  sources: RadarSource[];
}

function activityStatus(
  enabled: boolean,
  latest: DashboardObservation | undefined,
  now: Date,
): RadarActivityStatus {
  if (!enabled) return "disabled";
  if (!latest) return "none";
  if (isWithinWindow(latest.occurredAt, now, 86_400_000)) return "today";
  if (isWithinWindow(latest.occurredAt, now, 604_800_000)) return "this-week";
  if (isWithinWindow(latest.occurredAt, now, 2_592_000_000))
    return "this-month";
  return "earlier";
}

export function buildRadarDashboardData(
  snapshot: RegistrySnapshot,
  observations: Observation[],
  generatedAt = new Date(),
): RadarDashboardData {
  const views = buildObservationViews(snapshot, observations);
  const bySource = new Map<string, DashboardObservation[]>();
  for (const observation of views) {
    bySource.set(observation.source.id, [
      ...(bySource.get(observation.source.id) ?? []),
      observation,
    ]);
  }
  const categories = new Map(
    snapshot.taxonomy.categories.map((category) => [category.id, category]),
  );
  const sources = snapshot.registry.sources
    .map((source): RadarSource => {
      const activity = bySource.get(source.id) ?? [];
      const latest = activity[0];
      const category = categories.get(source.categoryId);
      if (!category) {
        throw new Error(
          `Source ${source.id} references unknown category ${source.categoryId}.`,
        );
      }
      return {
        id: source.id,
        displayName: source.displayName,
        ...(source.description ? { description: source.description } : {}),
        locator: source.locator,
        externalUrl:
          source.kind === "github_repo"
            ? `https://github.com/${source.locator}`
            : `https://huggingface.co/${source.locator}`,
        kind: source.kind,
        category: { id: category.id, name: category.name },
        tags: source.tags,
        enabled: source.enabled,
        activity: {
          total: activity.length,
          last24Hours: activity.filter((item) =>
            isWithinWindow(item.occurredAt, generatedAt, 86_400_000),
          ).length,
          last7Days: activity.filter((item) =>
            isWithinWindow(item.occurredAt, generatedAt, 604_800_000),
          ).length,
          last30Days: activity.filter((item) =>
            isWithinWindow(item.occurredAt, generatedAt, 2_592_000_000),
          ).length,
          ...(latest ? { lastObservedAt: latest.occurredAt } : {}),
          status: activityStatus(source.enabled, latest, generatedAt),
        },
        ...(latest ? { latestObservation: latest } : {}),
      };
    })
    .sort(
      (left, right) =>
        Number(right.enabled) - Number(left.enabled) ||
        (right.activity.lastObservedAt ?? "").localeCompare(
          left.activity.lastObservedAt ?? "",
        ) ||
        left.displayName.localeCompare(right.displayName),
    );

  return {
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
    summary: {
      tracked: sources.length,
      enabled: sources.filter((source) => source.enabled).length,
      withActivity: sources.filter((source) => source.activity.total > 0)
        .length,
      activeLast7Days: sources.filter((source) => source.activity.last7Days > 0)
        .length,
    },
    filters: {
      categories: snapshot.taxonomy.categories
        .map((category) => ({ id: category.id, name: category.name }))
        .sort((left, right) => left.name.localeCompare(right.name)),
      tags: [...new Set(sources.flatMap((source) => source.tags))].sort(),
    },
    sources,
  };
}
