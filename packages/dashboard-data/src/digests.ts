import type {
  CollectionRunReport,
  CurationNote,
  HealthCheck,
  MonitorRegistry,
  ModelReleaseEvent,
  Observation,
  ResearchItem,
  ResearchRegistry,
  ResearchRunReport,
} from "@noir/core";
import type { RegistrySnapshot } from "@noir/storage";

import {
  buildObservationViews,
  type DashboardObservation,
} from "./observation-view";
import {
  buildResearchDashboardData,
  type DashboardResearchItem,
} from "./research";

export interface DigestIndexEntry {
  date: string;
  observations: number;
  releases: number;
  modelRevisions: number;
  healthTransitions: number;
  papers: number;
  announcements: number;
  modelReleases: number;
  curated: boolean;
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
    healthTransitions: number;
    papers: number;
    announcements: number;
    modelReleases: number;
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
  healthEvents: {
    monitorId: string;
    displayName: string;
    url: string;
    at: string;
    from: HealthCheck["status"];
    to: HealthCheck["status"];
  }[];
  researchItems: DashboardResearchItem[];
  modelEvents: ModelReleaseEvent[];
  curationNote?: CurationNote;
  latestResearchRun?: ResearchRunReport;
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
  options: {
    days?: number;
    observationsPerDay?: number;
    healthChecks?: HealthCheck[];
    monitorRegistry?: MonitorRegistry;
    researchItems?: ResearchItem[];
    researchRegistry?: ResearchRegistry;
    researchReports?: ResearchRunReport[];
    modelEvents?: ModelReleaseEvent[];
    curationNotes?: CurationNote[];
  } = {},
): DigestBuildResult {
  const dayLimit = options.days ?? 90;
  const observationLimit = options.observationsPerDay ?? 500;
  const views = buildObservationViews(snapshot, observations);
  const observationDates = views.map((item) => item.occurredAt.slice(0, 10));
  const reportDates = reports.map((item) => item.startedAt.slice(0, 10));
  const researchViews = options.researchRegistry
    ? buildResearchDashboardData(
        options.researchRegistry,
        options.researchItems ?? [],
        options.researchReports ?? [],
        generatedAt,
      ).items
    : [];
  const researchDates = researchViews.map((item) =>
    item.publishedAt.slice(0, 10),
  );
  const researchReportDates = (options.researchReports ?? []).map((item) =>
    item.startedAt.slice(0, 10),
  );
  const modelEventDates = (options.modelEvents ?? []).map((item) =>
    item.occurredAt.slice(0, 10),
  );
  const publishedNotes = (options.curationNotes ?? []).filter(
    (note) => note.status === "published",
  );
  const curationDates = publishedNotes.map((note) => note.date);
  const monitorById = new Map(
    (options.monitorRegistry?.monitors ?? []).map((item) => [item.id, item]),
  );
  const healthEvents: DailyDigestData["healthEvents"] = [];
  const checksByMonitor = new Map<string, HealthCheck[]>();
  for (const check of options.healthChecks ?? [])
    checksByMonitor.set(check.monitorId, [
      ...(checksByMonitor.get(check.monitorId) ?? []),
      check,
    ]);
  for (const [monitorId, monitorChecks] of checksByMonitor) {
    const chronological = [...monitorChecks].sort((a, b) =>
      a.checkedAt.localeCompare(b.checkedAt),
    );
    for (let index = 1; index < chronological.length; index += 1) {
      const previous = chronological[index - 1];
      const current = chronological[index];
      if (!previous || !current || previous.status === current.status) continue;
      const monitor = monitorById.get(monitorId);
      healthEvents.push({
        monitorId,
        displayName: monitor?.displayName ?? monitorId,
        url: monitor?.url ?? "",
        at: current.checkedAt,
        from: previous.status,
        to: current.status,
      });
    }
  }
  const dates = [
    ...new Set([
      ...observationDates,
      ...reportDates,
      ...healthEvents.map((item) => item.at.slice(0, 10)),
      ...researchDates,
      ...researchReportDates,
      ...modelEventDates,
      ...curationDates,
    ]),
  ]
    .sort()
    .reverse()
    .slice(0, dayLimit);
  const daily = new Map<string, DailyDigestData>();

  for (const date of dates) {
    const allForDate = views.filter(
      (item) => item.occurredAt.slice(0, 10) === date,
    );
    const displayed = allForDate.slice(0, observationLimit);
    const dailyHealthEvents = healthEvents
      .filter((item) => item.at.slice(0, 10) === date)
      .sort((a, b) => b.at.localeCompare(a.at));
    const dailyResearch = researchViews.filter(
      (item) => item.publishedAt.slice(0, 10) === date,
    );
    const dailyModelEvents = (options.modelEvents ?? [])
      .filter((item) => item.occurredAt.slice(0, 10) === date)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    const curationNote = publishedNotes.find((note) => note.date === date);
    const latestResearchRun = (options.researchReports ?? [])
      .filter((report) => report.startedAt.slice(0, 10) === date)
      .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))[0];
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
        healthTransitions: dailyHealthEvents.length,
        papers: dailyResearch.filter((item) => item.type === "research_paper")
          .length,
        announcements: dailyResearch.filter(
          (item) => item.type === "official_announcement",
        ).length,
        modelReleases: dailyModelEvents.length,
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
      healthEvents: dailyHealthEvents,
      researchItems: dailyResearch,
      modelEvents: dailyModelEvents,
      ...(curationNote ? { curationNote } : {}),
      ...(latestResearchRun ? { latestResearchRun } : {}),
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
          healthTransitions: digest.summary.healthTransitions,
          papers: digest.summary.papers,
          announcements: digest.summary.announcements,
          modelReleases: digest.summary.modelReleases,
          curated: Boolean(digest.curationNote),
          ...(digest.latestRun ? { runStatus: digest.latestRun.status } : {}),
        };
      }),
    },
    daily,
  };
}
