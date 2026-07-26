import { readFile } from "node:fs/promises";
import path from "node:path";

import { researchRunReportSchema, type ResearchRunReport } from "@noir/core";

import { atomicWrite } from "./generated/atomic-write";
import { findFiles } from "./generated/file-discovery";
import type { ResearchRunReportStore } from "./research-store";

function reportPath(root: string, report: ResearchRunReport): string {
  const [year, month, day] = report.startedAt.slice(0, 10).split("-");
  return path.join(
    root,
    "data",
    "research-runs",
    year ?? "unknown",
    month ?? "unknown",
    day ?? "unknown",
    `${report.runId.replace(/[^a-zA-Z0-9._-]/g, "-")}.json`,
  );
}

export class JsonResearchRunReportStore implements ResearchRunReportStore {
  private readonly directory: string;
  constructor(private readonly rootDirectory: string) {
    this.directory = path.join(rootDirectory, "data", "research-runs");
  }
  async readAll(): Promise<ResearchRunReport[]> {
    const reports = await Promise.all(
      (await findFiles(this.directory, ".json")).map(async (file) =>
        researchRunReportSchema.parse(JSON.parse(await readFile(file, "utf8"))),
      ),
    );
    return reports.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }
  async write(report: ResearchRunReport): Promise<void> {
    const validated = researchRunReportSchema.parse(report);
    await atomicWrite(
      reportPath(this.rootDirectory, validated),
      `${JSON.stringify(validated, null, 2)}\n`,
    );
  }
}
