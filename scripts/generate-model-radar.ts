import {
  access,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { buildModelRadarDashboardData } from "../packages/dashboard-data/src/index";
import {
  JsonModelIntelligenceRunReportStore,
  JsonlModelReleaseEventStore,
  YamlModelCategoryStore,
} from "../packages/storage/src/index";

type ModelBudgets = {
  version: 1;
  limits: {
    modelsIndex: number;
    modelsCatalog: number;
    modelsPage: number;
  };
};

const pageSize = 24;

function serialize(value: unknown, pretty = true) {
  return `${JSON.stringify(value, null, pretty ? 2 : undefined)}\n`;
}

function assertBudget(label: string, content: string, limit: number) {
  const size = Buffer.byteLength(content, "utf8");
  if (size > limit)
    throw new Error(`${label} is ${size} bytes; budget is ${limit}.`);
}

async function exists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export async function generateModelRadar(
  root = process.cwd(),
  now = new Date(),
) {
  const [categories, events, reports, budgetFile] = await Promise.all([
    new YamlModelCategoryStore(root).read(),
    new JsonlModelReleaseEventStore(root).readAll(),
    new JsonModelIntelligenceRunReportStore(root).readAll(),
    readFile(path.join(root, "config", "dashboard-budgets.json"), "utf8"),
  ]);
  const budgets = JSON.parse(budgetFile) as ModelBudgets;
  const value = buildModelRadarDashboardData(
    categories,
    events,
    reports,
    now,
    pageSize,
  );
  const index = serialize(value.index);
  const catalog = serialize(value.catalog, false);
  const pages = value.pages.map((page) => ({
    name: `${String(page.page).padStart(4, "0")}.json`,
    content: serialize(page),
  }));
  assertBudget("Models index", index, budgets.limits.modelsIndex);
  assertBudget("Models catalog", catalog, budgets.limits.modelsCatalog);
  for (const page of pages)
    assertBudget(
      `Models page ${page.name}`,
      page.content,
      budgets.limits.modelsPage,
    );

  const directory = path.join(
    root,
    "apps",
    "web",
    "public",
    "generated",
    "models",
  );
  const parent = path.dirname(directory);
  const temporary = path.join(parent, ".models-next");
  const backup = path.join(parent, ".models-previous");
  await rm(temporary, { recursive: true, force: true });
  await rm(backup, { recursive: true, force: true });
  await mkdir(path.join(temporary, "pages"), { recursive: true });
  await writeFile(path.join(temporary, "index.json"), index, "utf8");
  await writeFile(path.join(temporary, "catalog.json"), catalog, "utf8");
  await Promise.all(
    pages.map(({ name, content }) =>
      writeFile(path.join(temporary, "pages", name), content, "utf8"),
    ),
  );

  const hadPrevious = await exists(directory);
  try {
    if (hadPrevious) await rename(directory, backup);
    await rename(temporary, directory);
    if (hadPrevious) await rm(backup, { recursive: true, force: true });
  } catch (error) {
    if (!(await exists(directory)) && (await exists(backup)))
      await rename(backup, directory);
    throw error;
  }
}
if (import.meta.url === `file://${process.argv[1]}`) await generateModelRadar();
