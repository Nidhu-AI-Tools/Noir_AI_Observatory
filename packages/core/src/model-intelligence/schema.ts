import { z } from "zod";

const stableId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const timestamp = z.iso.datetime({ offset: true });
const shortText = z.string().trim().min(1).max(200);

export const modelCategorySchema = z
  .object({
    id: stableId,
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(500),
  })
  .strict();

export const modelCategoryRegistrySchema = z
  .object({ version: z.literal(1), categories: z.array(modelCategorySchema) })
  .strict()
  .superRefine((registry, context) => {
    const ids = new Set<string>();
    registry.categories.forEach((category, index) => {
      if (ids.has(category.id))
        context.addIssue({
          code: "custom",
          message: `Duplicate model category: ${category.id}`,
          path: ["categories", index, "id"],
        });
      ids.add(category.id);
    });
  });

export const modelAvailabilitySchema = z.enum([
  "open-weights",
  "downloadable",
  "gated",
  "api",
  "unknown",
]);
export const modelLifecycleSchema = z.enum(["active", "deprecated", "retired"]);
export const modelReleaseKindSchema = z.enum([
  "initial-release",
  "new-version",
  "update",
  "deprecation",
  "retirement",
]);
export const modelSourceKindSchema = z.enum([
  "huggingface-model",
  "github-release",
  "official-announcement",
  "research-paper",
  "manual",
]);

export const modelLinkSchema = z
  .object({
    kind: z.enum([
      "model-card",
      "repository",
      "announcement",
      "paper",
      "api-docs",
      "homepage",
    ]),
    url: z.url(),
    label: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const modelProvenanceSchema = z
  .object({
    kind: modelSourceKindSchema,
    sourceId: z.string().min(1).max(300),
    observationId: z.string().min(1).max(300).optional(),
    url: z.url(),
    observedAt: timestamp,
  })
  .strict();

export const modelOverrideSchema = z
  .object({
    id: stableId,
    canonicalName: z.string().trim().min(1).max(200),
    organization: z.string().trim().min(1).max(160),
    aliases: z.array(shortText).max(30),
    categories: z.array(stableId).min(1).max(8),
    tags: z.array(stableId).max(30),
    modalities: z.array(stableId).max(12),
    availability: z.array(modelAvailabilitySchema).min(1),
    lifecycle: modelLifecycleSchema,
    externalModelId: z.string().trim().min(1).max(300).optional(),
    currentVersion: z.string().trim().min(1).max(160).optional(),
    releasedAt: timestamp.optional(),
    releasedAtInferred: z.boolean().default(false),
    license: z.string().trim().min(1).max(160).optional(),
    parameterCount: z.string().trim().min(1).max(80).optional(),
    contextWindow: z.string().trim().min(1).max(80).optional(),
    links: z.array(modelLinkSchema).max(20),
    notes: z.string().trim().max(1_000).optional(),
    enabled: z.boolean(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict();

export const modelOverrideRegistrySchema = z
  .object({ version: z.literal(1), models: z.array(modelOverrideSchema) })
  .strict()
  .superRefine((registry, context) => {
    const ids = new Set<string>();
    registry.models.forEach((model, index) => {
      if (ids.has(model.id))
        context.addIssue({
          code: "custom",
          message: `Duplicate model ID: ${model.id}`,
          path: ["models", index, "id"],
        });
      ids.add(model.id);
    });
  });

export const modelReleaseEventSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1).max(300),
    modelId: stableId,
    canonicalName: z.string().trim().min(1).max(200),
    organization: z.string().trim().min(1).max(160),
    externalModelId: z.string().trim().min(1).max(300).optional(),
    releaseKind: modelReleaseKindSchema,
    version: z.string().trim().min(1).max(160).optional(),
    occurredAt: timestamp,
    occurredAtInferred: z.boolean(),
    collectedAt: timestamp,
    categories: z.array(stableId).min(1).max(8),
    tags: z.array(stableId).max(30),
    modalities: z.array(stableId).max(12),
    availability: z.array(modelAvailabilitySchema).min(1),
    lifecycle: modelLifecycleSchema,
    license: z.string().trim().min(1).max(160).optional(),
    parameterCount: z.string().trim().min(1).max(80).optional(),
    contextWindow: z.string().trim().min(1).max(80).optional(),
    links: z.array(modelLinkSchema).max(20),
    provenance: z.array(modelProvenanceSchema).min(1).max(20),
  })
  .strict();

export const modelIntelligencePolicySchema = z
  .object({ maxEventsPerRun: z.number().int().min(1).max(1_000) })
  .strict();
export const modelIntelligenceConfigSchema = z
  .object({ version: z.literal(1), policy: modelIntelligencePolicySchema })
  .strict();

export const modelIntelligenceRunReportSchema = z
  .object({
    schemaVersion: z.literal(1),
    runId: z.string().min(1).max(200),
    trigger: z.enum(["schedule", "manual", "local"]),
    startedAt: timestamp,
    finishedAt: timestamp,
    status: z.enum(["success", "partial", "failure", "no-op"]),
    totals: z
      .object({
        observations: z.number().int().nonnegative(),
        eligible: z.number().int().nonnegative(),
        produced: z.number().int().nonnegative(),
        duplicates: z.number().int().nonnegative(),
        manualModels: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
      })
      .strict(),
    eventIds: z.array(z.string().min(1).max(300)),
    errors: z.array(z.string().max(500)).max(100),
  })
  .strict();

export type ModelCategoryRegistry = z.infer<typeof modelCategoryRegistrySchema>;
export type ModelOverride = z.infer<typeof modelOverrideSchema>;
export type ModelOverrideRegistry = z.infer<typeof modelOverrideRegistrySchema>;
export type ModelReleaseEvent = z.infer<typeof modelReleaseEventSchema>;
export type ModelIntelligenceConfig = z.infer<
  typeof modelIntelligenceConfigSchema
>;
export type ModelIntelligenceRunReport = z.infer<
  typeof modelIntelligenceRunReportSchema
>;
export type ModelAvailability = z.infer<typeof modelAvailabilitySchema>;
