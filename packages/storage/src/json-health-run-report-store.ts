import { readFile } from "node:fs/promises";
import path from "node:path";

import { healthRunReportSchema, type HealthRunReport } from "@noir/core";

import { atomicWrite } from "./generated/atomic-write";
import { findFiles } from "./generated/file-discovery";
import type { HealthRunReportStore } from "./health-store";

function reportPath(root: string, report: HealthRunReport): string {
  const [year, month, day] = report.startedAt.slice(0, 10).split("-");
  return path.join(
    root,
    "data",
    "health-runs",
    year ?? "unknown",
    month ?? "unknown",
    day ?? "unknown",
    `${report.runId.replace(/[^a-zA-Z0-9._-]/g, "-")}.json`,
  );
}
export class JsonHealthRunReportStore implements HealthRunReportStore {
  private readonly directory: string;
  constructor(private readonly rootDirectory: string) {
    this.directory = path.join(rootDirectory, "data", "health-runs");
  }
  async readAll(): Promise<HealthRunReport[]> {
    const reports = await Promise.all(
      (await findFiles(this.directory, ".json")).map(async (file) =>
        healthRunReportSchema.parse(JSON.parse(await readFile(file, "utf8"))),
      ),
    );
    return reports.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }
  async write(report: HealthRunReport): Promise<void> {
    const validated = healthRunReportSchema.parse(report);
    await atomicWrite(
      reportPath(this.rootDirectory, validated),
      `${JSON.stringify(validated, null, 2)}\n`,
    );
  }
}
