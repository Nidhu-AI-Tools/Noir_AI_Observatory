import type {
  ModelCategoryRegistry,
  ModelIntelligenceRunReport,
  ModelReleaseEvent,
} from "@noir/core";

export type PublicModelSignalKind =
  | "confirmed-release"
  | "first-observed"
  | "revision"
  | "lifecycle-change"
  | "other-update";

export type ModelCardEntry = {
  id: string;
  canonicalName: string;
  organization: string;
  externalModelId?: string;
  currentVersion?: string;
  categories: string[];
  categoryNames: string[];
  tags: string[];
  availability: ModelReleaseEvent["availability"];
  lifecycle: ModelReleaseEvent["lifecycle"];
  license?: string;
  links: ModelReleaseEvent["links"];
  latestSignalAt: string;
  latestSignalKind: PublicModelSignalKind;
  signalCount: number;
};

export type ModelCatalogEntry = Omit<ModelCardEntry, "links"> & {
  page: number;
};

/** Compact, stable search/filter record for the initial Models page load. */
export type ModelCatalogRecord = {
  i: string;
  n: string;
  o: string;
  x?: string;
  c: string[];
  t: string[];
  a: ModelReleaseEvent["availability"];
  l: ModelReleaseEvent["lifecycle"];
  p: number;
};

export interface ModelRadarDashboardData {
  schemaVersion: 3;
  generatedAt: string;
  definition: string;
  summary: {
    models: number;
    signalsToday: number;
    signals7Days: number;
    confirmedReleasesToday: number;
    firstObservedToday: number;
    revisionsToday: number;
  };
  latestRun?: ModelIntelligenceRunReport;
  latestByCategory: {
    id: string;
    name: string;
    model?: Pick<
      ModelCatalogEntry,
      | "id"
      | "canonicalName"
      | "organization"
      | "latestSignalAt"
      | "latestSignalKind"
    >;
  }[];
  filters: {
    categories: { id: string; name: string }[];
    organizations: string[];
    availability: string[];
    lifecycle: string[];
  };
  pagination: { pageSize: number; pages: number };
}

export interface ModelRadarCatalogData {
  schemaVersion: 1;
  generatedAt: string;
  models: ModelCatalogRecord[];
}

export interface ModelRadarPageData {
  schemaVersion: 1;
  generatedAt: string;
  page: number;
  models: ModelCardEntry[];
}

export interface ModelRadarDashboardBundle {
  index: ModelRadarDashboardData;
  catalog: ModelRadarCatalogData;
  pages: ModelRadarPageData[];
}

export function classifyPublicModelSignal(
  event: ModelReleaseEvent,
): PublicModelSignalKind {
  if (event.releaseKind === "deprecation" || event.releaseKind === "retirement")
    return "lifecycle-change";
  const sourceKinds = new Set(event.provenance.map((value) => value.kind));
  if (event.releaseKind === "update")
    return sourceKinds.has("huggingface-model") ? "revision" : "other-update";
  if (
    event.occurredAtInferred ||
    (event.releaseKind === "initial-release" &&
      sourceKinds.size === 1 &&
      sourceKinds.has("huggingface-model"))
  )
    return "first-observed";
  if (
    (event.releaseKind === "initial-release" ||
      event.releaseKind === "new-version") &&
    [...sourceKinds].some((kind) =>
      ["github-release", "official-announcement", "manual"].includes(kind),
    )
  )
    return "confirmed-release";
  return "other-update";
}

function modelCards(
  categories: ModelCategoryRegistry,
  events: ModelReleaseEvent[],
  generatedAtIso: string,
) {
  const categoryNames = new Map(
    categories.categories.map((category) => [category.id, category.name]),
  );
  const grouped = new Map<string, ModelReleaseEvent[]>();
  for (const event of events)
    if (event.occurredAt <= generatedAtIso)
      grouped.set(event.modelId, [
        ...(grouped.get(event.modelId) ?? []),
        event,
      ]);
  return [...grouped.entries()]
    .map(([id, values]): ModelCardEntry => {
      const signals = [...values].sort(
        (a, b) =>
          b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id),
      );
      const latest = signals[0];
      if (!latest) throw new Error(`Model ${id} has no signals.`);
      return {
        id,
        canonicalName: latest.canonicalName,
        organization: latest.organization,
        ...(latest.externalModelId
          ? { externalModelId: latest.externalModelId }
          : {}),
        ...(latest.version ? { currentVersion: latest.version } : {}),
        categories: latest.categories,
        categoryNames: latest.categories.map(
          (category) => categoryNames.get(category) ?? category,
        ),
        tags: latest.tags,
        availability: latest.availability,
        lifecycle: latest.lifecycle,
        ...(latest.license ? { license: latest.license } : {}),
        links: latest.links,
        latestSignalAt: latest.occurredAt,
        latestSignalKind: classifyPublicModelSignal(latest),
        signalCount: signals.length,
      };
    })
    .sort(
      (a, b) =>
        b.latestSignalAt.localeCompare(a.latestSignalAt) ||
        a.id.localeCompare(b.id),
    );
}

export function buildModelRadarDashboardData(
  categories: ModelCategoryRegistry,
  events: ModelReleaseEvent[],
  reports: ModelIntelligenceRunReport[],
  generatedAt = new Date(),
  pageSize = 24,
): ModelRadarDashboardBundle {
  const generatedAtIso = generatedAt.toISOString();
  const models = modelCards(categories, events, generatedAtIso);
  const pages = Array.from(
    { length: Math.ceil(models.length / pageSize) },
    (_, index): ModelRadarPageData => ({
      schemaVersion: 1,
      generatedAt: generatedAtIso,
      page: index + 1,
      models: models.slice(index * pageSize, (index + 1) * pageSize),
    }),
  );
  const catalogModels = models.map((model, index) => ({
    i: model.id,
    n: model.canonicalName,
    o: model.organization,
    ...(model.externalModelId ? { x: model.externalModelId } : {}),
    c: model.categories,
    t: model.tags,
    a: model.availability,
    l: model.lifecycle,
    p: Math.floor(index / pageSize) + 1,
  }));
  const sortedEvents = events
    .filter((event) => event.occurredAt <= generatedAtIso)
    .sort(
      (a, b) =>
        b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id),
    );
  const now = generatedAt.valueOf();
  const within = (event: ModelReleaseEvent, days: number) =>
    now - new Date(event.occurredAt).valueOf() <= days * 86_400_000;
  const today = sortedEvents.filter(
    (event) => event.occurredAt.slice(0, 10) === generatedAtIso.slice(0, 10),
  );
  const todayKinds = today.map(classifyPublicModelSignal);
  const latestRun = [...reports]
    .filter((report) => report.finishedAt <= generatedAtIso)
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))[0];
  const compact = (model: ModelCardEntry) => ({
    id: model.id,
    canonicalName: model.canonicalName,
    organization: model.organization,
    latestSignalAt: model.latestSignalAt,
    latestSignalKind: model.latestSignalKind,
  });
  return {
    index: {
      schemaVersion: 3,
      generatedAt: generatedAtIso,
      definition:
        "Latest means the newest tracked model signal. Confirmed releases, first observations, revisions, and lifecycle changes are counted separately.",
      summary: {
        models: models.length,
        signalsToday: today.length,
        signals7Days: sortedEvents.filter((event) => within(event, 7)).length,
        confirmedReleasesToday: todayKinds.filter(
          (value) => value === "confirmed-release",
        ).length,
        firstObservedToday: todayKinds.filter(
          (value) => value === "first-observed",
        ).length,
        revisionsToday: todayKinds.filter((value) => value === "revision")
          .length,
      },
      ...(latestRun ? { latestRun } : {}),
      latestByCategory: categories.categories.map((category) => {
        const model = models.find((item) =>
          item.categories.includes(category.id),
        );
        return {
          id: category.id,
          name: category.name,
          ...(model ? { model: compact(model) } : {}),
        };
      }),
      filters: {
        categories: categories.categories.map(({ id, name }) => ({ id, name })),
        organizations: [
          ...new Set(models.map((model) => model.organization)),
        ].sort(),
        availability: [
          ...new Set(models.flatMap((model) => model.availability)),
        ].sort(),
        lifecycle: [...new Set(models.map((model) => model.lifecycle))].sort(),
      },
      pagination: { pageSize, pages: pages.length },
    },
    catalog: {
      schemaVersion: 1,
      generatedAt: generatedAtIso,
      models: catalogModels,
    },
    pages,
  };
}
