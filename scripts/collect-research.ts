import { randomUUID } from "node:crypto";

import { ResearchRunner } from "../packages/research/src/index";
import {
  JsonResearchRunReportStore,
  JsonResearchStateStore,
  JsonlResearchItemStore,
  YamlResearchRegistryStore,
} from "../packages/storage/src/index";

function option(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  const value = process.argv[index + 1];
  return index >= 0 && value && !value.startsWith("--") ? value : undefined;
}
async function main() {
  const root = process.cwd();
  const trigger = process.env.RESEARCH_TRIGGER ?? "local";
  if (!["schedule", "manual", "local"].includes(trigger))
    throw new Error(`Invalid research trigger: ${trigger}`);
  const sourceId = option("source");
  const result = await new ResearchRunner(
    new YamlResearchRegistryStore(root),
    new JsonlResearchItemStore(root),
    new JsonResearchStateStore(root),
    new JsonResearchRunReportStore(root),
  ).run({
    runId: process.env.RESEARCH_RUN_ID ?? randomUUID(),
    trigger: trigger as "schedule" | "manual" | "local",
    ...(sourceId ? { sourceId } : {}),
    lookbackDays: Number(
      option("lookback-days") ?? process.env.LOOKBACK_DAYS ?? "7",
    ),
    maxItemsPerSource: Number(option("max-items") ?? "100"),
    dryRun: process.argv.includes("--dry-run"),
  });
  console.log(
    `Research run ${result.report.status}: ${result.report.totals.fetched} fetched, ${result.report.totals.added} added, ${result.report.totals.updated} updated, ${result.report.totals.failed} failed.`,
  );
  if (result.report.status === "failure") process.exitCode = 1;
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Research collection failed.",
  );
  process.exitCode = 1;
});
