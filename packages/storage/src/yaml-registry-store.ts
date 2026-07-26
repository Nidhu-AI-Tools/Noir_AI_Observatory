import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  sourceRegistrySchema,
  taxonomySchema,
  validateCategoryReferences,
  type SourceRegistry,
  type Taxonomy,
} from "@noir/core";
import { parse, stringify } from "yaml";

import type { RegistrySnapshot, RegistryStore } from "./registry-store";

function serialize(value: unknown): string {
  return stringify(value, { indent: 2, lineWidth: 0, sortMapEntries: false });
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, content, "utf8");
  await rename(temporaryPath, filePath);
}

export class YamlRegistryStore implements RegistryStore {
  private readonly sourcesPath: string;
  private readonly taxonomyPath: string;

  constructor(rootDirectory: string) {
    this.sourcesPath = path.join(rootDirectory, "config", "sources.yaml");
    this.taxonomyPath = path.join(rootDirectory, "config", "taxonomy.yaml");
  }

  async read(): Promise<RegistrySnapshot> {
    const [sourcesText, taxonomyText] = await Promise.all([
      readFile(this.sourcesPath, "utf8"),
      readFile(this.taxonomyPath, "utf8"),
    ]);
    const registry = sourceRegistrySchema.parse(parse(sourcesText));
    const taxonomy = taxonomySchema.parse(parse(taxonomyText));
    const missingCategories = validateCategoryReferences(
      registry.sources.map((source) => source.categoryId),
      taxonomy,
    );

    if (missingCategories.length > 0) {
      throw new Error(
        `Sources reference unknown categories: ${missingCategories.join(", ")}`,
      );
    }

    return { registry, taxonomy };
  }

  async writeRegistry(registry: SourceRegistry): Promise<void> {
    const validated = sourceRegistrySchema.parse({
      ...registry,
      sources: [...registry.sources]
        .map((source) => ({ ...source, tags: [...source.tags].sort() }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    });
    await atomicWrite(this.sourcesPath, serialize(validated));
  }

  async writeTaxonomy(taxonomy: Taxonomy): Promise<void> {
    const validated = taxonomySchema.parse({
      ...taxonomy,
      categories: [...taxonomy.categories].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
    });
    await atomicWrite(this.taxonomyPath, serialize(validated));
  }
}
