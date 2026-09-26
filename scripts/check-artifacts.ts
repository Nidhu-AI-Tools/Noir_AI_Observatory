import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

type Budgets = {
  version: 1;
  limits: Record<
    "todayInitial" | "researchInitial" | "researchPage" | "modelsIndex",
    number
  >;
};

async function bytes(file: string) {
  return (await stat(file)).size;
}

async function main() {
  const root = process.cwd();
  const generated = path.join(root, "apps", "web", "public", "generated");
  const budgets = JSON.parse(
    await readFile(path.join(root, "config", "dashboard-budgets.json"), "utf8"),
  ) as Budgets;
  const todayDirectory = path.join(generated, "today");
  const todayFiles = (await readdir(todayDirectory))
    .filter((file) => file.endsWith(".json"))
    .sort();
  const todayIndex = path.join(todayDirectory, "index.json");
  const latestToday = todayFiles.filter((file) => file !== "index.json").at(-1);
  if (!latestToday) throw new Error("No generated Today edition exists.");
  const researchIndex = path.join(generated, "research", "index.json");
  const researchPages = await readdir(
    path.join(generated, "research", "pages"),
  );
  const firstResearchPage = researchPages
    .filter((file) => file.endsWith(".json"))
    .sort()[0];
  if (!firstResearchPage) throw new Error("No generated Research page exists.");
  const checks = [
    [
      "Today initial",
      (await bytes(todayIndex)) +
        (await bytes(path.join(todayDirectory, latestToday))),
      budgets.limits.todayInitial,
    ],
    [
      "Research initial",
      (await bytes(researchIndex)) +
        (await bytes(
          path.join(generated, "research", "pages", firstResearchPage),
        )),
      budgets.limits.researchInitial,
    ],
    [
      "Research page",
      await bytes(path.join(generated, "research", "pages", firstResearchPage)),
      budgets.limits.researchPage,
    ],
    [
      "Models index",
      await bytes(path.join(generated, "models", "index.json")),
      budgets.limits.modelsIndex,
    ],
  ] as const;
  for (const [label, size, limit] of checks) {
    console.log(`${label}: ${size} bytes (limit ${limit})`);
    if (size > limit) throw new Error(`${label} exceeds its payload budget.`);
  }
}

await main();
