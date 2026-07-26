import { readFile } from "node:fs/promises";
import path from "node:path";

import { healthCheckSchema, type HealthCheck } from "@noir/core";

import { atomicWrite } from "./generated/atomic-write";
import { findFiles } from "./generated/file-discovery";
import type { HealthCheckStore } from "./health-store";

function filePath(root: string, timestamp: string): string {
  const [year, month, day] = timestamp.slice(0, 10).split("-");
  return path.join(
    root,
    "data",
    "health-checks",
    year ?? "unknown",
    month ?? "unknown",
    `${day ?? "unknown"}.jsonl`,
  );
}
async function readJsonl(file: string): Promise<HealthCheck[]> {
  const text = await readFile(file, "utf8");
  return text
    .split("\n")
    .filter(Boolean)
    .map((line, index) => {
      try {
        return healthCheckSchema.parse(JSON.parse(line));
      } catch (error) {
        throw new Error(
          `Invalid health check in ${file} at line ${index + 1}: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    });
}
function sorted(items: HealthCheck[]): HealthCheck[] {
  return [...items].sort(
    (a, b) =>
      a.checkedAt.localeCompare(b.checkedAt) || a.id.localeCompare(b.id),
  );
}
export class JsonlHealthCheckStore implements HealthCheckStore {
  private readonly directory: string;
  constructor(private readonly rootDirectory: string) {
    this.directory = path.join(rootDirectory, "data", "health-checks");
  }
  async readAll(): Promise<HealthCheck[]> {
    return sorted(
      (
        await Promise.all(
          (await findFiles(this.directory, ".jsonl")).map(readJsonl),
        )
      ).flat(),
    );
  }
  async append(checks: HealthCheck[]): Promise<number> {
    const validated = checks.map((item) => healthCheckSchema.parse(item));
    const known = new Set((await this.readAll()).map((item) => item.id));
    const unique = validated.filter(
      (item) => !known.has(item.id) && Boolean(known.add(item.id)),
    );
    const partitions = new Map<string, HealthCheck[]>();
    for (const check of unique) {
      const file = filePath(this.rootDirectory, check.checkedAt);
      partitions.set(file, [...(partitions.get(file) ?? []), check]);
    }
    for (const [file, additions] of partitions) {
      let existing: HealthCheck[] = [];
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
