import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildCurationDashboardData } from "../packages/dashboard-data/src/index";
import { MarkdownCurationNoteStore } from "../packages/storage/src/index";

export async function generateCuration(
  root = process.cwd(),
  generatedAt = new Date(),
) {
  const notes = await new MarkdownCurationNoteStore(root).readAll();
  const value = buildCurationDashboardData(notes, generatedAt);
  const directory = path.join(
    root,
    "apps",
    "web",
    "public",
    "generated",
    "curation",
  );
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, "index.json"),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

if (import.meta.url === `file://${process.argv[1]}`) await generateCuration();
