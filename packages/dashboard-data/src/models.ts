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

export type ModelCatalogEntry = {
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

export interface ModelRadarDashboardData {
  schemaVersion: 2;
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
    modelId?: string;
  }[];
  filters: {
    categories: { id: string; name: string }[];
    organizations: string[];
    availability: string[];
    lifecycle: string[];
  };
  models: ModelCatalogEntry[];
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

export function buildModelRadarDashboardData(
  categories: ModelCategoryRegistry,
  events: ModelReleaseEvent[],
  reports: ModelIntelligenceRunReport[],
  generatedAt = new Date(),
): ModelRadarDashboardData {
  const generatedAtIso = generatedAt.toISOString();
  const visibleEvents = events.filter(
    (event) => event.occurredAt <= generatedAtIso,
  );
  const categoryNames = new Map(
    categories.categories.map((category) => [category.id, category.name]),
  );
  const grouped = new Map<string, ModelReleaseEvent[]>();
  for (const event of visibleEvents)
    grouped.set(event.modelId, [...(grouped.get(event.modelId) ?? []), event]);
  const models = [...grouped.entries()]
    .map(([id, values]): ModelCatalogEntry => {
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
  const now = generatedAt.valueOf();
  const sortedEvents = [...visibleEvents].sort(
    (a, b) =>
      b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id),
  );
  const within = (event: ModelReleaseEvent, days: number) =>
    now - new Date(event.occurredAt).valueOf() <= days * 86_400_000;
  const today = sortedEvents.filter(
    (event) => event.occurredAt.slice(0, 10) === generatedAtIso.slice(0, 10),
  );
  const todayKinds = today.map(classifyPublicModelSignal);
  const latestRun = [...reports]
    .filter((report) => report.finishedAt <= generatedAtIso)
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))[0];
  return {
    schemaVersion: 2,
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
      revisionsToday: todayKinds.filter((value) => value === "revision").length,
    },
    ...(latestRun ? { latestRun } : {}),
    latestByCategory: categories.categories.map((category) => {
      const model = models.find((item) =>
        item.categories.includes(category.id),
      );
      return {
        id: category.id,
        name: category.name,
        ...(model ? { modelId: model.id } : {}),
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
    models,
  };
}
