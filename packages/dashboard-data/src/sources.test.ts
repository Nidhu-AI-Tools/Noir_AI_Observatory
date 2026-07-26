import { describe, expect, it } from "vitest";

import { buildSourceDashboardData } from "./sources";

describe("buildSourceDashboardData", () => {
  it("resolves categories and calculates source counts", () => {
    const data = buildSourceDashboardData(
      {
        registry: {
          version: 1,
          sources: [
            {
              id: "github-qdrant-qdrant",
              kind: "github_repo",
              locator: "qdrant/qdrant",
              displayName: "Qdrant",
              categoryId: "vector-database",
              tags: ["rag", "vector-search"],
              enabled: true,
              createdAt: "2026-07-26T00:00:00.000Z",
              updatedAt: "2026-07-26T00:00:00.000Z",
            },
          ],
        },
        taxonomy: {
          version: 1,
          categories: [{ id: "vector-database", name: "Vector Database" }],
        },
      },
      new Date("2026-07-26T12:00:00.000Z"),
    );

    expect(data.summary).toEqual({
      total: 1,
      enabled: 1,
      disabled: 0,
      categories: 1,
    });
    expect(data.sources[0]?.category.name).toBe("Vector Database");
    expect(data.filters.tags).toEqual(["rag", "vector-search"]);
  });
});
