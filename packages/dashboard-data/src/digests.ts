import type { CollectionRunReport, Observation } from "@noir/core";
import type { RegistrySnapshot } from "@noir/storage";

import {
  buildObservationViews,
  type DashboardObservation,
} from "./observation-view";

export interface DigestIndexEntry {
  date: string;
  observations: number;
  releases: number;
  modelRevisions: number;
  runStatus?: "success" | "partial" | "failure";
}

export interface DigestIndexData {
  schemaVersion: 1;
  generatedAt: string;
  dates: DigestIndexEntry[];
}

export interface DailyDigestData {
  schemaVersion: 1;
  generatedAt: string;
  date: string;
  summary: {
    observations: number;
    displayed: number;
    hidden: number;
    releases: number;
    modelRevisions: number;
  };
  latestRun?: {
    runId: string;
    status: "success" | "partial" | "failure";
    finishedAt: string;
    succeeded: number;
    failed: number;
    truncated: number;
  };
  categories: {
    id: string;
    name: string;
    observations: number;
    sources: {
      id: string;
      displayName: string;
      observations: DashboardObservation[];
    }[];
  }[];
}

export interface DigestBuildResult {
  index: DigestIndexData;
  daily: Map<string, DailyDigestData>;
}

export function buildDigestDashboardData(
  snapshot: RegistrySnapshot,
  observations: Observation[],
  reports: CollectionRunReport[],
  generatedAt = new Date(),
  options: { days?: number; observationsPerDay?: number } = {},
): DigestBuildResult {
  const dayLimit = options.days ?? 90;
  const observationLimit = options.observationsPerDay ?? 500;
  const views = buildObservationViews(snapshot, observations);
  const observationDates = views.map((item) => item.occurredAt.slice(0, 10));
  const reportDates = reports.map((item) => item.startedAt.slice(0, 10));
  const dates = [...new Set([...observationDates, ...reportDates])]
    .sort()
    .reverse()
    .slice(0, dayLimit);
  const daily = new Map<string, DailyDigestData>();

  for (const date of dates) {
    const allForDate = views.filter(
      (item) => item.occurredAt.slice(0, 10) === date,
    );
    const displayed = allForDate.slice(0, observationLimit);
    const latestRun = reports
      .filter((report) => report.startedAt.slice(0, 10) === date)
      .sort((left, right) =>
        right.finishedAt.localeCompare(left.finishedAt),
      )[0];
    const grouped = new Map<string, DashboardObservation[]>();
    for (const observation of displayed) {
      grouped.set(observation.category.id, [
        ...(grouped.get(observation.category.id) ?? []),
        observation,
      ]);
    }
    const categories = [...grouped.entries()]
      .map(([categoryId, categoryObservations]) => {
        const sources = new Map<string, DashboardObservation[]>();
        for (const observation of categoryObservations) {
          sources.set(observation.source.id, [
            ...(sources.get(observation.source.id) ?? []),
            observation,
          ]);
        }
        return {
          id: categoryId,
          name: categoryObservations[0]?.category.name ?? categoryId,
          observations: categoryObservations.length,
          sources: [...sources.entries()]
            .map(([sourceId, sourceObservations]) => ({
              id: sourceId,
              displayName:
                sourceObservations[0]?.source.displayName ?? sourceId,
              observations: sourceObservations,
            }))
            .sort((left, right) =>
              left.displayName.localeCompare(right.displayName),
            ),
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));

    daily.set(date, {
      schemaVersion: 1,
      generatedAt: generatedAt.toISOString(),
      date,
      summary: {
        observations: allForDate.length,
        displayed: displayed.length,
        hidden: Math.max(0, allForDate.length - displayed.length),
        releases: allForDate.filter((item) => item.type === "github_release")
          .length,
        modelRevisions: allForDate.filter(
          (item) => item.type === "huggingface_model_revision",
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
              truncated: latestRun.sources.filter(
                (source) => source.status === "truncated",
              ).length,
            },
          }
        : {}),
      categories,
    });
  }

  return {
    index: {
      schemaVersion: 1,
      generatedAt: generatedAt.toISOString(),
      dates: dates.map((date) => {
        const digest = daily.get(date);
        if (!digest) throw new Error(`Missing digest for ${date}.`);
        return {
          date,
          observations: digest.summary.observations,
          releases: digest.summary.releases,
          modelRevisions: digest.summary.modelRevisions,
          ...(digest.latestRun ? { runStatus: digest.latestRun.status } : {}),
        };
      }),
    },
    daily,
  };
}
