import { readFile } from "node:fs/promises";
import path from "node:path";

import { researchRegistrySchema, type ResearchRegistry } from "@noir/core";
import { parse, stringify } from "yaml";

import { atomicWrite } from "./generated/atomic-write";
import type { ResearchRegistryStore } from "./research-store";

export class YamlResearchRegistryStore implements ResearchRegistryStore {
  private readonly filePath: string;
  constructor(rootDirectory: string) {
    this.filePath = path.join(rootDirectory, "config", "research-sources.yaml");
  }
  async read(): Promise<ResearchRegistry> {
    return researchRegistrySchema.parse(
      parse(await readFile(this.filePath, "utf8")),
    );
  }
  async write(registry: ResearchRegistry): Promise<void> {
    const validated = researchRegistrySchema.parse({
      ...registry,
      sources: [...registry.sources].sort((a, b) => a.id.localeCompare(b.id)),
    });
    await atomicWrite(
      this.filePath,
      stringify(validated, { indent: 2, lineWidth: 0, sortMapEntries: false }),
    );
  }
}
