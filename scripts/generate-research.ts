import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildResearchDashboardData } from "../packages/dashboard-data/src/index";
import { validateResearchDiscoveryConfiguration } from "../packages/research/src/index";
import {
  JsonResearchRunReportStore,
  JsonlResearchItemStore,
  YamlResearchRegistryStore,
  YamlResearchTaxonomyStore,
} from "../packages/storage/src/index";

async function writeJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeCompactJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value)}\n`, "utf8");
}

export async function generateResearch(
  root = process.cwd(),
  generatedAt = new Date(),
) {
  const [registry, taxonomy, items, reports] = await Promise.all([
    new YamlResearchRegistryStore(root).read(),
    new YamlResearchTaxonomyStore(root).read(),
    new JsonlResearchItemStore(root).readAll(),
    new JsonResearchRunReportStore(root).readAll(),
  ]);
  const data = buildResearchDashboardData(
    registry,
    items,
    reports,
    generatedAt,
    24,
    taxonomy,
  );
  validateResearchDiscoveryConfiguration(registry, taxonomy);
  const directory = path.join(
    root,
    "apps",
    "web",
    "public",
    "generated",
    "research",
  );
  await rm(directory, { recursive: true, force: true });
  await Promise.all([
    writeJson(path.join(directory, "index.json"), data.index),
    writeCompactJson(path.join(directory, "search", "index.json"), data.search),
    ...[...data.pages].map(([page, value]) =>
      writeJson(
        path.join(directory, "pages", `${String(page).padStart(4, "0")}.json`),
        value,
      ),
    ),
  ]);

  const indexBytes = (await stat(path.join(directory, "index.json"))).size;
  if (indexBytes > 250_000)
    throw new Error(`Research index exceeds 250 KB: ${indexBytes} bytes.`);
  for (const page of data.pages.keys()) {
    const bytes = (
      await stat(
        path.join(directory, "pages", `${String(page).padStart(4, "0")}.json`),
      )
    ).size;
    if (bytes > 150_000)
      throw new Error(`Research page ${page} exceeds 150 KB: ${bytes} bytes.`);
  }
  const searchBytes = (await stat(path.join(directory, "search", "index.json")))
    .size;
  const searchBudget = Math.max(
    1_500_000,
    data.search.documents.length * 1_100,
  );
  if (searchBytes > searchBudget)
    throw new Error(
      `Research search index exceeds its ${searchBudget}-byte budget: ${searchBytes} bytes.`,
    );
  const itemIds = [...data.pages.values()].flatMap((page) =>
    page.items.map((item) => item.id),
  );
  if (new Set(itemIds).size !== itemIds.length)
    throw new Error("Generated research pages contain duplicate item IDs.");
  if (itemIds.length !== data.search.documents.length)
    throw new Error(
      "Research pages and search index have different item counts.",
    );
}

if (import.meta.url === `file://${process.argv[1]}`) await generateResearch();
