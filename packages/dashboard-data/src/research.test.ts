import type { ResearchItem, ResearchRegistry } from "@noir/core";
import { describe, expect, it } from "vitest";

import { buildResearchDashboardData } from "./research";

describe("research dashboard data", () => {
  it("builds deterministic, explainable ranking and trends", () => {
    const registry: ResearchRegistry = {
      version: 1,
      sources: [
        {
          id: "arxiv-ai",
          kind: "arxiv_query",
          displayName: "arXiv AI",
          query: "cat:cs.AI",
          category: "research-paper",
          tags: ["ai"],
          weight: 4,
          enabled: true,
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
        },
      ],
    };
    const items: ResearchItem[] = [
      {
        schemaVersion: 1,
        id: "arxiv:1",
        type: "research_paper",
        provider: "arxiv",
        sourceIds: ["arxiv-ai"],
        title: "A Paper",
        url: "https://arxiv.org/abs/1",
        publishedAt: "2026-07-25T12:00:00.000Z",
        collectedAt: "2026-07-26T00:00:00.000Z",
        category: "research-paper",
        tags: ["ai"],
        arxivId: "1",
        authors: ["Ada"],
        abstractExcerpt: "Abstract",
        primaryCategory: "cs.AI",
        categories: ["cs.AI"],
        pdfUrl: "https://arxiv.org/pdf/1",
      },
    ];
    const result = buildResearchDashboardData(
      registry,
      items,
      [],
      new Date("2026-07-26T00:00:00.000Z"),
      24,
      {
        version: 1,
        organizations: [
          {
            id: "google-research",
            name: "Google Research",
            aliases: ["Google AI"],
          },
        ],
        venues: [],
        topics: [
          {
            id: "artificial-intelligence",
            name: "Artificial Intelligence",
            aliases: ["AI"],
            mappings: { arxivCategories: ["cs.AI"], tags: [] },
          },
          {
            id: "robotics",
            name: "Robotics",
            aliases: [],
            mappings: { arxivCategories: ["cs.RO"], tags: [] },
          },
        ],
      },
    );
    expect(result.index.summary.papers7Days).toBe(1);
    expect(result.index.pageCount).toBe(1);
    expect(result.pages.get(1)?.items).toHaveLength(1);
    expect(result.search.documents[0]).toMatchObject({
      id: "arxiv:1",
      page: 1,
      topicIds: ["artificial-intelligence"],
    });
    expect(result.pages.get(1)?.items[0]?.facets.topics[0]?.id).toBe(
      "artificial-intelligence",
    );
    expect(result.index.trends.topics[0]).toEqual({
      name: "Artificial Intelligence",
      count: 1,
    });
    expect(result.index.facets.organizations[0]?.status).toBe("not-configured");
    expect(result.index.facets.topics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "robotics",
          status: "configured-empty",
        }),
      ]),
    );

    const paginated = buildResearchDashboardData(
      registry,
      Array.from({ length: 25 }, (_, index) => ({
        ...items[0]!,
        id: `arxiv:${index}`,
        arxivId: String(index),
      })),
      [],
      new Date("2026-07-26T00:00:00.000Z"),
    );
    expect(paginated.index.pageCount).toBe(2);
    expect(paginated.pages.get(1)?.items).toHaveLength(24);
    expect(paginated.pages.get(2)?.items).toHaveLength(1);
  });
});
