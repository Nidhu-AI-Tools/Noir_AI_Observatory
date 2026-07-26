import { randomUUID } from "node:crypto";

import { MonitorRunner } from "../packages/monitoring/src/index";
import {
  JsonHealthRunReportStore,
  JsonlHealthCheckStore,
  YamlMonitorRegistryStore,
} from "../packages/storage/src/index";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  const value = process.argv[index + 1];
  return index >= 0 && value && !value.startsWith("--") ? value : undefined;
}
async function main() {
  const root = process.cwd();
  const trigger = process.env.HEALTH_TRIGGER ?? "local";
  const monitorId = option("monitor");
  if (
    !(["schedule", "manual", "local"] as const).includes(
      trigger as "schedule" | "manual" | "local",
    )
  )
    throw new Error(`Invalid health trigger: ${trigger}`);
  const result = await new MonitorRunner(
    new YamlMonitorRegistryStore(root),
    new JsonlHealthCheckStore(root),
    new JsonHealthRunReportStore(root),
  ).run({
    runId: process.env.HEALTH_RUN_ID ?? randomUUID(),
    trigger: trigger as "schedule" | "manual" | "local",
    ...(monitorId ? { monitorId } : {}),
    dryRun: process.argv.includes("--dry-run"),
  });
  console.log(
    `Health run ${result.report.status}: ${result.report.totals.healthy} healthy, ${result.report.totals.degraded} degraded, ${result.report.totals.down} down; ${result.written} written.`,
  );
  if (result.report.status === "failure") process.exitCode = 1;
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Health run failed.");
  process.exitCode = 1;
});
