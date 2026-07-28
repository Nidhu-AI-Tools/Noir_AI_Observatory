import { readFile } from "node:fs/promises";
import path from "node:path";

import { curationConfigSchema } from "@noir/core";
import { parse } from "yaml";

import type { CurationConfigStore } from "./curation-store";

export class YamlCurationConfigStore implements CurationConfigStore {
  constructor(private readonly root: string) {}

  async read() {
    return curationConfigSchema.parse(
      parse(
        await readFile(path.join(this.root, "config", "curation.yaml"), "utf8"),
      ),
    );
  }
}
