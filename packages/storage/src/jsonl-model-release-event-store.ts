import { readFile } from "node:fs/promises";
import path from "node:path";

import { modelReleaseEventSchema, type ModelReleaseEvent } from "@noir/core";

import { atomicWrite } from "./generated/atomic-write";
import { findFiles } from "./generated/file-discovery";
import type { ModelReleaseEventStore } from "./model-intelligence-store";

async function readJsonl(file: string): Promise<ModelReleaseEvent[]> {
  return (await readFile(file, "utf8"))
    .split("\n")
    .filter(Boolean)
    .map((line, index) => {
      try {
        return modelReleaseEventSchema.parse(JSON.parse(line));
      } catch (error) {
        throw new Error(
          `Invalid model event in ${file} at line ${index + 1}: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    });
}
const sorted = (events: ModelReleaseEvent[]) =>
  [...events].sort(
    (a, b) =>
      a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id),
  );
function fileFor(root: string, timestamp: string) {
  const [year, month, day] = timestamp.slice(0, 10).split("-");
  return path.join(
    root,
    "data",
    "model-events",
    year ?? "unknown",
    month ?? "unknown",
    `${day ?? "unknown"}.jsonl`,
  );
}
export class JsonlModelReleaseEventStore implements ModelReleaseEventStore {
  private readonly directory: string;
  constructor(private readonly root: string) {
    this.directory = path.join(root, "data", "model-events");
  }
  async readAll() {
    return sorted(
      (
        await Promise.all(
          (await findFiles(this.directory, ".jsonl")).map(readJsonl),
        )
      ).flat(),
    );
  }
  async append(events: ModelReleaseEvent[]) {
    const validated = events.map((event) =>
      modelReleaseEventSchema.parse(event),
    );
    const known = new Set((await this.readAll()).map((event) => event.id));
    const unique = validated.filter(
      (event) => !known.has(event.id) && Boolean(known.add(event.id)),
    );
    const files = new Map<string, ModelReleaseEvent[]>();
    for (const event of unique) {
      const file = fileFor(this.root, event.occurredAt);
      files.set(file, [...(files.get(file) ?? []), event]);
    }
    for (const [file, additions] of files) {
      let current: ModelReleaseEvent[] = [];
      try {
        current = await readJsonl(file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      await atomicWrite(
        file,
        `${sorted([...current, ...additions])
          .map((event) => JSON.stringify(event))
          .join("\n")}\n`,
      );
    }
    return unique.length;
  }
}
