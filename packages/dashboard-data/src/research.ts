import type {
  ResearchDiscoveryTaxonomy,
  ResearchItem,
  ResearchRegistry,
  ResearchRunReport,
} from "@noir/core";

export interface ResearchFacetEvidence {
  kind: "source-configuration" | "taxonomy-rule" | "provider-metadata";
  sourceId?: string;
  ruleId?: string;
  input?: string;
  provider?: string;
  field?: string;
  value?: string;
}

export interface DashboardResearchFacet {
  id: string;
  name: string;
  evidence: ResearchFacetEvidence[];
}

export type DashboardResearchItem = ResearchItem & {
  sourceNames: string[];
  facets: {
    organizations: DashboardResearchFacet[];
    venues: DashboardResearchFacet[];
    topics: DashboardResearchFacet[];
  };
};

export type ResearchCoverageStatus =
  "available" | "configured-empty" | "not-configured";

export interface ResearchCoverageEntry {
  id: string;
  name: string;
  aliases: string[];
  count: number;
  status: ResearchCoverageStatus;
  sourceIds: string[];
}

export interface ResearchIndexData {
  schemaVersion: 2;
  generatedAt: string;
  summary: {
    total: number;
    papersToday: number;
    papers7Days: number;
    announcements7Days: number;
    activeSources: number;
  };
  latestRun?: ResearchRunReport;
  pageSize: number;
  pageCount: number;
  pages: { page: number; path: string; count: number }[];
  searchIndexPath: string;
  sources: {
    id: string;
    displayName: string;
    kind: ResearchRegistry["sources"][number]["kind"];
    locator: string;
    category: string;
    tags: string[];
    weight: number;
    enabled: boolean;
    facetDefaults: {
      organizations: string[];
      venues: string[];
      topics: string[];
    };
    coverageDescription?: string;
  }[];
  facets: {
    organizations: ResearchCoverageEntry[];
    venues: ResearchCoverageEntry[];
    topics: ResearchCoverageEntry[];
    sources: { id: string; name: string; count: number }[];
    tags: { id: string; name: string; count: number }[];
    arxivCategories: { id: string; name: string; count: number }[];
  };
  trends: {
    topics: { name: string; count: number }[];
    arxivCategories: { name: string; count: number }[];
    publishers: { name: string; count: number }[];
  };
}

export interface ResearchPageData {
  schemaVersion: 1;
  generatedAt: string;
  page: number;
  pageSize: number;
  total: number;
  items: DashboardResearchItem[];
}

export interface ResearchSearchDocument {
  id: string;
  page: number;
  ordinal: number;
  publishedAt: string;
  type: ResearchItem["type"];
  sourceIds: string[];
  organizationIds: string[];
  venueIds: string[];
  topicIds: string[];
  tags: string[];
  arxivCategories: string[];
  title: string;
  people: string;
  summary: string;
  sources: string;
}

export interface ResearchSearchIndexData {
  schemaVersion: 1;
  generatedAt: string;
  documents: ResearchSearchDocument[];
}

export interface ResearchDashboardBuild {
  index: ResearchIndexData;
  pages: Map<number, ResearchPageData>;
  search: ResearchSearchIndexData;
}

const emptyDefaults = () => ({ organizations: [], venues: [], topics: [] });

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function counts(values: string[]) {
  const totals = new Map<string, number>();
  for (const value of values) totals.set(value, (totals.get(value) ?? 0) + 1);
  return [...totals]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function configuredSources(
  registry: ResearchRegistry,
  dimension: "organizations" | "venues" | "topics",
  id: string,
) {
  return registry.sources
    .filter(
      (source) =>
        source.enabled && source.facetDefaults?.[dimension].includes(id),
    )
    .map((source) => source.id)
    .sort();
}

export function buildResearchDashboardData(
  registry: ResearchRegistry,
  items: ResearchItem[],
  reports: ResearchRunReport[],
  generatedAt = new Date(),
  pageSize = 24,
  taxonomy: ResearchDiscoveryTaxonomy = {
    version: 1,
    organizations: [],
    venues: [],
    topics: [],
  },
): ResearchDashboardBuild {
  const now = generatedAt.valueOf();
  const sourceById = new Map(
    registry.sources.map((source) => [source.id, source]),
  );
  const organizations = new Map(
    taxonomy.organizations.map((value) => [value.id, value]),
  );
  const venues = new Map(taxonomy.venues.map((value) => [value.id, value]));
  const topics = new Map(taxonomy.topics.map((value) => [value.id, value]));

  const visible = items
    .filter((item) => new Date(item.publishedAt).valueOf() <= now)
    .sort(
      (left, right) =>
        right.publishedAt.localeCompare(left.publishedAt) ||
        left.id.localeCompare(right.id),
    )
    .map((item): DashboardResearchItem => {
      const sources = item.sourceIds.flatMap((id) => {
        const source = sourceById.get(id);
        return source ? [source] : [];
      });
      const facet = (
        dimension: "organizations" | "venues" | "topics",
        values: Map<string, { id: string; name: string }>,
      ): DashboardResearchFacet[] => {
        const ids = new Set(
          sources.flatMap((source) => source.facetDefaults?.[dimension] ?? []),
        );
        const providerDimension =
          dimension === "organizations"
            ? "organization"
            : dimension === "venues"
              ? "venue"
              : undefined;
        if (providerDimension)
          for (const assertion of item.facetEvidence ?? [])
            if (assertion.dimension === providerDimension) {
              if (!values.has(assertion.facetId))
                throw new Error(
                  `Research item ${item.id} references unknown ${dimension} facet ${assertion.facetId}.`,
                );
              ids.add(assertion.facetId);
            }
        if (dimension === "topics")
          for (const topic of taxonomy.topics) {
            const categories =
              item.type === "research_paper" ? item.categories : [];
            if (
              topic.mappings.arxivCategories.some((value) =>
                categories.includes(value),
              ) ||
              topic.mappings.tags.some((value) => item.tags.includes(value))
            )
              ids.add(topic.id);
          }
        return [...ids]
          .flatMap((id) => {
            const value = values.get(id);
            if (!value) return [];
            const evidence: ResearchFacetEvidence[] = [
              ...sources
                .filter((source) =>
                  source.facetDefaults?.[dimension].includes(id),
                )
                .map((source) => ({
                  kind: "source-configuration" as const,
                  sourceId: source.id,
                })),
              ...(providerDimension
                ? (item.facetEvidence ?? [])
                    .filter(
                      (assertion) =>
                        assertion.dimension === providerDimension &&
                        assertion.facetId === id,
                    )
                    .map((assertion) => ({
                      kind: "provider-metadata" as const,
                      provider: assertion.provider,
                      field: assertion.field,
                      value: assertion.value,
                    }))
                : []),
              ...(dimension === "topics"
                ? taxonomy.topics
                    .filter((topic) => topic.id === id)
                    .flatMap((topic) => [
                      ...topic.mappings.arxivCategories
                        .filter(
                          (category) =>
                            item.type === "research_paper" &&
                            item.categories.includes(category),
                        )
                        .map((category) => ({
                          kind: "taxonomy-rule" as const,
                          ruleId: "research-taxonomy-v1",
                          input: category,
                        })),
                      ...topic.mappings.tags
                        .filter((tag) => item.tags.includes(tag))
                        .map((tag) => ({
                          kind: "taxonomy-rule" as const,
                          ruleId: "research-taxonomy-v1",
                          input: tag,
                        })),
                    ])
                : []),
            ];
            return [{ id, name: value.name, evidence }];
          })
          .sort((left, right) => left.name.localeCompare(right.name));
      };
      return {
        ...item,
        sourceNames: item.sourceIds.map(
          (id) => sourceById.get(id)?.displayName ?? id,
        ),
        facets: {
          organizations: facet("organizations", organizations),
          venues: facet("venues", venues),
          topics: facet("topics", topics),
        },
      };
    });

  const pageCount = Math.ceil(visible.length / pageSize);
  const pages = new Map<number, ResearchPageData>();
  for (let page = 1; page <= pageCount; page += 1) {
    pages.set(page, {
      schemaVersion: 1,
      generatedAt: generatedAt.toISOString(),
      page,
      pageSize,
      total: visible.length,
      items: visible.slice((page - 1) * pageSize, page * pageSize),
    });
  }

  const facetCoverage = (
    dimension: "organizations" | "venues" | "topics",
    values: { id: string; name: string; aliases: string[] }[],
  ): ResearchCoverageEntry[] =>
    values.map((value) => {
      const count = visible.filter((item) =>
        item.facets[dimension].some((facet) => facet.id === value.id),
      ).length;
      const sourceIds = configuredSources(registry, dimension, value.id);
      const topicConfigured =
        dimension === "topics" &&
        taxonomy.topics.some(
          (topic) =>
            topic.id === value.id &&
            (topic.mappings.arxivCategories.length > 0 ||
              topic.mappings.tags.length > 0),
        ) &&
        registry.sources.some((source) => source.enabled);
      return {
        ...value,
        count,
        sourceIds,
        status: count
          ? "available"
          : sourceIds.length || topicConfigured
            ? "configured-empty"
            : "not-configured",
      };
    });

  const recent7 = visible.filter(
    (item) => now - new Date(item.publishedAt).valueOf() <= 604_800_000,
  );
  const latestRun = reports
    .filter((report) => report.finishedAt <= generatedAt.toISOString())
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))[0];
  const sourceCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  const arxivCounts = new Map<string, number>();
  for (const item of visible) {
    item.sourceIds.forEach((id) =>
      sourceCounts.set(id, (sourceCounts.get(id) ?? 0) + 1),
    );
    item.tags.forEach((tag) =>
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1),
    );
    if (item.type === "research_paper")
      item.categories.forEach((category) =>
        arxivCounts.set(category, (arxivCounts.get(category) ?? 0) + 1),
      );
  }

  const index: ResearchIndexData = {
    schemaVersion: 2,
    generatedAt: generatedAt.toISOString(),
    summary: {
      total: visible.length,
      papersToday: visible.filter(
        (item) =>
          item.type === "research_paper" &&
          item.publishedAt.slice(0, 10) ===
            generatedAt.toISOString().slice(0, 10),
      ).length,
      papers7Days: recent7.filter((item) => item.type === "research_paper")
        .length,
      announcements7Days: recent7.filter(
        (item) => item.type === "official_announcement",
      ).length,
      activeSources: registry.sources.filter((source) => source.enabled).length,
    },
    ...(latestRun ? { latestRun } : {}),
    pageSize,
    pageCount,
    pages: [...pages.values()].map((page) => ({
      page: page.page,
      path: `/generated/research/pages/${String(page.page).padStart(4, "0")}.json`,
      count: page.items.length,
    })),
    searchIndexPath: "/generated/research/search/index.json",
    sources: registry.sources
      .map((source) => ({
        id: source.id,
        displayName: source.displayName,
        kind: source.kind,
        locator: source.kind === "arxiv_query" ? source.query : source.url,
        category: source.category,
        tags: source.tags,
        weight: source.weight,
        enabled: source.enabled,
        facetDefaults: source.facetDefaults ?? emptyDefaults(),
        ...(source.coverageDescription
          ? { coverageDescription: source.coverageDescription }
          : {}),
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    facets: {
      organizations: facetCoverage("organizations", taxonomy.organizations),
      venues: facetCoverage("venues", taxonomy.venues),
      topics: facetCoverage("topics", taxonomy.topics),
      sources: registry.sources
        .map((source) => ({
          id: source.id,
          name: source.displayName,
          count: sourceCounts.get(source.id) ?? 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      tags: [...tagCounts]
        .map(([id, count]) => ({ id, name: id, count }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      arxivCategories: [...arxivCounts]
        .map(([id, count]) => ({ id, name: id, count }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    },
    trends: {
      topics: counts(
        recent7.flatMap((item) =>
          item.facets.topics.map((topic) => topic.name),
        ),
      ).slice(0, 10),
      arxivCategories: counts(
        recent7.flatMap((item) =>
          item.type === "research_paper" ? item.categories : [],
        ),
      ).slice(0, 10),
      publishers: counts(
        recent7.flatMap((item) =>
          item.type === "official_announcement" ? [item.publisher] : [],
        ),
      ).slice(0, 10),
    },
  };

  const search: ResearchSearchIndexData = {
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
    documents: visible.map((item, ordinal) => ({
      id: item.id,
      page: Math.floor(ordinal / pageSize) + 1,
      ordinal,
      publishedAt: item.publishedAt,
      type: item.type,
      sourceIds: item.sourceIds,
      organizationIds: item.facets.organizations.map((value) => value.id),
      venueIds: item.facets.venues.map((value) => value.id),
      topicIds: item.facets.topics.map((value) => value.id),
      tags: item.tags,
      arxivCategories: item.type === "research_paper" ? item.categories : [],
      title: normalize(item.title),
      people: normalize(
        item.type === "research_paper"
          ? item.authors.join(" ")
          : [item.publisher, ...(item.authors ?? [])].join(" "),
      ),
      summary: normalize(item.summaryExcerpt ?? "").slice(0, 500),
      sources: normalize(item.sourceNames.join(" ")),
    })),
  };
  return { index, pages, search };
}
