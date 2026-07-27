import type {
  ModelCategoryRegistry,
  ModelIntelligenceRunReport,
  ModelReleaseEvent,
} from "@noir/core";

export type ModelCatalogEntry = {
  id: string;
  canonicalName: string;
  organization: string;
  externalModelId?: string;
  currentVersion?: string;
  categories: string[];
  categoryNames: string[];
  tags: string[];
  modalities: string[];
  availability: ModelReleaseEvent["availability"];
  lifecycle: ModelReleaseEvent["lifecycle"];
  license?: string;
  parameterCount?: string;
  contextWindow?: string;
  links: ModelReleaseEvent["links"];
  latestReleaseAt: string;
  latestReleaseAtInferred: boolean;
  firstObservedAt: string;
  lastObservedAt: string;
  releaseCount: number;
  latestEvent: ModelReleaseEvent;
  releases: ModelReleaseEvent[];
};

export interface ModelRadarDashboardData {
  schemaVersion: 1;
  generatedAt: string;
  definition: string;
  summary: {
    models: number;
    releasesToday: number;
    releases7Days: number;
    openWeightModels: number;
    apiModels: number;
    activeOrganizations: number;
  };
  latestRun?: ModelIntelligenceRunReport;
  latestByCategory: {
    id: string;
    name: string;
    model?: ModelCatalogEntry;
  }[];
  filters: {
    categories: { id: string; name: string }[];
    organizations: string[];
    availability: string[];
    modalities: string[];
    lifecycle: string[];
  };
  models: ModelCatalogEntry[];
  recentEvents: ModelReleaseEvent[];
}

export function buildModelRadarDashboardData(
  categories: ModelCategoryRegistry,
  events: ModelReleaseEvent[],
  reports: ModelIntelligenceRunReport[],
  generatedAt = new Date(),
): ModelRadarDashboardData {
  const categoryNames = new Map(
    categories.categories.map((category) => [category.id, category.name]),
  );
  const grouped = new Map<string, ModelReleaseEvent[]>();
  for (const event of events)
    grouped.set(event.modelId, [...(grouped.get(event.modelId) ?? []), event]);
  const models = [...grouped.entries()]
    .map(([id, values]): ModelCatalogEntry => {
      const releases = [...values].sort((a, b) =>
        b.occurredAt.localeCompare(a.occurredAt),
      );
      const latest = releases[0];
      if (!latest) throw new Error(`Model ${id} has no release events.`);
      const firstObservedAt = [...values].sort((a, b) =>
        a.collectedAt.localeCompare(b.collectedAt),
      )[0]!.collectedAt;
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
        modalities: latest.modalities,
        availability: latest.availability,
        lifecycle: latest.lifecycle,
        ...(latest.license ? { license: latest.license } : {}),
        ...(latest.parameterCount
          ? { parameterCount: latest.parameterCount }
          : {}),
        ...(latest.contextWindow
          ? { contextWindow: latest.contextWindow }
          : {}),
        links: latest.links,
        latestReleaseAt: latest.occurredAt,
        latestReleaseAtInferred: latest.occurredAtInferred,
        firstObservedAt,
        lastObservedAt: releases
          .map((event) => event.collectedAt)
          .sort()
          .at(-1)!,
        releaseCount: releases.length,
        latestEvent: latest,
        releases,
      };
    })
    .sort((a, b) => b.latestReleaseAt.localeCompare(a.latestReleaseAt));
  const now = generatedAt.valueOf();
  const recentEvents = [...events].sort((a, b) =>
    b.occurredAt.localeCompare(a.occurredAt),
  );
  const within = (event: ModelReleaseEvent, days: number) =>
    now - new Date(event.occurredAt).valueOf() <= days * 86_400_000;
  const latestRun = [...reports].sort((a, b) =>
    b.finishedAt.localeCompare(a.finishedAt),
  )[0];
  return {
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
    definition:
      "Latest means the most recently published or first-observed release, not the best-performing model.",
    summary: {
      models: models.length,
      releasesToday: recentEvents.filter(
        (event) =>
          event.occurredAt.slice(0, 10) ===
          generatedAt.toISOString().slice(0, 10),
      ).length,
      releases7Days: recentEvents.filter((event) => within(event, 7)).length,
      openWeightModels: models.filter((model) =>
        model.availability.includes("open-weights"),
      ).length,
      apiModels: models.filter((model) => model.availability.includes("api"))
        .length,
      activeOrganizations: new Set(models.map((model) => model.organization))
        .size,
    },
    ...(latestRun ? { latestRun } : {}),
    latestByCategory: categories.categories.map((category) => {
      const model = models.find((item) =>
        item.categories.includes(category.id),
      );
      return {
        id: category.id,
        name: category.name,
        ...(model ? { model } : {}),
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
      modalities: [
        ...new Set(models.flatMap((model) => model.modalities)),
      ].sort(),
      lifecycle: [...new Set(models.map((model) => model.lifecycle))].sort(),
    },
    models,
    recentEvents: recentEvents.slice(0, 500),
  };
}
