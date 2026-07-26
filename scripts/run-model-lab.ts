import { randomUUID } from "node:crypto";

import { ModelLabRunner } from "../packages/model-lab/src/index";
import {
  JsonModelLabRunReportStore,
  JsonlModelLabResponseStore,
  JsonlObservationStore,
  JsonlResearchItemStore,
  YamlBenchmarkCaseStore,
  YamlBenchmarkSuiteStore,
  YamlModelLabConfigStore,
} from "../packages/storage/src/index";

function option(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  const value = process.argv[index + 1];
  return index >= 0 && value && !value.startsWith("--") ? value : undefined;
}
async function main() {
  const root = process.cwd();
  const trigger = process.env.MODEL_LAB_TRIGGER ?? "local";
  if (!["schedule", "manual", "local"].includes(trigger))
    throw new Error(`Invalid trigger: ${trigger}`);
  const caseId = option("case");
  const modelProfileId = option("model");
  const result = await new ModelLabRunner(
    new YamlModelLabConfigStore(root),
    new YamlBenchmarkSuiteStore(root),
    new YamlBenchmarkCaseStore(root),
    new JsonlObservationStore(root),
    new JsonlResearchItemStore(root),
    new JsonlModelLabResponseStore(root),
    new JsonModelLabRunReportStore(root),
  ).run({
    runId: process.env.MODEL_LAB_RUN_ID ?? randomUUID(),
    trigger: trigger as "schedule" | "manual" | "local",
    ...(caseId ? { caseId } : {}),
    ...(modelProfileId ? { modelProfileId } : {}),
    dryRun: process.argv.includes("--dry-run"),
    retryFailed: process.argv.includes("--retry-failed"),
    scheduleGate: process.env.MODEL_LAB_ENABLED === "true",
  });
  console.log(
    `Model Lab ${result.report.status}: ${result.report.totals.cases} cases, ${result.report.totals.executed} calls, ${result.report.totals.successful} successful, ${result.report.totals.reused} reused.`,
  );
  if (result.report.status === "failure") process.exitCode = 1;
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Model Lab run failed.",
  );
  process.exitCode = 1;
});
