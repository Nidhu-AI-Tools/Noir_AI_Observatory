import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  modelCategoryRegistrySchema,
  modelIntelligenceConfigSchema,
  modelOverrideRegistrySchema,
  type ModelCategoryRegistry,
  type ModelOverrideRegistry,
} from "@noir/core";
import { parse, stringify } from "yaml";

import { atomicWrite } from "./generated/atomic-write";
import type {
  ModelCategoryStore,
  ModelIntelligenceConfigStore,
  ModelOverrideStore,
} from "./model-intelligence-store";

const yaml = (value: unknown) =>
  stringify(value, { indent: 2, lineWidth: 0, sortMapEntries: false });

export class YamlModelIntelligenceConfigStore implements ModelIntelligenceConfigStore {
  constructor(private readonly root: string) {}
  async read() {
    return modelIntelligenceConfigSchema.parse(
      parse(
        await readFile(
          path.join(this.root, "config", "model-intelligence.yaml"),
          "utf8",
        ),
      ),
    );
  }
}

export class YamlModelCategoryStore implements ModelCategoryStore {
  private readonly file: string;
  constructor(root: string) {
    this.file = path.join(root, "config", "model-categories.yaml");
  }
  async read() {
    return modelCategoryRegistrySchema.parse(
      parse(await readFile(this.file, "utf8")),
    );
  }
  async write(value: ModelCategoryRegistry) {
    const validated = modelCategoryRegistrySchema.parse({
      ...value,
      categories: [...value.categories].sort((a, b) =>
        a.id.localeCompare(b.id),
      ),
    });
    await atomicWrite(this.file, yaml(validated));
  }
}

export class YamlModelOverrideStore implements ModelOverrideStore {
  private readonly file: string;
  constructor(root: string) {
    this.file = path.join(root, "config", "model-overrides.yaml");
  }
  async read() {
    return modelOverrideRegistrySchema.parse(
      parse(await readFile(this.file, "utf8")),
    );
  }
  async write(value: ModelOverrideRegistry) {
    const validated = modelOverrideRegistrySchema.parse({
      ...value,
      models: [...value.models]
        .map((model) => ({
          ...model,
          aliases: [...model.aliases].sort(),
          categories: [...model.categories].sort(),
          tags: [...model.tags].sort(),
          modalities: [...model.modalities].sort(),
          availability: [...model.availability].sort(),
          links: [...model.links].sort((a, b) => a.url.localeCompare(b.url)),
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    });
    await atomicWrite(this.file, yaml(validated));
  }
}
