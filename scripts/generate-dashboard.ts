import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildHealthDashboardData,
  buildRadarDashboardData,
  buildTodayDashboardData,
} from "../packages/dashboard-data/src/index";
import {
  JsonRunReportStore,
  JsonResearchRunReportStore,
  JsonlResearchItemStore,
  JsonlHealthCheckStore,
  JsonlObservationStore,
  JsonlModelReleaseEventStore,
  MarkdownCurationNoteStore,
  YamlMonitorRegistryStore,
  YamlRegistryStore,
  YamlResearchRegistryStore,
  YamlResearchTaxonomyStore,
} from "../packages/storage/src/index";

const todayPayloadBudget = 250 * 1024;

function jsonSize(value: unknown): number {
  return Buffer.byteLength(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function removeObsoleteDashboardArtifacts(
  outputDirectory: string,
): Promise<void> {
  await Promise.all([
    rm(path.join(outputDirectory, "activity.json"), { force: true }),
    rm(path.join(outputDirectory, "feed.json"), { force: true }),
    rm(path.join(outputDirectory, "sources.json"), { force: true }),
    rm(path.join(outputDirectory, "digests"), {
      recursive: true,
      force: true,
    }),
    rm(path.join(outputDirectory, "curation"), {
      recursive: true,
      force: true,
    }),
    rm(path.join(outputDirectory, "model-lab"), {
      recursive: true,
      force: true,
    }),
    rm(path.join(outputDirectory, "research", "days"), {
      recursive: true,
      force: true,
    }),
  ]);
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function generateDashboard(
  rootDirectory = process.cwd(),
  generatedAt = new Date(),
): Promise<void> {
  const [
    snapshot,
    observations,
    reports,
    healthChecks,
    monitorRegistry,
    researchRegistry,
    researchTaxonomy,
    researchItems,
    researchReports,
    modelEvents,
    curationNotes,
  ] = await Promise.all([
    new YamlRegistryStore(rootDirectory).read(),
    new JsonlObservationStore(rootDirectory).readAll(),
    new JsonRunReportStore(rootDirectory).readAll(),
    new JsonlHealthCheckStore(rootDirectory).readAll(),
    new YamlMonitorRegistryStore(rootDirectory).read(),
    new YamlResearchRegistryStore(rootDirectory).read(),
    new YamlResearchTaxonomyStore(rootDirectory).read(),
    new JsonlResearchItemStore(rootDirectory).readAll(),
    new JsonResearchRunReportStore(rootDirectory).readAll(),
    new JsonlModelReleaseEventStore(rootDirectory).readAll(),
    new MarkdownCurationNoteStore(rootDirectory).readAll(),
  ]);
  const outputDirectory = path.join(
    rootDirectory,
    "apps",
    "web",
    "public",
    "generated",
  );
  const todayDirectory = path.join(outputDirectory, "today");
  const today = buildTodayDashboardData(
    snapshot,
    observations,
    reports,
    generatedAt,
    {
      healthChecks,
      monitorRegistry,
      researchRegistry,
      researchTaxonomy,
      researchItems,
      researchReports,
      modelEvents,
      curationNotes,
    },
  );
  const largestEditionSize = Math.max(
    0,
    ...[...today.editions.values()].map(jsonSize),
  );
  const initialTodaySize = jsonSize(today.index) + largestEditionSize;
  if (initialTodaySize > todayPayloadBudget)
    throw new Error(
      `Today initial payload is ${initialTodaySize} bytes; budget is ${todayPayloadBudget}.`,
    );
  const health = buildHealthDashboardData(
    monitorRegistry,
    snapshot,
    healthChecks,
    [],
    generatedAt,
  );

  // Daily files are disposable view models. Recreate the directory so dates
  // that age out of the retention window cannot remain publicly accessible.
  // Remove superseded artifacts as well so a local or Pages build cannot
  // accidentally publish stale Overview, Digests, or Curation payloads.
  await Promise.all([
    rm(todayDirectory, { recursive: true, force: true }),
    removeObsoleteDashboardArtifacts(outputDirectory),
  ]);
  await Promise.all([
    writeJson(
      path.join(outputDirectory, "radar.json"),
      buildRadarDashboardData(snapshot, observations, generatedAt, {
        healthMonitors: health.index.monitors,
      }),
    ),
    writeJson(path.join(todayDirectory, "index.json"), today.index),
    ...[...today.editions.entries()].map(([date, edition]) =>
      writeJson(path.join(todayDirectory, `${date}.json`), edition),
    ),
  ]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await generateDashboard();
}
