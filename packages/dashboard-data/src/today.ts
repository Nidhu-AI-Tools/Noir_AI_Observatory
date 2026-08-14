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

export interface TodaySection<T> {
  total: number;
  items: T[];
}

export interface TodayHealthTransition {
  id: string;
  monitorId: string;
  displayName: string;
  url: string;
  at: string;
  from: HealthCheck["status"];
  to: HealthCheck["status"];
}

export interface TodayCounts {
  ecosystem: number;
  models: number;
  papers: number;
  announcements: number;
  healthTransitions: number;
  totalSignals: number;
}

export interface TodayIndexEntry {
  date: string;
  curated: boolean;
  collectionStatus?: CollectionRunReport["status"];
  counts: TodayCounts;
}

export interface TodayIndexData {
  schemaVersion: 1;
  generatedAt: string;
  editions: TodayIndexEntry[];
}

export interface TodayEditionData {
  schemaVersion: 1;
  generatedAt: string;
  lastUpdatedAt: string;
  date: string;
  counts: TodayCounts;
  collectionRun?: {
    runId: string;
    status: CollectionRunReport["status"];
    finishedAt: string;
    succeeded: number;
    failed: number;
    truncated: number;
  };
  researchRun?: {
    runId: string;
    status: ResearchRunReport["status"];
    finishedAt: string;
    fetched: number;
    added: number;
    failed: number;
  };
  curationNote?: CurationNote;
  sections: {
    ecosystem: TodaySection<DashboardObservation>;
    models: TodaySection<ModelReleaseEvent>;
    research: TodaySection<DashboardResearchItem>;
    health: TodaySection<TodayHealthTransition>;
  };
}

export interface TodayBuildResult {
  index: TodayIndexData;
  editions: Map<string, TodayEditionData>;
}

export interface TodaySectionLimits {
  ecosystem: number;
  models: number;
  research: number;
  health: number;
}

const defaultLimits: TodaySectionLimits = {
  ecosystem: 6,
  models: 6,
  research: 8,
  health: 6,
};

function latest<T>(
  values: T[],
  timestamp: (value: T) => string,
): T | undefined {
  return [...values].sort((left, right) =>
    timestamp(right).localeCompare(timestamp(left)),
  )[0];
}

function latestTimestamp(values: Array<string | undefined>): string {
  const timestamps = values.filter((value): value is string => Boolean(value));
  if (!timestamps.length)
    throw new Error("A Today edition requires at least one source timestamp.");
  return timestamps.sort().at(-1)!;
}

function releaseKindPriority(kind: ModelReleaseEvent["releaseKind"]): number {
  return kind === "initial-release" || kind === "new-version"
    ? 0
    : kind === "deprecation" || kind === "retirement"
      ? 1
      : 2;
}

function healthPriority(status: HealthCheck["status"]): number {
  return status === "down" ? 0 : status === "degraded" ? 1 : 2;
}

function buildHealthTransitions(
  checks: HealthCheck[],
  registry: MonitorRegistry | undefined,
  generatedAt: string,
): TodayHealthTransition[] {
  const monitorById = new Map(
    (registry?.monitors ?? []).map((monitor) => [monitor.id, monitor]),
  );
  const grouped = new Map<string, HealthCheck[]>();
  for (const check of checks.filter((item) => item.checkedAt <= generatedAt))
    grouped.set(check.monitorId, [
      ...(grouped.get(check.monitorId) ?? []),
      check,
    ]);
  const transitions: TodayHealthTransition[] = [];
  for (const [monitorId, values] of grouped) {
    const chronological = [...values].sort((left, right) =>
      left.checkedAt.localeCompare(right.checkedAt),
    );
    for (let index = 1; index < chronological.length; index += 1) {
      const previous = chronological[index - 1];
      const current = chronological[index];
      if (!previous || !current || previous.status === current.status) continue;
      const monitor = monitorById.get(monitorId);
      transitions.push({
        id: `health:${monitorId}:${current.checkedAt}`,
        monitorId,
        displayName: monitor?.displayName ?? monitorId,
        url: monitor?.url ?? "",
        at: current.checkedAt,
        from: previous.status,
        to: current.status,
      });
    }
  }
  return transitions;
}

export function buildTodayDashboardData(
  snapshot: RegistrySnapshot,
  observations: Observation[],
  reports: CollectionRunReport[],
  generatedAt = new Date(),
  options: {
    days?: number;
    limits?: Partial<TodaySectionLimits>;
    healthChecks?: HealthCheck[];
    monitorRegistry?: MonitorRegistry;
    researchItems?: ResearchItem[];
    researchRegistry?: ResearchRegistry;
    researchReports?: ResearchRunReport[];
    modelEvents?: ModelReleaseEvent[];
    curationNotes?: CurationNote[];
  } = {},
): TodayBuildResult {
  const generatedAtIso = generatedAt.toISOString();
  const limits = { ...defaultLimits, ...options.limits };
  const views = buildObservationViews(snapshot, observations).filter(
    (item) => item.occurredAt <= generatedAtIso,
  );
  const modelEvents = (options.modelEvents ?? []).filter(
    (item) => item.occurredAt <= generatedAtIso,
  );
  const promotedObservationIds = new Set(
    modelEvents.flatMap((event) =>
      event.provenance.flatMap((item) =>
        item.observationId ? [item.observationId] : [],
      ),
    ),
  );
  const standaloneViews = views.filter(
    (item) => !promotedObservationIds.has(item.id),
  );
  const researchViews = options.researchRegistry
    ? buildResearchDashboardData(
        options.researchRegistry,
        options.researchItems ?? [],
        options.researchReports ?? [],
        generatedAt,
        Number.MAX_SAFE_INTEGER,
      ).items
    : [];
  const collectionReports = reports.filter(
    (report) => report.finishedAt <= generatedAtIso,
  );
  const researchReports = (options.researchReports ?? []).filter(
    (report) => report.finishedAt <= generatedAtIso,
  );
  const publishedNotes = (options.curationNotes ?? []).filter(
    (note) =>
      note.status === "published" &&
      Boolean(note.reviewedAt && note.reviewedAt <= generatedAtIso),
  );
  const healthTransitions = buildHealthTransitions(
    options.healthChecks ?? [],
    options.monitorRegistry,
    generatedAtIso,
  );
  const dates = [
    ...new Set([
      ...standaloneViews.map((item) => item.occurredAt.slice(0, 10)),
      ...collectionReports.map((item) => item.startedAt.slice(0, 10)),
      ...researchViews.map((item) => item.publishedAt.slice(0, 10)),
      ...researchReports.map((item) => item.startedAt.slice(0, 10)),
      ...modelEvents.map((item) => item.occurredAt.slice(0, 10)),
      ...healthTransitions.map((item) => item.at.slice(0, 10)),
      ...publishedNotes.map((item) => item.date),
    ]),
  ]
    .sort()
    .reverse()
    .slice(0, options.days ?? 90);
  const editions = new Map<string, TodayEditionData>();

  for (const date of dates) {
    const ecosystem = standaloneViews.filter(
      (item) => item.occurredAt.slice(0, 10) === date,
    );
    const models = modelEvents.filter(
      (item) => item.occurredAt.slice(0, 10) === date,
    );
    const research = researchViews.filter(
      (item) => item.publishedAt.slice(0, 10) === date,
    );
    const health = healthTransitions.filter(
      (item) => item.at.slice(0, 10) === date,
    );
    const collectionRun = latest(
      collectionReports.filter(
        (report) => report.startedAt.slice(0, 10) === date,
      ),
      (report) => report.finishedAt,
    );
    const researchRun = latest(
      researchReports.filter(
        (report) => report.startedAt.slice(0, 10) === date,
      ),
      (report) => report.finishedAt,
    );
    const curationNote = publishedNotes.find((note) => note.date === date);
    const curatedIds = new Set(curationNote?.sourceIds ?? []);
    const curatedUrls = new Set(
      curationNote?.highlights.map((highlight) => highlight.sourceUrl) ?? [],
    );
    const isCurated = (id: string, url: string) =>
      curatedIds.has(id) || curatedUrls.has(url);
    const visibleEcosystem = ecosystem
      .filter((item) => !isCurated(item.id, item.url))
      .sort(
        (left, right) =>
          Number(Boolean(left.release?.prerelease)) -
            Number(Boolean(right.release?.prerelease)) ||
          right.occurredAt.localeCompare(left.occurredAt) ||
          left.id.localeCompare(right.id),
      );
    const visibleModels = models
      .filter(
        (event) =>
          !isCurated(
            event.id,
            event.links[0]?.url ?? event.provenance[0]!.url,
          ) &&
          !event.provenance.some(
            (item) => item.observationId && curatedIds.has(item.observationId),
          ),
      )
      .sort(
        (left, right) =>
          releaseKindPriority(left.releaseKind) -
            releaseKindPriority(right.releaseKind) ||
          right.occurredAt.localeCompare(left.occurredAt) ||
          left.id.localeCompare(right.id),
      );
    const visibleResearch = research
      .filter((item) => !isCurated(item.id, item.url))
      .sort(
        (left, right) =>
          right.matchScore - left.matchScore ||
          right.publishedAt.localeCompare(left.publishedAt) ||
          left.id.localeCompare(right.id),
      );
    const visibleHealth = health
      .filter((item) => !isCurated(item.id, item.url))
      .sort(
        (left, right) =>
          healthPriority(left.to) - healthPriority(right.to) ||
          right.at.localeCompare(left.at) ||
          left.id.localeCompare(right.id),
      );
    const papers = research.filter(
      (item) => item.type === "research_paper",
    ).length;
    const announcements = research.length - papers;
    const counts: TodayCounts = {
      ecosystem: ecosystem.length,
      models: models.length,
      papers,
      announcements,
      healthTransitions: health.length,
      totalSignals:
        ecosystem.length + models.length + research.length + health.length,
    };
    editions.set(date, {
      schemaVersion: 1,
      generatedAt: generatedAtIso,
      lastUpdatedAt: latestTimestamp([
        collectionRun?.finishedAt,
        researchRun?.finishedAt,
        ...ecosystem.map((item) => item.collectedAt),
        ...models.map((item) => item.collectedAt),
        ...research.map((item) => item.collectedAt),
        ...health.map((item) => item.at),
        curationNote?.reviewedAt,
      ]),
      date,
      counts,
      ...(collectionRun
        ? {
            collectionRun: {
              runId: collectionRun.runId,
              status: collectionRun.status,
              finishedAt: collectionRun.finishedAt,
              succeeded: collectionRun.totals.succeeded,
              failed: collectionRun.totals.failed,
              truncated: collectionRun.sources.filter(
                (source) => source.status === "truncated",
              ).length,
            },
          }
        : {}),
      ...(researchRun
        ? {
            researchRun: {
              runId: researchRun.runId,
              status: researchRun.status,
              finishedAt: researchRun.finishedAt,
              fetched: researchRun.totals.fetched,
              added: researchRun.totals.added,
              failed: researchRun.totals.failed,
            },
          }
        : {}),
      ...(curationNote ? { curationNote } : {}),
      sections: {
        ecosystem: {
          total: ecosystem.length,
          items: visibleEcosystem.slice(0, limits.ecosystem),
        },
        models: {
          total: models.length,
          items: visibleModels.slice(0, limits.models),
        },
        research: {
          total: research.length,
          items: visibleResearch.slice(0, limits.research),
        },
        health: {
          total: health.length,
          items: visibleHealth.slice(0, limits.health),
        },
      },
    });
  }

  return {
    index: {
      schemaVersion: 1,
      generatedAt: generatedAtIso,
      editions: dates.map((date) => {
        const edition = editions.get(date);
        if (!edition) throw new Error(`Missing Today edition for ${date}.`);
        return {
          date,
          curated: Boolean(edition.curationNote),
          ...(edition.collectionRun
            ? { collectionStatus: edition.collectionRun.status }
            : {}),
          counts: edition.counts,
        };
      }),
    },
    editions,
  };
}
