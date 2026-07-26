import { describe, expect, it } from "vitest";

import {
  createSourceId,
  normalizeLocator,
  normalizeTags,
  sourceRegistrySchema,
  toStableId,
} from "./index";

describe("toStableId", () => {
  it("normalizes a provider locator into a predictable identifier", () => {
    expect(toStableId(" Qdrant / Qdrant ")).toBe("qdrant-qdrant");
  });

  it("removes leading and trailing separators", () => {
    expect(toStableId("---Meta Llama---")).toBe("meta-llama");
  });
});

describe("source normalization", () => {
  it("normalizes provider URLs and creates stable source IDs", () => {
    expect(
      normalizeLocator("github_repo", "https://github.com/Qdrant/Qdrant.git"),
    ).toBe("qdrant/qdrant");
    expect(createSourceId("github_repo", "Qdrant/Qdrant")).toBe(
      "github-qdrant-qdrant",
    );
  });

  it("normalizes and deduplicates tags", () => {
    expect(normalizeTags(["Vector Search", "rag", "RAG"])).toEqual([
      "rag",
      "vector-search",
    ]);
  });
});

describe("source registry schema", () => {
  it("rejects duplicate provider locators", () => {
    const source = {
      id: "github-qdrant-qdrant",
      kind: "github_repo" as const,
      locator: "qdrant/qdrant",
      displayName: "Qdrant",
      categoryId: "vector-database",
      tags: ["rag"],
      enabled: true,
      createdAt: "2026-07-26T00:00:00.000Z",
      updatedAt: "2026-07-26T00:00:00.000Z",
    };

    expect(
      sourceRegistrySchema.safeParse({
        version: 1,
        sources: [source, { ...source, id: "github-qdrant-copy" }],
      }).success,
    ).toBe(false);
  });
});
