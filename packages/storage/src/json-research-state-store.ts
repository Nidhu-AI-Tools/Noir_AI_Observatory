import { readFile } from "node:fs/promises";
import path from "node:path";

import { researchStateSchema, type ResearchState } from "@noir/core";

import { atomicWrite } from "./generated/atomic-write";
import type { ResearchStateStore } from "./research-store";

export class JsonResearchStateStore implements ResearchStateStore {
  constructor(private readonly rootDirectory: string) {}
  private path(sourceId: string) {
    return path.join(
      this.rootDirectory,
      "data",
      "research-state",
      `${sourceId}.json`,
    );
  }
  async read(sourceId: string): Promise<ResearchState | undefined> {
    try {
      return researchStateSchema.parse(
        JSON.parse(await readFile(this.path(sourceId), "utf8")),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }
  async write(state: ResearchState): Promise<void> {
    const validated = researchStateSchema.parse(state);
    await atomicWrite(
      this.path(validated.sourceId),
      `${JSON.stringify(validated, null, 2)}\n`,
    );
  }
}
