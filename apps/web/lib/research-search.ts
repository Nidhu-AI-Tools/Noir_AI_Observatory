import type {
  ResearchIndexData,
  ResearchSearchDocument,
} from "@noir/dashboard-data";

import type { ResearchUrlState } from "./research-url";

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type ResearchSearchContext = {
  generatedAt: string;
  facets: Pick<
    ResearchIndexData["facets"],
    "organizations" | "venues" | "topics"
  >;
};

function queryValue(state: ResearchUrlState, index: ResearchSearchContext) {
  const query = normalize(state.query);
  for (const dimension of [
    index.facets.organizations,
    index.facets.venues,
    index.facets.topics,
  ])
    for (const facet of dimension)
      if (
        [facet.name, ...facet.aliases].some(
          (alias) => normalize(alias) === query,
        )
      )
        return facet.id.replaceAll("-", " ");
  return query;
}

function score(document: ResearchSearchDocument, query: string) {
  if (!query) return 0;
  const tokens = query.split(" ").filter(Boolean);
  const facets = [
    ...document.organizationIds,
    ...document.venueIds,
    ...document.topicIds,
    ...document.tags,
    ...document.arxivCategories,
    ...document.sourceIds,
  ]
    .join(" ")
    .replaceAll("-", " ")
    .toLowerCase();
  const all = `${document.title} ${document.people} ${document.summary} ${document.sources} ${facets}`;
  if (!tokens.every((token) => all.includes(token))) return -1;
  return (
    (document.title === query ? 100 : 0) +
    (document.title.includes(query) ? 50 : 0) +
    tokens.filter((token) => document.title.includes(token)).length * 10 +
    tokens.filter((token) => facets.includes(token)).length * 8 +
    tokens.filter((token) => document.people.includes(token)).length * 6 +
    tokens.filter((token) => document.sources.includes(token)).length * 5 +
    tokens.filter((token) => document.summary.includes(token)).length * 2
  );
}

export interface ResearchMatch {
  document: ResearchSearchDocument;
  score: number;
}

export function searchResearch(
  documents: ResearchSearchDocument[],
  state: ResearchUrlState,
  index: ResearchSearchContext,
): ResearchMatch[] {
  const query = queryValue(state, index);
  const generatedAt = new Date(index.generatedAt).valueOf();
  const windowDays = { all: 0, "7d": 7, "30d": 30, "90d": 90, "1y": 365 }[
    state.window
  ];
  const matches = documents.flatMap((document): ResearchMatch[] => {
    const relevance = score(document, query);
    if (relevance < 0) return [];
    if (
      state.organization !== "all" &&
      !document.organizationIds.includes(state.organization)
    )
      return [];
    if (state.venue !== "all" && !document.venueIds.includes(state.venue))
      return [];
    if (state.topic !== "all" && !document.topicIds.includes(state.topic))
      return [];
    if (state.type !== "all" && document.type !== state.type) return [];
    if (state.source !== "all" && !document.sourceIds.includes(state.source))
      return [];
    if (state.tag !== "all" && !document.tags.includes(state.tag)) return [];
    if (
      state.arxiv !== "all" &&
      !document.arxivCategories.includes(state.arxiv)
    )
      return [];
    if (state.from && document.publishedAt.slice(0, 10) < state.from) return [];
    if (state.to && document.publishedAt.slice(0, 10) > state.to) return [];
    if (
      windowDays &&
      generatedAt - new Date(document.publishedAt).valueOf() >
        windowDays * 86_400_000
    )
      return [];
    return [{ document, score: relevance }];
  });
  return matches.sort((left, right) => {
    if (state.sort === "oldest")
      return (
        left.document.publishedAt.localeCompare(right.document.publishedAt) ||
        left.document.id.localeCompare(right.document.id)
      );
    if (state.sort === "relevance" && query)
      return (
        right.score - left.score ||
        right.document.publishedAt.localeCompare(left.document.publishedAt) ||
        left.document.id.localeCompare(right.document.id)
      );
    return (
      right.document.publishedAt.localeCompare(left.document.publishedAt) ||
      left.document.id.localeCompare(right.document.id)
    );
  });
}
