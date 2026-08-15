import { describe, expect, it } from "vitest";

import { researchItemSchema } from "./schema";
import { researchDiscoveryTaxonomySchema } from "./discovery-schema";

describe("research discovery taxonomy", () => {
  it("accepts reviewed aliases and deterministic topic mappings", () => {
    const taxonomy = researchDiscoveryTaxonomySchema.parse({
      version: 1,
      organizations: [{ id: "meta-ai", name: "Meta AI", aliases: ["FAIR"] }],
      venues: [],
      topics: [
        {
          id: "robotics",
          name: "Robotics",
          aliases: ["Robot Learning"],
          mappings: { arxivCategories: ["cs.RO"], tags: [] },
        },
      ],
    });
    expect(taxonomy.topics[0]?.mappings.arxivCategories).toEqual(["cs.RO"]);
  });

  it("rejects alias collisions within a facet dimension", () => {
    expect(() =>
      researchDiscoveryTaxonomySchema.parse({
        version: 1,
        organizations: [
          { id: "meta-ai", name: "Meta AI", aliases: ["FAIR"] },
          { id: "other-lab", name: "Other Lab", aliases: ["fair"] },
        ],
        venues: [],
        topics: [],
      }),
    ).toThrow(/Duplicate organizations alias/);
  });

  it("accepts provenance-backed facets on version 2 records", () => {
    const item = researchItemSchema.parse({
      schemaVersion: 2,
      id: "arxiv:1",
      type: "research_paper",
      provider: "arxiv",
      sourceIds: ["arxiv-ai"],
      title: "A Paper",
      url: "https://arxiv.org/abs/1",
      publishedAt: "2026-08-15T00:00:00.000Z",
      collectedAt: "2026-08-15T01:00:00.000Z",
      category: "research-paper",
      tags: [],
      arxivId: "1",
      authors: [],
      abstractExcerpt: "Abstract",
      primaryCategory: "cs.AI",
      categories: ["cs.AI"],
      pdfUrl: "https://arxiv.org/pdf/1",
      facetEvidence: [
        {
          dimension: "organization",
          facetId: "meta-ai",
          provider: "example-provider",
          field: "institution",
          value: "Meta AI",
        },
      ],
    });
    expect(item.schemaVersion).toBe(2);
  });
});
