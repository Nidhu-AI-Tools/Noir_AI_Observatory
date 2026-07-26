import {
  researchRunReportSchema,
  researchStateSchema,
  type ResearchItem,
  type ResearchRunReport,
} from "@noir/core";
import type {
  ResearchItemStore,
  ResearchRegistryStore,
  ResearchRunReportStore,
  ResearchStateStore,
} from "@noir/storage";

import { ResearchAdapterRegistry } from "./adapters";

export interface ResearchRunOptions {
  runId: string;
  trigger: "schedule" | "manual" | "local";
  sourceId?: string;
  lookbackDays?: number;
  maxItemsPerSource?: number;
  dryRun?: boolean;
}

export class ResearchRunner {
  constructor(
    private readonly registryStore: ResearchRegistryStore,
    private readonly itemStore: ResearchItemStore,
    private readonly stateStore: ResearchStateStore,
    private readonly reportStore: ResearchRunReportStore,
    private readonly adapters = new ResearchAdapterRegistry(),
    private readonly clock: () => Date = () => new Date(),
    private readonly sleep: (milliseconds: number) => Promise<void> = (
      milliseconds,
    ) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {}

  async run(options: ResearchRunOptions): Promise<{
    report: ResearchRunReport;
    items: ResearchItem[];
  }> {
    const started = this.clock();
    const registry = await this.registryStore.read();
    const selected = options.sourceId
      ? registry.sources.filter((source) => source.id === options.sourceId)
      : registry.sources;
    if (options.sourceId && selected.length === 0)
      throw new Error(`Unknown research source: ${options.sourceId}`);
    const sourceReports: ResearchRunReport["sources"] = [];
    const collected: ResearchItem[] = [];
    const successful = new Map<string, ResearchItem[]>();
    let madeArxivRequest = false;
    for (const source of selected) {
      if (!source.enabled) {
        sourceReports.push({
          sourceId: source.id,
          status: "skipped",
          fetched: 0,
          accepted: 0,
        });
        continue;
      }
      try {
        if (source.kind === "arxiv_query") {
          if (madeArxivRequest) await this.sleep(3_000);
          madeArxivRequest = true;
        }
        const state = await this.stateStore.read(source.id);
        const since = state
          ? new Date(state.cursorPublishedAt)
          : new Date(
              started.valueOf() - (options.lookbackDays ?? 7) * 86_400_000,
            );
        const fetched = await this.adapters.get(source.kind).collect(source, {
          since,
          now: started,
          maxItems: options.maxItemsPerSource ?? 100,
        });
        const accepted = fetched.filter((item) => {
          if (!state) return true;
          if (item.publishedAt > state.cursorPublishedAt) return true;
          return (
            item.publishedAt === state.cursorPublishedAt &&
            !state.cursorItemIds.includes(item.id)
          );
        });
        collected.push(...accepted);
        successful.set(source.id, fetched);
        sourceReports.push({
          sourceId: source.id,
          status: "success",
          fetched: fetched.length,
          accepted: accepted.length,
        });
      } catch (error) {
        sourceReports.push({
          sourceId: source.id,
          status: "failed",
          fetched: 0,
          accepted: 0,
          error: (error instanceof Error
            ? error.message
            : "Unknown collection error"
          ).slice(0, 500),
        });
      }
    }
    const writeResult = options.dryRun
      ? { added: 0, updated: 0, duplicatesMerged: 0 }
      : await this.itemStore.upsert(collected);
    if (!options.dryRun) {
      for (const [sourceId, fetched] of successful) {
        const previous = await this.stateStore.read(sourceId);
        const candidates = [
          ...(previous
            ? [{ id: "", publishedAt: previous.cursorPublishedAt }]
            : []),
          ...fetched,
        ];
        const latest =
          candidates
            .map((item) => item.publishedAt)
            .sort()
            .at(-1) ?? started.toISOString();
        const ids = fetched
          .filter((item) => item.publishedAt === latest)
          .map((item) => item.id);
        await this.stateStore.write(
          researchStateSchema.parse({
            schemaVersion: 1,
            sourceId,
            cursorPublishedAt: latest,
            cursorItemIds:
              previous?.cursorPublishedAt === latest
                ? [...new Set([...previous.cursorItemIds, ...ids])].sort()
                : [...new Set(ids)].sort(),
            updatedAt: this.clock().toISOString(),
          }),
        );
      }
    }
    const failed = sourceReports.filter(
      (source) => source.status === "failed",
    ).length;
    const attempted = sourceReports.filter(
      (source) => source.status !== "skipped",
    ).length;
    const report = researchRunReportSchema.parse({
      schemaVersion: 1,
      runId: options.runId,
      trigger: options.trigger,
      startedAt: started.toISOString(),
      finishedAt: this.clock().toISOString(),
      status:
        failed === 0 ? "success" : failed === attempted ? "failure" : "partial",
      totals: {
        configured: selected.length,
        attempted,
        skipped: selected.length - attempted,
        fetched: sourceReports.reduce((sum, source) => sum + source.fetched, 0),
        added: writeResult.added,
        updated: writeResult.updated,
        duplicatesMerged: writeResult.duplicatesMerged,
        failed,
      },
      sources: sourceReports,
    });
    if (!options.dryRun) await this.reportStore.write(report);
    return { report, items: collected };
  }
}
