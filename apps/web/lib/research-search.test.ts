import type { ResearchSearchDocument } from "@noir/dashboard-data";
import { describe, expect, it } from "vitest";

import { searchResearch } from "./research-search";
import { defaultResearchUrlState } from "./research-url";

const index = {
  generatedAt: "2026-08-15T00:00:00.000Z",
  pageSize: 24,
  facets: {
    organizations: [
      {
        id: "meta-ai",
        name: "Meta AI",
        aliases: ["FAIR", "Facebook AI Research"],
        count: 1,
        status: "available" as const,
        sourceIds: ["official-meta"],
      },
    ],
    venues: [],
    topics: [],
  },
};

const documents: ResearchSearchDocument[] = [
  {
    id: "new-robotics",
    page: 1,
    ordinal: 0,
    publishedAt: "2026-08-14T00:00:00.000Z",
    type: "research_paper",
    sourceIds: ["arxiv-ai"],
    organizationIds: ["meta-ai"],
    venueIds: [],
    topicIds: ["robotics"],
    tags: ["research"],
    arxivCategories: ["cs.RO"],
    title: "robot learning at scale",
    people: "ada researcher",
    summary: "autonomous manipulation",
    sources: "arxiv artificial intelligence",
  },
  {
    id: "older-vision",
    page: 2,
    ordinal: 1,
    publishedAt: "2026-01-01T00:00:00.000Z",
    type: "research_paper",
    sourceIds: ["arxiv-ai"],
    organizationIds: [],
    venueIds: [],
    topicIds: ["computer-vision"],
    tags: [],
    arxivCategories: ["cs.CV"],
    title: "vision systems",
    people: "grace researcher",
    summary: "image recognition",
    sources: "arxiv artificial intelligence",
  },
];

describe("research search", () => {
  it("matches an organization alias and ranks deterministically", () => {
    const result = searchResearch(
      documents,
      { ...defaultResearchUrlState, query: "FAIR", sort: "relevance" },
      index,
    );
    expect(result.map((value) => value.document.id)).toEqual(["new-robotics"]);
  });

  it("combines facets and recent windows", () => {
    const result = searchResearch(
      documents,
      {
        ...defaultResearchUrlState,
        topic: "robotics",
        organization: "meta-ai",
        window: "7d",
      },
      index,
    );
    expect(result).toHaveLength(1);
  });

  it("sorts oldest first with stable IDs", () => {
    expect(
      searchResearch(
        documents,
        { ...defaultResearchUrlState, sort: "oldest" },
        index,
      ).map((value) => value.document.id),
    ).toEqual(["older-vision", "new-robotics"]);
  });
});
