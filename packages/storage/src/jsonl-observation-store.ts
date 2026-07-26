import { readFile } from "node:fs/promises";
import path from "node:path";

import { observationSchema, type Observation } from "@noir/core";

import { atomicWrite } from "./generated/atomic-write";
import { findFiles } from "./generated/file-discovery";
import type { ObservationStore } from "./observation-store";

function partitionPath(rootDirectory: string, timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf()))
    throw new Error(`Invalid date: ${timestamp}`);
  const [year, month, day] = date.toISOString().slice(0, 10).split("-");
  return path.join(
    rootDirectory,
    "data",
    "observations",
    year ?? "unknown",
    month ?? "unknown",
    `${day ?? "unknown"}.jsonl`,
  );
}

async function readJsonl(filePath: string): Promise<Observation[]> {
  const text = await readFile(filePath, "utf8");
  return text
    .split("\n")
    .filter(Boolean)
    .map((line, index) => {
      try {
        return observationSchema.parse(JSON.parse(line));
      } catch (error) {
        throw new Error(
          `Invalid observation in ${filePath} at line ${index + 1}: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    });
}

function sortObservations(observations: Observation[]): Observation[] {
  return [...observations].sort(
    (left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) ||
      left.id.localeCompare(right.id),
  );
}

export class JsonlObservationStore implements ObservationStore {
  private readonly directory: string;

  constructor(private readonly rootDirectory: string) {
    this.directory = path.join(rootDirectory, "data", "observations");
  }

  async readAll(): Promise<Observation[]> {
    const files = await findFiles(this.directory, ".jsonl");
    const batches = await Promise.all(files.map(readJsonl));
    return sortObservations(batches.flat());
  }

  async append(observations: Observation[]): Promise<number> {
    const validated = observations.map((item) => observationSchema.parse(item));
    const knownIds = new Set((await this.readAll()).map((item) => item.id));
    const unique = validated.filter((item) => {
      if (knownIds.has(item.id)) return false;
      knownIds.add(item.id);
      return true;
    });
    const partitions = new Map<string, Observation[]>();
    for (const observation of unique) {
      const filePath = partitionPath(
        this.rootDirectory,
        observation.collectedAt,
      );
      partitions.set(filePath, [
        ...(partitions.get(filePath) ?? []),
        observation,
      ]);
    }
    for (const [filePath, additions] of partitions) {
      let existing: Observation[] = [];
      try {
        existing = await readJsonl(filePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const content = sortObservations([...existing, ...additions])
        .map((item) => JSON.stringify(item))
        .join("\n");
      await atomicWrite(filePath, `${content}\n`);
    }
    return unique.length;
  }
}
