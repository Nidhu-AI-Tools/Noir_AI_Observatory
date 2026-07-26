import type { SourceRegistry, Taxonomy } from "@noir/core";

export interface RegistrySnapshot {
  registry: SourceRegistry;
  taxonomy: Taxonomy;
}

export interface RegistryStore {
  read(): Promise<RegistrySnapshot>;
  writeRegistry(registry: SourceRegistry): Promise<void>;
  writeTaxonomy(taxonomy: Taxonomy): Promise<void>;
}
