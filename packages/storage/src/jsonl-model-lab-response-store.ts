import { readFile } from "node:fs/promises";
import path from "node:path";

import { modelLabResponseSchema, type ModelLabResponse } from "@noir/core";

import { atomicWrite } from "./generated/atomic-write";
import { findFiles } from "./generated/file-discovery";
import type { ModelLabResponseStore } from "./model-lab-store";

function responsePath(root: string, timestamp: string) {
  const [year, month, day] = timestamp.slice(0, 10).split("-");
  return path.join(
    root,
    "data",
    "model-lab-responses",
    year ?? "unknown",
    month ?? "unknown",
    `${day ?? "unknown"}.jsonl`,
  );
}
async function readJsonl(file: string) {
  return (await readFile(file, "utf8"))
    .split("\n")
    .filter(Boolean)
    .map((line, index) => {
      try {
        return modelLabResponseSchema.parse(JSON.parse(line));
      } catch (error) {
        throw new Error(
          `Invalid Model Lab response in ${file} at line ${index + 1}: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    });
}
function sorted(items: ModelLabResponse[]) {
  return [...items].sort(
    (a, b) =>
      a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id),
  );
}
export class JsonlModelLabResponseStore implements ModelLabResponseStore {
  private readonly directory: string;
  constructor(private readonly root: string) {
    this.directory = path.join(root, "data", "model-lab-responses");
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
  async append(responses: ModelLabResponse[]) {
    const validated = responses.map((item) =>
      modelLabResponseSchema.parse(item),
    );
    const known = new Set((await this.readAll()).map((item) => item.id));
    const unique = validated.filter(
      (item) => !known.has(item.id) && Boolean(known.add(item.id)),
    );
    const files = new Map<string, ModelLabResponse[]>();
    for (const item of unique) {
      const file = responsePath(this.root, item.startedAt);
      files.set(file, [...(files.get(file) ?? []), item]);
    }
    for (const [file, additions] of files) {
      let existing: ModelLabResponse[] = [];
      try {
        existing = await readJsonl(file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      await atomicWrite(
        file,
        `${sorted([...existing, ...additions])
          .map((item) => JSON.stringify(item))
          .join("\n")}\n`,
      );
    }
    return unique.length;
  }
}
