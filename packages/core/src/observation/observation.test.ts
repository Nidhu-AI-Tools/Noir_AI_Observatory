import { describe, expect, it } from "vitest";

import { createObservationId } from "./identity";
import { observationSchema } from "./schema";

describe("observation domain", () => {
  it("creates stable identities and separates model revisions", () => {
    const first = createObservationId(
      "huggingface_model_revision",
      "huggingface-qwen",
      "Qwen/model",
      "abc",
    );
    expect(
      createObservationId(
        "huggingface_model_revision",
        "huggingface-qwen",
        "Qwen/model",
        "abc",
      ),
    ).toBe(first);
    expect(
      createObservationId(
        "huggingface_model_revision",
        "huggingface-qwen",
        "Qwen/model",
        "def",
      ),
    ).not.toBe(first);
  });

  it("validates a normalized GitHub release", () => {
    const result = observationSchema.safeParse({
      schemaVersion: 1,
      id: createObservationId("github_release", "github-qdrant-qdrant", "42"),
      type: "github_release",
      provider: "github",
      sourceId: "github-qdrant-qdrant",
      externalId: "42",
      title: "v1.0.0",
      url: "https://github.com/qdrant/qdrant/releases/tag/v1.0.0",
      occurredAt: "2026-07-26T00:00:00.000Z",
      collectedAt: "2026-07-26T01:00:00.000Z",
      categoryId: "vector-database",
      sourceTags: ["rag"],
      details: {
        releaseId: "42",
        tagName: "v1.0.0",
        createdAt: "2026-07-25T23:00:00.000Z",
        publishedAt: "2026-07-26T00:00:00.000Z",
        prerelease: false,
        assetCount: 2,
      },
    });
    expect(result.success).toBe(true);
  });
});
