import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildHealthDashboardData } from "../packages/dashboard-data/src/index";
import {
  JsonHealthRunReportStore,
  JsonlHealthCheckStore,
  YamlMonitorRegistryStore,
  YamlRegistryStore,
} from "../packages/storage/src/index";

async function writeJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
export async function generateHealth(
  root = process.cwd(),
  generatedAt = new Date(),
) {
  const [registry, snapshot, checks, reports] = await Promise.all([
    new YamlMonitorRegistryStore(root).read(),
    new YamlRegistryStore(root).read(),
    new JsonlHealthCheckStore(root).readAll(),
    new JsonHealthRunReportStore(root).readAll(),
  ]);
  const data = buildHealthDashboardData(
    registry,
    snapshot,
    checks,
    reports,
    generatedAt,
  );
  const directory = path.join(
    root,
    "apps",
    "web",
    "public",
    "generated",
    "health",
  );
  await rm(directory, { recursive: true, force: true });
  await Promise.all([
    writeJson(path.join(directory, "index.json"), data.index),
    ...[...data.details].map(([id, detail]) =>
      writeJson(path.join(directory, "monitors", `${id}.json`), detail),
    ),
  ]);
}
if (import.meta.url === `file://${process.argv[1]}`) await generateHealth();
