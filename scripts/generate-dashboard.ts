import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildActivityDashboardData,
  buildDashboardFeedData,
  buildDigestDashboardData,
  buildRadarDashboardData,
} from "../packages/dashboard-data/src/index";
import {
  JsonRunReportStore,
  JsonResearchRunReportStore,
  JsonlResearchItemStore,
  JsonlHealthCheckStore,
  JsonlObservationStore,
  YamlMonitorRegistryStore,
  YamlRegistryStore,
  YamlResearchRegistryStore,
} from "../packages/storage/src/index";

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
    researchItems,
    researchReports,
  ] = await Promise.all([
    new YamlRegistryStore(rootDirectory).read(),
    new JsonlObservationStore(rootDirectory).readAll(),
    new JsonRunReportStore(rootDirectory).readAll(),
    new JsonlHealthCheckStore(rootDirectory).readAll(),
    new YamlMonitorRegistryStore(rootDirectory).read(),
    new YamlResearchRegistryStore(rootDirectory).read(),
    new JsonlResearchItemStore(rootDirectory).readAll(),
    new JsonResearchRunReportStore(rootDirectory).readAll(),
  ]);
  const outputDirectory = path.join(
    rootDirectory,
    "apps",
    "web",
    "public",
    "generated",
  );
  const digestDirectory = path.join(outputDirectory, "digests");
  const digests = buildDigestDashboardData(
    snapshot,
    observations,
    reports,
    generatedAt,
    {
      healthChecks,
      monitorRegistry,
      researchRegistry,
      researchItems,
      researchReports,
    },
  );

  // Daily files are disposable view models. Recreate the directory so dates
  // that age out of the retention window cannot remain publicly accessible.
  await rm(digestDirectory, { recursive: true, force: true });
  await Promise.all([
    writeJson(
      path.join(outputDirectory, "activity.json"),
      buildActivityDashboardData(observations, reports, generatedAt),
    ),
    writeJson(
      path.join(outputDirectory, "feed.json"),
      buildDashboardFeedData(snapshot, observations, reports, generatedAt),
    ),
    writeJson(
      path.join(outputDirectory, "radar.json"),
      buildRadarDashboardData(snapshot, observations, generatedAt),
    ),
    writeJson(path.join(digestDirectory, "index.json"), digests.index),
    ...[...digests.daily.entries()].map(([date, digest]) =>
      writeJson(path.join(digestDirectory, `${date}.json`), digest),
    ),
  ]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await generateDashboard();
}
