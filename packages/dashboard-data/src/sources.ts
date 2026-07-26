import type { RegistrySnapshot } from "@noir/storage";

export interface DashboardSource {
  id: string;
  kind: "github_repo" | "huggingface_org";
  locator: string;
  displayName: string;
  description?: string;
  category: { id: string; name: string };
  tags: string[];
  enabled: boolean;
  externalUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface SourceDashboardData {
  schemaVersion: 1;
  generatedAt: string;
  summary: {
    total: number;
    enabled: number;
    disabled: number;
    categories: number;
  };
  filters: {
    categories: { id: string; name: string }[];
    tags: string[];
  };
  sources: DashboardSource[];
}

export function buildSourceDashboardData(
  snapshot: RegistrySnapshot,
  generatedAt = new Date(),
): SourceDashboardData {
  const categories = new Map(
    snapshot.taxonomy.categories.map((category) => [category.id, category]),
  );
  const sources = snapshot.registry.sources
    .map((source): DashboardSource => {
      const category = categories.get(source.categoryId);
      if (!category) {
        throw new Error(
          `Source ${source.id} references unknown category ${source.categoryId}.`,
        );
      }
      return {
        id: source.id,
        kind: source.kind,
        locator: source.locator,
        displayName: source.displayName,
        ...(source.description ? { description: source.description } : {}),
        category: { id: category.id, name: category.name },
        tags: source.tags,
        enabled: source.enabled,
        externalUrl:
          source.kind === "github_repo"
            ? `https://github.com/${source.locator}`
            : `https://huggingface.co/${source.locator}`,
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
      };
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
  const tags = [...new Set(sources.flatMap((source) => source.tags))].sort();
  const usedCategoryIds = new Set(sources.map((source) => source.category.id));
  const categoryFilters = snapshot.taxonomy.categories
    .filter((category) => usedCategoryIds.has(category.id))
    .map((category) => ({ id: category.id, name: category.name }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
    summary: {
      total: sources.length,
      enabled: sources.filter((source) => source.enabled).length,
      disabled: sources.filter((source) => !source.enabled).length,
      categories: usedCategoryIds.size,
    },
    filters: { categories: categoryFilters, tags },
    sources,
  };
}
