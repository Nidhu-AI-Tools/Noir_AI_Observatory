import { randomUUID } from "node:crypto";

import { ModelIntelligenceRunner } from "../packages/model-intelligence/src/index";
import {
  JsonModelIntelligenceRunReportStore,
  JsonlModelReleaseEventStore,
  JsonlObservationStore,
  YamlModelCategoryStore,
  YamlModelIntelligenceConfigStore,
  YamlModelOverrideStore,
  YamlRegistryStore,
} from "../packages/storage/src/index";

async function main() {
  const root = process.cwd();
  const trigger = process.env.MODEL_INTELLIGENCE_TRIGGER ?? "local";
  if (!["schedule", "manual", "local"].includes(trigger))
    throw new Error(`Invalid trigger: ${trigger}`);
  const result = await new ModelIntelligenceRunner(
    new YamlModelIntelligenceConfigStore(root),
    new YamlModelCategoryStore(root),
    new YamlModelOverrideStore(root),
    new YamlRegistryStore(root),
    new JsonlObservationStore(root),
    new JsonlModelReleaseEventStore(root),
    new JsonModelIntelligenceRunReportStore(root),
  ).run({
    runId: process.env.MODEL_INTELLIGENCE_RUN_ID ?? randomUUID(),
    trigger: trigger as "schedule" | "manual" | "local",
    dryRun: process.argv.includes("--dry-run"),
  });
  console.log(
    `Model intelligence ${result.report.status}: ${result.report.totals.produced} events, ${result.report.totals.duplicates} duplicates, ${result.report.totals.failed} failed.`,
  );
  if (result.report.status === "failure") process.exitCode = 1;
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Model intelligence collection failed.",
  );
  process.exitCode = 1;
});
