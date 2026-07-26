import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildActivityDashboardData } from "../packages/dashboard-data/src/index";
import {
  JsonRunReportStore,
  JsonlObservationStore,
} from "../packages/storage/src/index";

export async function generateActivity(
  rootDirectory = process.cwd(),
): Promise<void> {
  const [observations, reports] = await Promise.all([
    new JsonlObservationStore(rootDirectory).readAll(),
    new JsonRunReportStore(rootDirectory).readAll(),
  ]);
  const data = buildActivityDashboardData(observations, reports);
  const outputDirectory = path.join(
    rootDirectory,
    "apps",
    "web",
    "public",
    "generated",
  );
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "activity.json"),
    `${JSON.stringify(data, null, 2)}\n`,
    "utf8",
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await generateActivity();
}
