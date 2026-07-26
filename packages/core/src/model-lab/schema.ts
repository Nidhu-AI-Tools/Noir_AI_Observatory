import { z } from "zod";

const stableId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const timestamp = z.iso.datetime({ offset: true });

export const modelProviderSchema = z.enum(["openai", "anthropic", "google"]);
export const contentTypeSchema = z.enum([
  "research-paper",
  "model-release",
  "tool-release",
  "company-announcement",
  "dataset-release",
  "benchmark-release",
  "other",
]);
export const lifecycleEventSchema = z.enum([
  "new-release",
  "update",
  "research-result",
  "benchmark-result",
  "funding",
  "acquisition",
  "policy",
  "other",
]);
export const domainLabelSchema = z.enum([
  "agents",
  "reasoning",
  "language-models",
  "multimodal",
  "computer-vision",
  "speech-audio",
  "training",
  "inference",
  "evaluation",
  "safety",
  "rag",
  "vector-search",
  "developer-tools",
  "other",
]);
export const entityTypeSchema = z.enum([
  "model",
  "organization",
  "tool",
  "dataset",
  "benchmark",
  "other",
]);

export const ecosystemClassificationSchema = z
  .object({
    contentType: contentTypeSchema,
    lifecycleEvent: lifecycleEventSchema,
    domains: z.array(domainLabelSchema).max(8),
    entities: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(160),
            type: entityTypeSchema,
          })
          .strict(),
      )
      .max(20),
    evidence: z
      .array(
        z
          .object({
            field: z.enum([
              "contentType",
              "lifecycleEvent",
              "domains",
              "entities",
            ]),
            quote: z.string().trim().min(1).max(300),
          })
          .strict(),
      )
      .max(12),
  })
  .strict();

export const modelProfileSchema = z
  .object({
    id: stableId,
    provider: modelProviderSchema,
    displayName: z.string().trim().min(1).max(120),
    model: z.string().trim().min(1).max(160),
    timeoutMs: z.number().int().min(5_000).max(120_000),
    maxOutputTokens: z.number().int().min(128).max(2_000),
    enabled: z.boolean(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict();

export const modelLabConfigSchema = z
  .object({
    version: z.literal(1),
    policy: z
      .object({
        scheduleEnabled: z.boolean(),
        liveCasesPerRun: z.number().int().min(0).max(3),
        weeklyGoldCases: z.number().int().min(0).max(3),
        maxInputCharacters: z.number().int().min(500).max(10_000),
        maxRequestsPerRun: z.number().int().min(1).max(12),
      })
      .strict(),
    models: z.array(modelProfileSchema),
  })
  .strict()
  .superRefine((config, context) => {
    const ids = new Set<string>();
    for (const [index, profile] of config.models.entries()) {
      if (ids.has(profile.id))
        context.addIssue({
          code: "custom",
          message: `Duplicate model profile ID: ${profile.id}`,
          path: ["models", index, "id"],
        });
      ids.add(profile.id);
    }
  });

export const benchmarkSuiteSchema = z
  .object({
    id: stableId,
    version: z.number().int().positive(),
    displayName: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(500),
    task: z.literal("ecosystem-classification"),
    promptVersion: z.number().int().positive(),
    inputKinds: z
      .array(
        z.enum([
          "github_release",
          "huggingface_model_revision",
          "research_paper",
          "official_announcement",
        ]),
      )
      .min(1),
    enabled: z.boolean(),
  })
  .strict();

export const benchmarkSuiteRegistrySchema = z
  .object({ version: z.literal(1), suites: z.array(benchmarkSuiteSchema) })
  .strict();

export const benchmarkCaseSchema = z
  .object({
    id: stableId,
    suiteId: stableId,
    kind: z.enum(["gold", "live"]),
    title: z.string().trim().min(1).max(300),
    inputText: z.string().trim().min(1).max(10_000),
    sourceItemId: z.string().min(1).max(300).optional(),
    sourceUrl: z.url().optional(),
    publishedAt: timestamp.optional(),
    expected: ecosystemClassificationSchema.optional(),
  })
  .strict()
  .superRefine((item, context) => {
    if (item.kind === "gold" && !item.expected)
      context.addIssue({
        code: "custom",
        message: "Gold cases require an expected output.",
        path: ["expected"],
      });
  });

export const benchmarkCaseRegistrySchema = z
  .object({ version: z.literal(1), cases: z.array(benchmarkCaseSchema) })
  .strict();

export const modelLabResponseStatusSchema = z.enum([
  "success",
  "refusal",
  "timeout",
  "rate-limited",
  "incomplete",
  "schema-invalid",
  "provider-error",
  "missing-secret",
]);

export const modelLabResponseSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1).max(300),
    runId: z.string().min(1).max(200),
    caseId: stableId,
    caseKind: z.enum(["gold", "live"]),
    caseTitle: z.string().trim().min(1).max(300),
    inputText: z.string().trim().min(1).max(10_000),
    sourceItemId: z.string().min(1).max(300).optional(),
    sourceUrl: z.url().optional(),
    suiteId: stableId,
    suiteVersion: z.number().int().positive(),
    provider: modelProviderSchema,
    modelProfileId: stableId,
    requestedModel: z.string().min(1).max(160),
    returnedModel: z.string().max(160).optional(),
    providerResponseId: z.string().max(300).optional(),
    promptHash: z.string().length(64),
    classificationSchemaHash: z.string().length(64),
    inputHash: z.string().length(64),
    modelConfigHash: z.string().length(64),
    startedAt: timestamp,
    finishedAt: timestamp,
    latencyMs: z.number().int().nonnegative(),
    status: modelLabResponseStatusSchema,
    usage: z
      .object({
        inputTokens: z.number().int().nonnegative().optional(),
        outputTokens: z.number().int().nonnegative().optional(),
        cachedInputTokens: z.number().int().nonnegative().optional(),
        reasoningTokens: z.number().int().nonnegative().optional(),
        totalTokens: z.number().int().nonnegative().optional(),
      })
      .strict()
      .optional(),
    output: ecosystemClassificationSchema.optional(),
    rawOutput: z.string().max(20_000).optional(),
    errorCode: z.string().max(100).optional(),
    errorMessage: z.string().max(500).optional(),
  })
  .strict();

export const consensusResultSchema = z
  .object({
    caseId: stableId,
    successfulResponses: z.number().int().nonnegative(),
    status: z.enum([
      "unanimous",
      "majority",
      "split",
      "insufficient-responses",
    ]),
    fields: z
      .object({
        contentType: z
          .object({
            status: z.enum([
              "unanimous",
              "majority",
              "split",
              "insufficient-responses",
            ]),
            majority: contentTypeSchema.optional(),
          })
          .strict(),
        lifecycleEvent: z
          .object({
            status: z.enum([
              "unanimous",
              "majority",
              "split",
              "insufficient-responses",
            ]),
            majority: lifecycleEventSchema.optional(),
          })
          .strict(),
        domainJaccard: z.number().min(0).max(1).nullable(),
        entityJaccard: z.number().min(0).max(1).nullable(),
      })
      .strict(),
    evidenceValidity: z.number().min(0).max(1).nullable(),
    goldScore: z
      .object({
        exactCategorical: z.number().min(0).max(1),
        domainF1: z.number().min(0).max(1),
        entityF1: z.number().min(0).max(1),
      })
      .strict()
      .optional(),
  })
  .strict();

export const modelLabRunReportSchema = z
  .object({
    schemaVersion: z.literal(1),
    runId: z.string().min(1).max(200),
    trigger: z.enum(["schedule", "manual", "local"]),
    startedAt: timestamp,
    finishedAt: timestamp,
    status: z.enum(["success", "partial", "failure", "no-op"]),
    totals: z
      .object({
        cases: z.number().int().nonnegative(),
        planned: z.number().int().nonnegative(),
        executed: z.number().int().nonnegative(),
        reused: z.number().int().nonnegative(),
        successful: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
        skipped: z.number().int().nonnegative(),
        inputTokens: z.number().int().nonnegative(),
        outputTokens: z.number().int().nonnegative(),
      })
      .strict(),
    responseIds: z.array(z.string().min(1).max(300)),
    consensus: z.array(consensusResultSchema),
  })
  .strict();

export type ModelProvider = z.infer<typeof modelProviderSchema>;
export type ModelProfile = z.infer<typeof modelProfileSchema>;
export type ModelLabConfig = z.infer<typeof modelLabConfigSchema>;
export type BenchmarkSuite = z.infer<typeof benchmarkSuiteSchema>;
export type BenchmarkSuiteRegistry = z.infer<
  typeof benchmarkSuiteRegistrySchema
>;
export type BenchmarkCase = z.infer<typeof benchmarkCaseSchema>;
export type BenchmarkCaseRegistry = z.infer<typeof benchmarkCaseRegistrySchema>;
export type EcosystemClassification = z.infer<
  typeof ecosystemClassificationSchema
>;
export type ModelLabResponse = z.infer<typeof modelLabResponseSchema>;
export type ConsensusResult = z.infer<typeof consensusResultSchema>;
export type ModelLabRunReport = z.infer<typeof modelLabRunReportSchema>;
