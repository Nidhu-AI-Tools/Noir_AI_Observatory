import type {
  ResearchItem,
  ResearchRegistry,
  ResearchRunReport,
} from "@noir/core";

export type DashboardResearchItem = ResearchItem & {
  sourceNames: string[];
  matchScore: number;
  matchReasons: string[];
};

export interface ResearchDashboardData {
  schemaVersion: 1;
  generatedAt: string;
  summary: {
    papersToday: number;
    papers7Days: number;
    announcements7Days: number;
    activeSources: number;
  };
  latestRun?: ResearchRunReport;
  sources: {
    id: string;
    displayName: string;
    kind: ResearchRegistry["sources"][number]["kind"];
    locator: string;
    category: string;
    tags: string[];
    weight: number;
    enabled: boolean;
  }[];
  filters: {
    sources: { id: string; name: string }[];
    categories: string[];
    tags: string[];
    arxivCategories: string[];
  };
  trends: {
    tags: { name: string; count: number }[];
    arxivCategories: { name: string; count: number }[];
    publishers: { name: string; count: number }[];
  };
  items: DashboardResearchItem[];
}

function counts(values: string[]) {
  const totals = new Map<string, number>();
  for (const value of values) totals.set(value, (totals.get(value) ?? 0) + 1);
  return [...totals]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function buildResearchDashboardData(
  registry: ResearchRegistry,
  items: ResearchItem[],
  reports: ResearchRunReport[],
  generatedAt = new Date(),
  itemLimit = 1_000,
): ResearchDashboardData {
  const now = generatedAt.valueOf();
  const sourceById = new Map(
    registry.sources.map((source) => [source.id, source]),
  );
  const visible = items
    .filter((item) => new Date(item.publishedAt).valueOf() <= now)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, itemLimit)
    .map((item): DashboardResearchItem => {
      const sources = item.sourceIds.flatMap((id) => {
        const source = sourceById.get(id);
        return source ? [source] : [];
      });
      const ageDays = Math.max(
        0,
        (now - new Date(item.publishedAt).valueOf()) / 86_400_000,
      );
      const sourceWeight = Math.max(
        1,
        ...sources.map((source) => source.weight),
      );
      const provenanceBonus = Math.min(
        2,
        Math.max(0, item.sourceIds.length - 1),
      );
      const recencyBonus =
        ageDays <= 1 ? 3 : ageDays <= 7 ? 2 : ageDays <= 30 ? 1 : 0;
      return {
        ...item,
        sourceNames: item.sourceIds.map(
          (id) => sourceById.get(id)?.displayName ?? id,
        ),
        matchScore: sourceWeight + provenanceBonus + recencyBonus,
        matchReasons: [
          ...item.sourceIds.map(
            (id) => `Matched ${sourceById.get(id)?.displayName ?? id}`,
          ),
          ...(provenanceBonus ? ["Matched more than one tracked source"] : []),
          ...(recencyBonus ? ["Recently published"] : []),
        ],
      };
    });
  const within = (item: ResearchItem, days: number) =>
    now - new Date(item.publishedAt).valueOf() <= days * 86_400_000;
  const recent7 = visible.filter((item) => within(item, 7));
  const latestRun = [...reports].sort((a, b) =>
    b.finishedAt.localeCompare(a.finishedAt),
  )[0];
  return {
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
    summary: {
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
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    filters: {
      sources: registry.sources
        .map((source) => ({ id: source.id, name: source.displayName }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      categories: [...new Set(visible.map((item) => item.category))].sort(),
      tags: [...new Set(visible.flatMap((item) => item.tags))].sort(),
      arxivCategories: [
        ...new Set(
          visible.flatMap((item) =>
            item.type === "research_paper" ? item.categories : [],
          ),
        ),
      ].sort(),
    },
    trends: {
      tags: counts(recent7.flatMap((item) => item.tags)).slice(0, 10),
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
    items: visible,
  };
}
