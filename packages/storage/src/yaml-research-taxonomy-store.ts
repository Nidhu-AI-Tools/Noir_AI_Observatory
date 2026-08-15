import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  researchDiscoveryTaxonomySchema,
  type ResearchDiscoveryTaxonomy,
} from "@noir/core";
import { parse } from "yaml";

export class YamlResearchTaxonomyStore {
  private readonly filePath: string;
  constructor(rootDirectory: string) {
    this.filePath = path.join(
      rootDirectory,
      "config",
      "research-taxonomy.yaml",
    );
  }

  async read(): Promise<ResearchDiscoveryTaxonomy> {
    return researchDiscoveryTaxonomySchema.parse(
      parse(await readFile(this.filePath, "utf8")),
    );
  }
}
