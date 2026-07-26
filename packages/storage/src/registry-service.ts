import {
  categorySchema,
  createSourceId,
  normalizeLocator,
  normalizeTags,
  sourceConfigSchema,
  toStableId,
  validateCategoryReferences,
  type Category,
  type ResolvedSource,
  type SourceCandidate,
  type SourceConfig,
  type SourceUpdate,
} from "@noir/core";

import type { RegistrySnapshot, RegistryStore } from "./registry-store";

export type Clock = () => Date;

export class RegistryService {
  constructor(
    private readonly store: RegistryStore,
    private readonly clock: Clock = () => new Date(),
  ) {}

  async snapshot(): Promise<RegistrySnapshot> {
    return this.store.read();
  }

  async validate(): Promise<RegistrySnapshot> {
    return this.snapshot();
  }

  async addSource(
    candidate: SourceCandidate,
    resolved: ResolvedSource,
  ): Promise<SourceConfig> {
    const snapshot = await this.snapshot();
    const locator = normalizeLocator(candidate.kind, resolved.locator);
    const id = createSourceId(candidate.kind, locator);
    const now = this.clock().toISOString();

    if (
      !snapshot.taxonomy.categories.some(
        (category) => category.id === candidate.categoryId,
      )
    ) {
      throw new Error(`Unknown category: ${candidate.categoryId}`);
    }

    if (
      snapshot.registry.sources.some(
        (source) =>
          source.id === id ||
          (source.kind === candidate.kind && source.locator === locator),
      )
    ) {
      throw new Error(`Source already exists: ${candidate.kind}:${locator}`);
    }

    const source = sourceConfigSchema.parse({
      id,
      kind: candidate.kind,
      locator,
      displayName: candidate.displayName?.trim() || resolved.displayName,
      description: candidate.description?.trim() || resolved.description,
      categoryId: candidate.categoryId,
      tags: normalizeTags(candidate.tags),
      enabled: candidate.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    });

    await this.store.writeRegistry({
      ...snapshot.registry,
      sources: [...snapshot.registry.sources, source],
    });
    return source;
  }

  async updateSource(id: string, update: SourceUpdate): Promise<SourceConfig> {
    const snapshot = await this.snapshot();
    const index = snapshot.registry.sources.findIndex(
      (source) => source.id === id,
    );
    if (index < 0) {
      throw new Error(`Unknown source: ${id}`);
    }

    if (
      update.categoryId &&
      !snapshot.taxonomy.categories.some(
        (category) => category.id === update.categoryId,
      )
    ) {
      throw new Error(`Unknown category: ${update.categoryId}`);
    }

    const current = snapshot.registry.sources[index];
    if (!current) {
      throw new Error(`Unknown source: ${id}`);
    }

    const description =
      update.description === null
        ? undefined
        : (update.description?.trim() ?? current.description);
    const updated = sourceConfigSchema.parse({
      ...current,
      ...(update.displayName ? { displayName: update.displayName.trim() } : {}),
      ...(description ? { description } : { description: undefined }),
      ...(update.categoryId ? { categoryId: update.categoryId } : {}),
      ...(update.tags ? { tags: normalizeTags(update.tags) } : {}),
      ...(update.enabled === undefined ? {} : { enabled: update.enabled }),
      updatedAt: this.clock().toISOString(),
    });

    const sources = [...snapshot.registry.sources];
    sources[index] = updated;
    await this.store.writeRegistry({ ...snapshot.registry, sources });
    return updated;
  }

  async setSourceEnabled(id: string, enabled: boolean): Promise<SourceConfig> {
    return this.updateSource(id, { enabled });
  }

  async addCategory(input: {
    name: string;
    description?: string;
  }): Promise<Category> {
    const snapshot = await this.snapshot();
    const id = toStableId(input.name);
    if (snapshot.taxonomy.categories.some((category) => category.id === id)) {
      throw new Error(`Category already exists: ${id}`);
    }

    const category = categorySchema.parse({
      id,
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
    });
    await this.store.writeTaxonomy({
      ...snapshot.taxonomy,
      categories: [...snapshot.taxonomy.categories, category],
    });
    return category;
  }

  async updateCategory(
    id: string,
    update: { name?: string; description?: string | null },
  ): Promise<Category> {
    const snapshot = await this.snapshot();
    const index = snapshot.taxonomy.categories.findIndex(
      (category) => category.id === id,
    );
    const current = snapshot.taxonomy.categories[index];
    if (!current) {
      throw new Error(`Unknown category: ${id}`);
    }

    const description =
      update.description === null
        ? undefined
        : (update.description?.trim() ?? current.description);
    const updated = categorySchema.parse({
      ...current,
      ...(update.name ? { name: update.name.trim() } : {}),
      ...(description ? { description } : { description: undefined }),
    });
    const categories = [...snapshot.taxonomy.categories];
    categories[index] = updated;
    await this.store.writeTaxonomy({ ...snapshot.taxonomy, categories });
    return updated;
  }

  async assertCategoryReferences(): Promise<void> {
    const snapshot = await this.snapshot();
    const missing = validateCategoryReferences(
      snapshot.registry.sources.map((source) => source.categoryId),
      snapshot.taxonomy,
    );
    if (missing.length > 0) {
      throw new Error(`Unknown categories: ${missing.join(", ")}`);
    }
  }
}
