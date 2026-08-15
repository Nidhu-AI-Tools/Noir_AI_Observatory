import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildModelRadarDashboardData } from "../packages/dashboard-data/src/index";
import {
  JsonModelIntelligenceRunReportStore,
  JsonlModelReleaseEventStore,
  YamlModelCategoryStore,
} from "../packages/storage/src/index";

const modelPayloadBudget = 250 * 1024;

export async function generateModelRadar(
  root = process.cwd(),
  now = new Date(),
) {
  const [categories, events, reports] = await Promise.all([
    new YamlModelCategoryStore(root).read(),
    new JsonlModelReleaseEventStore(root).readAll(),
    new JsonModelIntelligenceRunReportStore(root).readAll(),
  ]);
  const value = buildModelRadarDashboardData(categories, events, reports, now);
  const directory = path.join(
    root,
    "apps",
    "web",
    "public",
    "generated",
    "models",
  );
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  const size = Buffer.byteLength(serialized, "utf8");
  if (size > modelPayloadBudget)
    throw new Error(
      `Models index is ${size} bytes; budget is ${modelPayloadBudget}.`,
    );
  await writeFile(path.join(directory, "index.json"), serialized, "utf8");
}
if (import.meta.url === `file://${process.argv[1]}`) await generateModelRadar();
