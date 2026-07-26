import { readFile } from "node:fs/promises";
import path from "node:path";

import { researchItemSchema, type ResearchItem } from "@noir/core";

import { atomicWrite } from "./generated/atomic-write";
import { findFiles } from "./generated/file-discovery";
import type {
  ResearchItemStore,
  ResearchItemWriteResult,
} from "./research-store";

function itemPath(root: string, timestamp: string): string {
  const [year, month, day] = timestamp.slice(0, 10).split("-");
  return path.join(
    root,
    "data",
    "research-items",
    year ?? "unknown",
    month ?? "unknown",
    `${day ?? "unknown"}.jsonl`,
  );
}

async function readJsonl(file: string): Promise<ResearchItem[]> {
  return (await readFile(file, "utf8"))
    .split("\n")
    .filter(Boolean)
    .map((line, index) => {
      try {
        return researchItemSchema.parse(JSON.parse(line));
      } catch (error) {
        throw new Error(
          `Invalid research item in ${file} at line ${index + 1}: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    });
}

function sorted(items: ResearchItem[]) {
  return [...items].sort(
    (a, b) =>
      a.publishedAt.localeCompare(b.publishedAt) || a.id.localeCompare(b.id),
  );
}

function merge(existing: ResearchItem, incoming: ResearchItem): ResearchItem {
  if (existing.type !== incoming.type)
    throw new Error(`Research item identity collision: ${existing.id}`);
  return researchItemSchema.parse({
    ...existing,
    ...incoming,
    sourceIds: [
      ...new Set([...existing.sourceIds, ...incoming.sourceIds]),
    ].sort(),
    tags: [...new Set([...existing.tags, ...incoming.tags])].sort(),
    collectedAt:
      existing.collectedAt < incoming.collectedAt
        ? existing.collectedAt
        : incoming.collectedAt,
  });
}

export class JsonlResearchItemStore implements ResearchItemStore {
  private readonly directory: string;
  constructor(private readonly rootDirectory: string) {
    this.directory = path.join(rootDirectory, "data", "research-items");
  }
  async readAll(): Promise<ResearchItem[]> {
    return sorted(
      (
        await Promise.all(
          (await findFiles(this.directory, ".jsonl")).map(readJsonl),
        )
      ).flat(),
    );
  }
  async upsert(items: ResearchItem[]): Promise<ResearchItemWriteResult> {
    const incoming = items.map((item) => researchItemSchema.parse(item));
    const all = await this.readAll();
    const byId = new Map(all.map((item) => [item.id, item]));
    const touchedDates = new Set<string>();
    let added = 0;
    let updated = 0;
    let duplicatesMerged = 0;
    for (const item of incoming) {
      const current = byId.get(item.id);
      if (!current) {
        byId.set(item.id, item);
        touchedDates.add(item.publishedAt.slice(0, 10));
        added += 1;
        continue;
      }
      duplicatesMerged += 1;
      const merged = merge(current, item);
      if (JSON.stringify(merged) !== JSON.stringify(current)) {
        byId.set(item.id, merged);
        touchedDates.add(current.publishedAt.slice(0, 10));
        touchedDates.add(merged.publishedAt.slice(0, 10));
        updated += 1;
      }
    }
    for (const date of touchedDates) {
      const partition = sorted(
        [...byId.values()].filter(
          (item) => item.publishedAt.slice(0, 10) === date,
        ),
      );
      await atomicWrite(
        itemPath(this.rootDirectory, `${date}T00:00:00.000Z`),
        partition.length
          ? `${partition.map((item) => JSON.stringify(item)).join("\n")}\n`
          : "",
      );
    }
    return { added, updated, duplicatesMerged };
  }
}
