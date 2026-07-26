import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildModelLabDashboardData } from "../packages/dashboard-data/src/index";
import {
  JsonModelLabRunReportStore,
  JsonlModelLabResponseStore,
  YamlBenchmarkCaseStore,
  YamlBenchmarkSuiteStore,
  YamlModelLabConfigStore,
} from "../packages/storage/src/index";

export async function generateModelLab(root = process.cwd(), now = new Date()) {
  const [config, suites, cases, responses, reports] = await Promise.all([
    new YamlModelLabConfigStore(root).read(),
    new YamlBenchmarkSuiteStore(root).read(),
    new YamlBenchmarkCaseStore(root).read(),
    new JsonlModelLabResponseStore(root).readAll(),
    new JsonModelLabRunReportStore(root).readAll(),
  ]);
  const value = buildModelLabDashboardData(
    config,
    suites,
    cases,
    responses,
    reports,
    now,
  );
  const directory = path.join(
    root,
    "apps",
    "web",
    "public",
    "generated",
    "model-lab",
  );
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, "index.json"),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

if (import.meta.url === `file://${process.argv[1]}`) await generateModelLab();
