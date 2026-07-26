import {
  collectionRunReportSchema,
  type CollectionRunReport,
  type CollectionSourceResult,
  type SourceCollectionState,
} from "@noir/core";
import type {
  CollectionStateStore,
  ObservationStore,
  RegistryStore,
  RunReportStore,
} from "@noir/storage";

import { ObservationCollectorRegistry } from "./collector-registry";
import {
  CollectionError,
  type CollectionContext,
} from "./observation-collector";

export interface CollectionRunOptions {
  runId: string;
  trigger: "schedule" | "manual" | "local";
  collectedAt?: Date;
  lookbackDays?: number;
  maxObservationsPerSource?: number;
  githubToken?: string;
  huggingFaceToken?: string;
  sourceId?: string;
  dryRun?: boolean;
}

export interface CollectionRunResult {
  report: CollectionRunReport;
  observationsFound: number;
  observationsWritten: number;
}

export class CollectionRunner {
  constructor(
    private readonly registryStore: RegistryStore,
    private readonly observationStore: ObservationStore,
    private readonly stateStore: CollectionStateStore,
    private readonly runReportStore: RunReportStore,
    private readonly collectors = new ObservationCollectorRegistry(),
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async run(options: CollectionRunOptions): Promise<CollectionRunResult> {
    const startedAt = options.collectedAt ?? this.clock();
    const snapshot = await this.registryStore.read();
    const selected = options.sourceId
      ? snapshot.registry.sources.filter(
          (source) => source.id === options.sourceId,
        )
      : snapshot.registry.sources;
    if (options.sourceId && selected.length === 0) {
      throw new Error(`Unknown source: ${options.sourceId}`);
    }

    const context: CollectionContext = {
      collectedAt: startedAt,
      lookbackDays: options.lookbackDays ?? 7,
      maxObservationsPerSource: options.maxObservationsPerSource ?? 100,
      ...(options.githubToken ? { githubToken: options.githubToken } : {}),
      ...(options.huggingFaceToken
        ? { huggingFaceToken: options.huggingFaceToken }
        : {}),
    };
    const results: CollectionSourceResult[] = [];
    let observationsFound = 0;
    let observationsWritten = 0;

    for (const source of selected) {
      const sourceStartedAt = this.clock().valueOf();
      if (!source.enabled) {
        results.push({
          sourceId: source.id,
          status: "skipped",
          durationMs: Math.max(0, this.clock().valueOf() - sourceStartedAt),
          observations: 0,
        });
        continue;
      }

      let state: SourceCollectionState | undefined;
      try {
        state = await this.stateStore.read(source.id);
        const batch = await this.collectors
          .get(source.kind)
          .collect(source, state, context);
        observationsFound += batch.observations.length;
        const written = options.dryRun
          ? 0
          : await this.observationStore.append(batch.observations);
        observationsWritten += written;

        const effectiveCursor =
          !state && batch.observations.length === 0
            ? {
                timestamp: startedAt.toISOString(),
                externalIdsAtTimestamp: [],
              }
            : batch.cursor;
        if (!options.dryRun) {
          await this.stateStore.write({
            schemaVersion: 1,
            sourceId: source.id,
            lastSuccessfulAt: this.clock().toISOString(),
            cursor: effectiveCursor,
            ...(batch.etag ? { etag: batch.etag } : {}),
          });
        }
        results.push({
          sourceId: source.id,
          status: batch.truncated ? "truncated" : "success",
          durationMs: Math.max(0, this.clock().valueOf() - sourceStartedAt),
          observations: options.dryRun ? batch.observations.length : written,
          ...(state ? { cursorBefore: state.cursor } : {}),
          cursorAfter: effectiveCursor,
        });
      } catch (error) {
        results.push({
          sourceId: source.id,
          status: "failed",
          durationMs: Math.max(0, this.clock().valueOf() - sourceStartedAt),
          observations: 0,
          ...(state ? { cursorBefore: state.cursor } : {}),
          error: {
            code:
              error instanceof CollectionError
                ? error.code
                : "unexpected_error",
            message: sanitizeError(error),
          },
        });
      }
    }

    const failed = results.filter((item) => item.status === "failed").length;
    const skipped = results.filter((item) => item.status === "skipped").length;
    const succeeded = results.length - failed - skipped;
    const attempted = results.length - skipped;
    const status =
      failed === 0 ? "success" : succeeded === 0 ? "failure" : "partial";
    const report = collectionRunReportSchema.parse({
      schemaVersion: 1,
      runId: options.runId,
      trigger: options.trigger,
      startedAt: startedAt.toISOString(),
      finishedAt: this.clock().toISOString(),
      status,
      totals: {
        configured: selected.length,
        attempted,
        succeeded,
        failed,
        skipped,
        observations: options.dryRun ? observationsFound : observationsWritten,
      },
      sources: results,
    });
    if (!options.dryRun) await this.runReportStore.write(report);
    return { report, observationsFound, observationsWritten };
  }
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return message
    .replace(/(Bearer|token)\s+[A-Za-z0-9._-]+/gi, "$1 [redacted]")
    .slice(0, 500);
}
