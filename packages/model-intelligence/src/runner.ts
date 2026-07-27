import {
  modelIntelligenceRunReportSchema,
  modelReleaseEventSchema,
  type HuggingFaceModelObservation,
  type ModelOverride,
  type ModelReleaseEvent,
} from "@noir/core";
import type {
  ModelCategoryStore,
  ModelIntelligenceConfigStore,
  ModelIntelligenceRunReportStore,
  ModelOverrideStore,
  ModelReleaseEventStore,
  ObservationStore,
  RegistryStore,
} from "@noir/storage";

import { classifyObservation } from "./classification";
import { modelIdForExternalId, stableHash } from "./identity";

function eventFromObservation(
  item: HuggingFaceModelObservation,
  organization: string,
  knownModel: ModelOverride | undefined,
  hasPriorRelease: boolean,
): ModelReleaseEvent {
  const classified = classifyObservation(item);
  const externalId = item.details.modelId;
  const modelId = knownModel?.id ?? modelIdForExternalId(externalId);
  const canonicalName =
    knownModel?.canonicalName ?? externalId.split("/").at(-1) ?? externalId;
  return modelReleaseEventSchema.parse({
    schemaVersion: 1,
    id: `model-event-${stableHash(item.id).slice(0, 32)}`,
    modelId,
    canonicalName,
    organization: knownModel?.organization ?? organization,
    externalModelId: externalId,
    releaseKind: hasPriorRelease ? "update" : "initial-release",
    ...(item.details.revision ? { version: item.details.revision } : {}),
    occurredAt: item.occurredAt,
    occurredAtInferred: false,
    collectedAt: item.collectedAt,
    categories: knownModel?.categories ?? classified.categories,
    tags: knownModel?.tags.length ? knownModel.tags : classified.tags,
    modalities: knownModel?.modalities.length
      ? knownModel.modalities
      : classified.modalities,
    availability: knownModel?.availability ?? classified.availability,
    lifecycle: knownModel?.lifecycle ?? "active",
    ...(knownModel?.license ? { license: knownModel.license } : {}),
    ...(knownModel?.parameterCount
      ? { parameterCount: knownModel.parameterCount }
      : {}),
    ...(knownModel?.contextWindow
      ? { contextWindow: knownModel.contextWindow }
      : {}),
    links: knownModel?.links.length
      ? knownModel.links
      : [{ kind: "model-card", url: item.url }],
    provenance: [
      {
        kind: "huggingface-model",
        sourceId: item.sourceId,
        url: item.url,
        observedAt: item.collectedAt,
      },
    ],
  });
}
function eventFromManual(
  model: ModelOverride,
  hasPriorRelease: boolean,
): ModelReleaseEvent {
  const occurredAt = model.releasedAt ?? model.updatedAt;
  const sourceUrl = model.links[0]?.url;
  if (!sourceUrl)
    throw new Error(
      `Manual model ${model.id} requires at least one source link.`,
    );
  return modelReleaseEventSchema.parse({
    schemaVersion: 1,
    id: `model-event-${stableHash({ id: model.id, updatedAt: model.updatedAt }).slice(0, 32)}`,
    modelId: model.id,
    canonicalName: model.canonicalName,
    organization: model.organization,
    ...(model.externalModelId
      ? { externalModelId: model.externalModelId }
      : {}),
    releaseKind:
      model.lifecycle === "deprecated"
        ? "deprecation"
        : model.lifecycle === "retired"
          ? "retirement"
          : hasPriorRelease
            ? model.currentVersion
              ? "new-version"
              : "update"
            : "initial-release",
    ...(model.currentVersion ? { version: model.currentVersion } : {}),
    occurredAt,
    occurredAtInferred: !model.releasedAt || model.releasedAtInferred,
    collectedAt: model.updatedAt,
    categories: model.categories,
    tags: model.tags,
    modalities: model.modalities,
    availability: model.availability,
    lifecycle: model.lifecycle,
    ...(model.license ? { license: model.license } : {}),
    ...(model.parameterCount ? { parameterCount: model.parameterCount } : {}),
    ...(model.contextWindow ? { contextWindow: model.contextWindow } : {}),
    links: model.links,
    provenance: [
      {
        kind: "manual",
        sourceId: model.id,
        url: sourceUrl,
        observedAt: model.updatedAt,
      },
    ],
  });
}

export class ModelIntelligenceRunner {
  constructor(
    private readonly config: ModelIntelligenceConfigStore,
    private readonly categories: ModelCategoryStore,
    private readonly overrides: ModelOverrideStore,
    private readonly registry: RegistryStore,
    private readonly observations: ObservationStore,
    private readonly events: ModelReleaseEventStore,
    private readonly reports: ModelIntelligenceRunReportStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}
  async run(options: {
    runId: string;
    trigger: "schedule" | "manual" | "local";
    dryRun?: boolean;
  }) {
    const started = this.clock();
    const [config, categories, overrides, snapshot, observations, existing] =
      await Promise.all([
        this.config.read(),
        this.categories.read(),
        this.overrides.read(),
        this.registry.read(),
        this.observations.readAll(),
        this.events.readAll(),
      ]);
    const categoryIds = new Set(categories.categories.map((item) => item.id));
    for (const model of overrides.models)
      for (const category of model.categories)
        if (!categoryIds.has(category))
          throw new Error(
            `Model ${model.id} references unknown category ${category}.`,
          );
    const knownIds = new Set(existing.map((event) => event.id));
    const modelsWithReleases = new Set(existing.map((event) => event.modelId));
    const sourceNames = new Map(
      snapshot.registry.sources.map((source) => [
        source.id,
        source.displayName,
      ]),
    );
    const byExternal = new Map(
      overrides.models.flatMap((model) =>
        model.externalModelId ? [[model.externalModelId, model] as const] : [],
      ),
    );
    const eligible = observations
      .filter(
        (item): item is HuggingFaceModelObservation =>
          item.type === "huggingface_model_revision",
      )
      .sort(
        (left, right) =>
          left.occurredAt.localeCompare(right.occurredAt) ||
          left.id.localeCompare(right.id),
      );
    const candidates: ModelReleaseEvent[] = [];
    const errors: string[] = [];
    for (const item of eligible) {
      try {
        const knownModel = byExternal.get(item.details.modelId);
        const modelId =
          knownModel?.id ?? modelIdForExternalId(item.details.modelId);
        candidates.push(
          eventFromObservation(
            item,
            sourceNames.get(item.sourceId) ??
              item.details.modelId.split("/")[0] ??
              "Unknown",
            knownModel,
            modelsWithReleases.has(modelId),
          ),
        );
        modelsWithReleases.add(modelId);
      } catch (error) {
        errors.push(
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Unknown model event error",
        );
      }
    }
    for (const model of overrides.models.filter((item) => item.enabled)) {
      try {
        candidates.push(
          eventFromManual(model, modelsWithReleases.has(model.id)),
        );
        modelsWithReleases.add(model.id);
      } catch (error) {
        errors.push(
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Unknown manual model error",
        );
      }
    }
    const unique = candidates
      .filter((event) => !knownIds.has(event.id))
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
      .slice(0, config.policy.maxEventsPerRun);
    if (!options.dryRun && unique.length) await this.events.append(unique);
    const report = modelIntelligenceRunReportSchema.parse({
      schemaVersion: 1,
      runId: options.runId,
      trigger: options.trigger,
      startedAt: started.toISOString(),
      finishedAt: this.clock().toISOString(),
      status: errors.length
        ? unique.length
          ? "partial"
          : "failure"
        : unique.length
          ? "success"
          : "no-op",
      totals: {
        observations: observations.length,
        eligible: eligible.length,
        produced: unique.length,
        duplicates: candidates.length - unique.length,
        manualModels: overrides.models.filter((item) => item.enabled).length,
        failed: errors.length,
      },
      eventIds: unique.map((event) => event.id),
      errors: errors.slice(0, 100),
    });
    if (!options.dryRun) await this.reports.write(report);
    return { report, events: unique };
  }
}
