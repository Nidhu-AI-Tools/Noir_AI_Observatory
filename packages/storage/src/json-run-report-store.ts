import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  collectionRunReportSchema,
  type CollectionRunReport,
} from "@noir/core";

import { atomicWrite } from "./generated/atomic-write";
import { findFiles } from "./generated/file-discovery";
import type { RunReportStore } from "./observation-store";

function reportPath(
  rootDirectory: string,
  report: CollectionRunReport,
): string {
  const [year, month, day] = report.startedAt.slice(0, 10).split("-");
  const safeRunId = report.runId.replace(/[^a-zA-Z0-9._-]/g, "-");
  return path.join(
    rootDirectory,
    "data",
    "runs",
    year ?? "unknown",
    month ?? "unknown",
    day ?? "unknown",
    `${safeRunId}.json`,
  );
}

export class JsonRunReportStore implements RunReportStore {
  private readonly directory: string;

  constructor(private readonly rootDirectory: string) {
    this.directory = path.join(rootDirectory, "data", "runs");
  }

  async readAll(): Promise<CollectionRunReport[]> {
    const files = await findFiles(this.directory, ".json");
    const reports = await Promise.all(
      files.map(async (filePath) =>
        collectionRunReportSchema.parse(
          JSON.parse(await readFile(filePath, "utf8")),
        ),
      ),
    );
    return reports.sort((left, right) =>
      left.startedAt.localeCompare(right.startedAt),
    );
  }

  async write(report: CollectionRunReport): Promise<void> {
    const validated = collectionRunReportSchema.parse(report);
    await atomicWrite(
      reportPath(this.rootDirectory, validated),
      `${JSON.stringify(validated, null, 2)}\n`,
    );
  }
}
