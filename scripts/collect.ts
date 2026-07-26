import { randomUUID } from "node:crypto";

import { CollectionRunner } from "../packages/collectors/src/index";
import {
  JsonCollectionStateStore,
  JsonRunReportStore,
  JsonlObservationStore,
  YamlRegistryStore,
} from "../packages/storage/src/index";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  const value = process.argv[index + 1];
  return index >= 0 && value && !value.startsWith("--") ? value : undefined;
}

function positiveInteger(name: string, fallback: number): number {
  const value = option(name);
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer.`);
  }
  return parsed;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const dryRun = process.argv.includes("--dry-run");
  const sourceId = option("source");
  const triggerInput = process.env.COLLECTION_TRIGGER ?? "local";
  if (!["schedule", "manual", "local"].includes(triggerInput)) {
    throw new Error(`Invalid collection trigger: ${triggerInput}`);
  }
  const runner = new CollectionRunner(
    new YamlRegistryStore(root),
    new JsonlObservationStore(root),
    new JsonCollectionStateStore(root),
    new JsonRunReportStore(root),
  );
  const result = await runner.run({
    runId: process.env.COLLECTION_RUN_ID ?? randomUUID(),
    trigger: triggerInput as "schedule" | "manual" | "local",
    lookbackDays: positiveInteger("lookback-days", 7),
    maxObservationsPerSource: positiveInteger("max-per-source", 100),
    ...(sourceId ? { sourceId } : {}),
    ...(process.env.GITHUB_TOKEN
      ? { githubToken: process.env.GITHUB_TOKEN }
      : {}),
    ...(process.env.HF_TOKEN ? { huggingFaceToken: process.env.HF_TOKEN } : {}),
    dryRun,
  });
  console.log(
    `${dryRun ? "Dry run" : "Collection"} ${result.report.status}: ${result.report.totals.succeeded} succeeded, ${result.report.totals.failed} failed, ${result.observationsFound} found, ${result.observationsWritten} written.`,
  );
  for (const source of result.report.sources) {
    console.log(
      `${source.sourceId}: ${source.status} (${source.observations} observations)${source.error ? ` - ${source.error.message}` : ""}`,
    );
  }
  if (result.report.status === "failure") process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Collection failed.");
  process.exitCode = 1;
});
