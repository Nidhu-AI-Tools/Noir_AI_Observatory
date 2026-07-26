import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildResearchDashboardData } from "../packages/dashboard-data/src/index";
import {
  JsonResearchRunReportStore,
  JsonlResearchItemStore,
  YamlResearchRegistryStore,
} from "../packages/storage/src/index";

async function writeJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
export async function generateResearch(
  root = process.cwd(),
  generatedAt = new Date(),
) {
  const [registry, items, reports] = await Promise.all([
    new YamlResearchRegistryStore(root).read(),
    new JsonlResearchItemStore(root).readAll(),
    new JsonResearchRunReportStore(root).readAll(),
  ]);
  const data = buildResearchDashboardData(
    registry,
    items,
    reports,
    generatedAt,
  );
  const directory = path.join(
    root,
    "apps",
    "web",
    "public",
    "generated",
    "research",
  );
  await rm(directory, { recursive: true, force: true });
  await writeJson(path.join(directory, "index.json"), data);
  const days = new Map<string, typeof data.items>();
  for (const item of data.items) {
    const date = item.publishedAt.slice(0, 10);
    days.set(date, [...(days.get(date) ?? []), item]);
  }
  await Promise.all(
    [...days].map(([date, daily]) =>
      writeJson(path.join(directory, "days", `${date}.json`), {
        schemaVersion: 1,
        generatedAt: generatedAt.toISOString(),
        date,
        items: daily,
      }),
    ),
  );
}
if (import.meta.url === `file://${process.argv[1]}`) await generateResearch();
