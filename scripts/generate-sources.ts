import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildSourceDashboardData } from "../packages/dashboard-data/src/index";
import { YamlRegistryStore } from "../packages/storage/src/index";

export async function generateSources(
  rootDirectory = process.cwd(),
): Promise<void> {
  const store = new YamlRegistryStore(rootDirectory);
  const data = buildSourceDashboardData(await store.read());
  const outputDirectory = path.join(
    rootDirectory,
    "apps",
    "web",
    "public",
    "generated",
  );
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "sources.json"),
    `${JSON.stringify(data, null, 2)}\n`,
    "utf8",
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await generateSources();
}
