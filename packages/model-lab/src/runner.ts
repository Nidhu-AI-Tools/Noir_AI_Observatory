import {
  modelLabResponseSchema,
  modelLabRunReportSchema,
  type BenchmarkCase,
  type ModelLabResponse,
  type ModelLabRunReport,
} from "@noir/core";
import type {
  BenchmarkCaseStore,
  BenchmarkSuiteStore,
  ModelLabConfigStore,
  ModelLabResponseStore,
  ModelLabRunReportStore,
  ObservationStore,
  ResearchItemStore,
} from "@noir/storage";

import { ModelProviderRegistry, providerSecretNames } from "./adapters";
import { sha256 } from "./hash";
import {
  CLASSIFICATION_SCHEMA_HASH,
  MODEL_LAB_PROMPT_HASH,
  renderPrompt,
} from "./prompt";
import { calculateConsensus } from "./scoring";
import { selectBenchmarkCases } from "./selection";

export interface ModelLabRunOptions {
  runId: string;
  trigger: "schedule" | "manual" | "local";
  caseId?: string;
  modelProfileId?: string;
  dryRun?: boolean;
  retryFailed?: boolean;
  scheduleGate?: boolean;
}
function profileHash(profile: {
  provider: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
}) {
  return sha256(profile);
}
function inputHash(item: BenchmarkCase) {
  return sha256({
    title: item.title,
    inputText: item.inputText,
    sourceItemId: item.sourceItemId,
  });
}
function executionId(item: BenchmarkCase, modelConfigHash: string) {
  return `lab:${sha256({ caseId: item.id, inputHash: inputHash(item), promptHash: MODEL_LAB_PROMPT_HASH, schemaHash: CLASSIFICATION_SCHEMA_HASH, modelConfigHash })}`;
}
function sanitized(value: string | undefined) {
  return value
    ?.replace(
      /(Bearer|api[-_]?key|token)\s*[:=]?\s*[A-Za-z0-9._-]+/gi,
      "$1 [redacted]",
    )
    .slice(0, 500);
}

export class ModelLabRunner {
  constructor(
    private readonly configStore: ModelLabConfigStore,
    private readonly suiteStore: BenchmarkSuiteStore,
    private readonly caseStore: BenchmarkCaseStore,
    private readonly observationStore: ObservationStore,
    private readonly researchStore: ResearchItemStore,
    private readonly responseStore: ModelLabResponseStore,
    private readonly reportStore: ModelLabRunReportStore,
    private readonly providers = new ModelProviderRegistry(),
    private readonly secret: (name: string) => string | undefined = (name) =>
      process.env[name],
    private readonly clock: () => Date = () => new Date(),
  ) {}
  async run(options: ModelLabRunOptions): Promise<{
    report: ModelLabRunReport;
    selected: BenchmarkCase[];
    responses: ModelLabResponse[];
  }> {
    const started = this.clock();
    const [
      config,
      suiteRegistry,
      caseRegistry,
      observations,
      researchItems,
      existing,
    ] = await Promise.all([
      this.configStore.read(),
      this.suiteStore.read(),
      this.caseStore.read(),
      this.observationStore.readAll(),
      this.researchStore.readAll(),
      this.responseStore.readAll(),
    ]);
    const scheduledAllowed =
      options.trigger !== "schedule" ||
      (config.policy.scheduleEnabled && options.scheduleGate === true);
    const selected = scheduledAllowed
      ? selectBenchmarkCases({
          config,
          suites: suiteRegistry.suites,
          goldCases: caseRegistry.cases,
          observations,
          researchItems,
          existingResponses: existing,
          now: started,
          ...(options.caseId ? { caseId: options.caseId } : {}),
        })
      : [];
    const models = config.models.filter(
      (profile) =>
        profile.enabled &&
        (!options.modelProfileId || profile.id === options.modelProfileId),
    );
    if (options.modelProfileId && models.length === 0)
      throw new Error(
        `Unknown or disabled model profile: ${options.modelProfileId}`,
      );
    const produced: ModelLabResponse[] = [];
    let executed = 0;
    let reused = 0;
    let skipped = 0;
    outer: for (const item of selected) {
      const suite = suiteRegistry.suites.find(
        (value) => value.id === item.suiteId,
      );
      if (!suite) throw new Error(`Unknown benchmark suite: ${item.suiteId}`);
      for (const profile of models) {
        if (executed >= config.policy.maxRequestsPerRun) break outer;
        const modelConfigHash = profileHash(profile);
        const baseId = executionId(item, modelConfigHash);
        const previous = existing
          .filter(
            (response) =>
              response.caseId === item.id &&
              response.modelProfileId === profile.id &&
              response.inputHash === inputHash(item) &&
              response.promptHash === MODEL_LAB_PROMPT_HASH &&
              response.classificationSchemaHash ===
                CLASSIFICATION_SCHEMA_HASH &&
              response.modelConfigHash === modelConfigHash,
          )
          .at(-1);
        if (
          previous?.status === "success" ||
          (previous &&
            previous.status !== "missing-secret" &&
            !options.retryFailed)
        ) {
          produced.push(previous);
          reused += 1;
          continue;
        }
        const apiKey = this.secret(providerSecretNames[profile.provider]);
        const callStarted = this.clock();
        if (!apiKey) {
          if (previous?.status === "missing-secret") {
            produced.push(previous);
            reused += 1;
            continue;
          }
          const missing = modelLabResponseSchema.parse({
            schemaVersion: 1,
            id: baseId,
            runId: options.runId,
            caseId: item.id,
            caseKind: item.kind,
            caseTitle: item.title,
            inputText: item.inputText,
            ...(item.sourceItemId ? { sourceItemId: item.sourceItemId } : {}),
            ...(item.sourceUrl ? { sourceUrl: item.sourceUrl } : {}),
            suiteId: suite.id,
            suiteVersion: suite.version,
            provider: profile.provider,
            modelProfileId: profile.id,
            requestedModel: profile.model,
            promptHash: MODEL_LAB_PROMPT_HASH,
            classificationSchemaHash: CLASSIFICATION_SCHEMA_HASH,
            inputHash: inputHash(item),
            modelConfigHash,
            startedAt: callStarted.toISOString(),
            finishedAt: this.clock().toISOString(),
            latencyMs: 0,
            status: "missing-secret",
            errorCode: "missing-secret",
            errorMessage: `${providerSecretNames[profile.provider]} is not configured.`,
          });
          produced.push(missing);
          skipped += 1;
          if (!options.dryRun) await this.responseStore.append([missing]);
          continue;
        }
        if (options.dryRun) {
          skipped += 1;
          continue;
        }
        executed += 1;
        const result = await this.providers
          .get(profile.provider)
          .execute(renderPrompt(item), profile, apiKey);
        const finished = this.clock();
        const response = modelLabResponseSchema.parse({
          schemaVersion: 1,
          id: previous
            ? `${baseId}:${sha256(options.runId).slice(0, 10)}`
            : baseId,
          runId: options.runId,
          caseId: item.id,
          caseKind: item.kind,
          caseTitle: item.title,
          inputText: item.inputText,
          ...(item.sourceItemId ? { sourceItemId: item.sourceItemId } : {}),
          ...(item.sourceUrl ? { sourceUrl: item.sourceUrl } : {}),
          suiteId: suite.id,
          suiteVersion: suite.version,
          provider: profile.provider,
          modelProfileId: profile.id,
          requestedModel: profile.model,
          ...(result.returnedModel
            ? { returnedModel: result.returnedModel }
            : {}),
          ...(result.providerResponseId
            ? { providerResponseId: result.providerResponseId }
            : {}),
          promptHash: MODEL_LAB_PROMPT_HASH,
          classificationSchemaHash: CLASSIFICATION_SCHEMA_HASH,
          inputHash: inputHash(item),
          modelConfigHash,
          startedAt: callStarted.toISOString(),
          finishedAt: finished.toISOString(),
          latencyMs: Math.max(0, finished.valueOf() - callStarted.valueOf()),
          status: result.status,
          ...(result.usage ? { usage: result.usage } : {}),
          ...(result.output ? { output: result.output } : {}),
          ...(result.rawOutput ? { rawOutput: result.rawOutput } : {}),
          ...(result.errorCode ? { errorCode: result.errorCode } : {}),
          ...(result.errorMessage
            ? { errorMessage: sanitized(result.errorMessage) }
            : {}),
        });
        produced.push(response);
        await this.responseStore.append([response]);
      }
    }
    const consensus = selected.map((item) =>
      calculateConsensus(
        item,
        produced.filter((response) => response.caseId === item.id),
      ),
    );
    const successful = produced.filter(
      (response) => response.status === "success",
    ).length;
    const failed = produced.filter(
      (response) => !["success", "missing-secret"].includes(response.status),
    ).length;
    const planned = selected.length * models.length;
    const report = modelLabRunReportSchema.parse({
      schemaVersion: 1,
      runId: options.runId,
      trigger: options.trigger,
      startedAt: started.toISOString(),
      finishedAt: this.clock().toISOString(),
      status:
        planned === 0
          ? "no-op"
          : executed === 0 && successful === 0
            ? "no-op"
            : failed === 0
              ? "success"
              : successful === 0
                ? "failure"
                : "partial",
      totals: {
        cases: selected.length,
        planned,
        executed,
        reused,
        successful,
        failed,
        skipped,
        inputTokens: produced.reduce(
          (sum, response) => sum + (response.usage?.inputTokens ?? 0),
          0,
        ),
        outputTokens: produced.reduce(
          (sum, response) => sum + (response.usage?.outputTokens ?? 0),
          0,
        ),
      },
      responseIds: produced.map((response) => response.id),
      consensus,
    });
    if (!options.dryRun) await this.reportStore.write(report);
    return { report, selected, responses: produced };
  }
}
