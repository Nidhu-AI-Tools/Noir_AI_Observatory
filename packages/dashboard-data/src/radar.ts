import type { Observation } from "@noir/core";
import type { RegistrySnapshot } from "@noir/storage";

import type { DashboardHealthStatus } from "./health";

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
  createdAt: string;
  updatedAt: string;
  activity: {
    total: number;
    last24Hours: number;
    last7Days: number;
    last30Days: number;
    lastObservedAt?: string;
    status: RadarActivityStatus;
  };
  latestObservation?: DashboardObservation;
  linkedMonitor?: {
    id: string;
    displayName: string;
    status: DashboardHealthStatus;
    enabled: boolean;
  };
}

export interface RadarDashboardData {
  schemaVersion: 2;
  generatedAt: string;
  summary: {
    tracked: number;
    enabled: number;
    disabled: number;
    categories: number;
    withActivity: number;
    activeLast7Days: number;
  };
  filters: {
    categories: { id: string; name: string }[];
    tags: string[];
    kinds: RadarSource["kind"][];
    configurationStatuses: ("enabled" | "disabled")[];
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
  options: {
    healthMonitors?: {
      id: string;
      displayName: string;
      linkedSourceId?: string;
      status: DashboardHealthStatus;
      enabled: boolean;
    }[];
  } = {},
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
  const linkedMonitors = new Map<
    string,
    NonNullable<RadarSource["linkedMonitor"]>
  >();
  for (const monitor of [...(options.healthMonitors ?? [])].sort(
    (left, right) =>
      left.displayName.localeCompare(right.displayName) ||
      left.id.localeCompare(right.id),
  )) {
    if (!monitor.linkedSourceId || linkedMonitors.has(monitor.linkedSourceId))
      continue;
    linkedMonitors.set(monitor.linkedSourceId, {
      id: monitor.id,
      displayName: monitor.displayName,
      status: monitor.status,
      enabled: monitor.enabled,
    });
  }
  const sources = snapshot.registry.sources
    .map((source): RadarSource => {
      const activity = bySource.get(source.id) ?? [];
      const latest = activity[0];
      const linkedMonitor = linkedMonitors.get(source.id);
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
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
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
        ...(linkedMonitor ? { linkedMonitor } : {}),
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
    schemaVersion: 2,
    generatedAt: generatedAt.toISOString(),
    summary: {
      tracked: sources.length,
      enabled: sources.filter((source) => source.enabled).length,
      disabled: sources.filter((source) => !source.enabled).length,
      categories: new Set(sources.map((source) => source.category.id)).size,
      withActivity: sources.filter((source) => source.activity.total > 0)
        .length,
      activeLast7Days: sources.filter((source) => source.activity.last7Days > 0)
        .length,
    },
    filters: {
      categories: snapshot.taxonomy.categories
        .filter((category) =>
          sources.some((source) => source.category.id === category.id),
        )
        .map((category) => ({ id: category.id, name: category.name }))
        .sort((left, right) => left.name.localeCompare(right.name)),
      tags: [...new Set(sources.flatMap((source) => source.tags))].sort(),
      kinds: [...new Set(sources.map((source) => source.kind))].sort(),
      configurationStatuses: ["enabled", "disabled"],
    },
    sources,
  };
}
