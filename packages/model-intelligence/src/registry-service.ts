import {
  modelCategoryRegistrySchema,
  modelOverrideRegistrySchema,
  modelOverrideSchema,
  type ModelAvailability,
  type ModelOverride,
} from "@noir/core";
import type { ModelCategoryStore, ModelOverrideStore } from "@noir/storage";

import { modelIdForExternalId, slug } from "./identity";

export interface ModelCandidate {
  canonicalName: string;
  organization: string;
  categories: string[];
  tags?: string[];
  modalities?: string[];
  availability: ModelAvailability[];
  externalModelId?: string;
  currentVersion?: string;
  releasedAt?: string;
  license?: string;
  links: ModelOverride["links"];
  notes?: string;
}
export type ModelUpdate = Partial<
  Pick<
    ModelOverride,
    | "canonicalName"
    | "organization"
    | "aliases"
    | "categories"
    | "tags"
    | "modalities"
    | "availability"
    | "lifecycle"
    | "externalModelId"
    | "currentVersion"
    | "releasedAt"
    | "license"
    | "parameterCount"
    | "contextWindow"
    | "links"
    | "notes"
    | "enabled"
  >
>;

export class ModelIntelligenceRegistryService {
  constructor(
    private readonly categories: ModelCategoryStore,
    private readonly overrides: ModelOverrideStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}
  async validate() {
    const [categoryRegistry, modelRegistry] = await Promise.all([
      this.categories.read(),
      this.overrides.read(),
    ]);
    const categoryIds = new Set(
      categoryRegistry.categories.map((category) => category.id),
    );
    for (const model of modelRegistry.models)
      for (const category of model.categories)
        if (!categoryIds.has(category))
          throw new Error(
            `Model ${model.id} references unknown category ${category}.`,
          );
    return { categories: categoryRegistry, models: modelRegistry };
  }
  async add(candidate: ModelCandidate) {
    const { categories, models } = await this.validate();
    for (const category of candidate.categories)
      if (!categories.categories.some((item) => item.id === category))
        throw new Error(`Unknown model category: ${category}`);
    const base = candidate.externalModelId
      ? modelIdForExternalId(candidate.externalModelId)
      : `model-${slug(`${candidate.organization}-${candidate.canonicalName}`)}`;
    let id = base;
    let suffix = 2;
    while (models.models.some((model) => model.id === id))
      id = `${base}-${suffix++}`;
    const now = this.clock().toISOString();
    const model = modelOverrideSchema.parse({
      id,
      ...candidate,
      aliases: [],
      tags: candidate.tags ?? [],
      modalities: candidate.modalities ?? [],
      lifecycle: "active",
      releasedAtInferred: false,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
    await this.overrides.write(
      modelOverrideRegistrySchema.parse({
        ...models,
        models: [...models.models, model],
      }),
    );
    return model;
  }
  async update(id: string, update: ModelUpdate) {
    const { models } = await this.validate();
    const current = models.models.find((model) => model.id === id);
    if (!current) throw new Error(`Unknown model: ${id}`);
    const model = modelOverrideSchema.parse({
      ...current,
      ...update,
      updatedAt: this.clock().toISOString(),
    });
    await this.overrides.write({
      ...models,
      models: models.models.map((item) => (item.id === id ? model : item)),
    });
    return model;
  }
  async addCategory(id: string, name: string, description: string) {
    const { categories } = await this.validate();
    const category = { id: slug(id), name, description };
    if (categories.categories.some((item) => item.id === category.id))
      throw new Error(`Model category already exists: ${category.id}`);
    await this.categories.write(
      modelCategoryRegistrySchema.parse({
        ...categories,
        categories: [...categories.categories, category],
      }),
    );
    return category;
  }
}
