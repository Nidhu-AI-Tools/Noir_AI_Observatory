import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  modelIntelligenceRunReportSchema,
  type ModelIntelligenceRunReport,
} from "@noir/core";

import { atomicWrite } from "./generated/atomic-write";
import { findFiles } from "./generated/file-discovery";
import type { ModelIntelligenceRunReportStore } from "./model-intelligence-store";

function fileFor(root: string, report: ModelIntelligenceRunReport) {
  const [year, month, day] = report.startedAt.slice(0, 10).split("-");
  const id = report.runId.replace(/[^a-zA-Z0-9._-]/g, "-");
  return path.join(
    root,
    "data",
    "model-runs",
    year ?? "unknown",
    month ?? "unknown",
    day ?? "unknown",
    `${id}.json`,
  );
}
export class JsonModelIntelligenceRunReportStore implements ModelIntelligenceRunReportStore {
  private readonly directory: string;
  constructor(private readonly root: string) {
    this.directory = path.join(root, "data", "model-runs");
  }
  async readAll() {
    return (
      await Promise.all(
        (await findFiles(this.directory, ".json")).map(async (file) =>
          modelIntelligenceRunReportSchema.parse(
            JSON.parse(await readFile(file, "utf8")),
          ),
        ),
      )
    ).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }
  async write(report: ModelIntelligenceRunReport) {
    const value = modelIntelligenceRunReportSchema.parse(report);
    await atomicWrite(
      fileFor(this.root, value),
      `${JSON.stringify(value, null, 2)}\n`,
    );
  }
}
