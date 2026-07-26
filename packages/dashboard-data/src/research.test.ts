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
    );
    expect(result.summary.papers7Days).toBe(1);
    expect(result.items[0]?.matchScore).toBe(7);
    expect(result.items[0]?.matchReasons).toContain("Matched arXiv AI");
    expect(result.trends.tags[0]).toEqual({ name: "ai", count: 1 });
  });
});
