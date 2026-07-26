import { readFile } from "node:fs/promises";
import path from "node:path";

import { modelLabRunReportSchema, type ModelLabRunReport } from "@noir/core";

import { atomicWrite } from "./generated/atomic-write";
import { findFiles } from "./generated/file-discovery";
import type { ModelLabRunReportStore } from "./model-lab-store";

function reportPath(root: string, report: ModelLabRunReport) {
  const [year, month, day] = report.startedAt.slice(0, 10).split("-");
  return path.join(
    root,
    "data",
    "model-lab-runs",
    year ?? "unknown",
    month ?? "unknown",
    day ?? "unknown",
    `${report.runId.replace(/[^a-zA-Z0-9._-]/g, "-")}.json`,
  );
}
export class JsonModelLabRunReportStore implements ModelLabRunReportStore {
  private readonly directory: string;
  constructor(private readonly root: string) {
    this.directory = path.join(root, "data", "model-lab-runs");
  }
  async readAll() {
    return (
      await Promise.all(
        (await findFiles(this.directory, ".json")).map(async (file) =>
          modelLabRunReportSchema.parse(
            JSON.parse(await readFile(file, "utf8")),
          ),
        ),
      )
    ).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }
  async write(report: ModelLabRunReport) {
    const value = modelLabRunReportSchema.parse(report);
    await atomicWrite(
      reportPath(this.root, value),
      `${JSON.stringify(value, null, 2)}\n`,
    );
  }
}
