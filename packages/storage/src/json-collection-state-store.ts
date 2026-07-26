import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  sourceCollectionStateSchema,
  type SourceCollectionState,
} from "@noir/core";

import { atomicWrite } from "./generated/atomic-write";
import type { CollectionStateStore } from "./observation-store";

function assertSourceId(sourceId: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sourceId)) {
    throw new Error(`Invalid source ID: ${sourceId}`);
  }
}

export class JsonCollectionStateStore implements CollectionStateStore {
  private readonly directory: string;

  constructor(rootDirectory: string) {
    this.directory = path.join(rootDirectory, "data", "state");
  }

  async read(sourceId: string): Promise<SourceCollectionState | undefined> {
    assertSourceId(sourceId);
    try {
      const content = await readFile(
        path.join(this.directory, `${sourceId}.json`),
        "utf8",
      );
      return sourceCollectionStateSchema.parse(JSON.parse(content));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async write(state: SourceCollectionState): Promise<void> {
    const validated = sourceCollectionStateSchema.parse(state);
    await atomicWrite(
      path.join(this.directory, `${validated.sourceId}.json`),
      `${JSON.stringify(validated, null, 2)}\n`,
    );
  }
}
