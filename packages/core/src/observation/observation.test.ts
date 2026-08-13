import { describe, expect, it } from "vitest";

import { createObservationId } from "./identity";
import {
  assertGitHubReleaseUrl,
  assertHuggingFaceModelUrl,
  assertHuggingFaceOwner,
  parseHuggingFaceModelIdentity,
} from "./provider-identity";
import { validateObservationProviderSemantics } from "./provider-validation";
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

  it("separates Hugging Face model names from provider identities", () => {
    expect(parseHuggingFaceModelIdentity("Qwen/new-model")).toEqual({
      owner: "Qwen",
      repository: "new-model",
      canonicalName: "Qwen/new-model",
      url: "https://huggingface.co/Qwen/new-model",
    });
    expect(() =>
      parseHuggingFaceModelIdentity("6a21fc4fd949accacad1f3b0"),
    ).toThrow(/owner\/repository/);
    expect(() =>
      assertHuggingFaceOwner("Qwen/new-model", "qwen"),
    ).not.toThrow();
    expect(() =>
      assertHuggingFaceModelUrl(
        "Qwen/new-model",
        "https://huggingface.co/Qwen/new-model",
      ),
    ).not.toThrow();
    expect(() =>
      assertHuggingFaceModelUrl(
        "Qwen/new-model",
        "https://huggingface.co/6a21fc4fd949accacad1f3b0",
      ),
    ).toThrow(/does not match/);
  });

  it("checks GitHub release URLs against repository and tag", () => {
    expect(() =>
      assertGitHubReleaseUrl(
        "langchain-ai/langchain",
        "langchain-openai==1.4.2",
        "https://github.com/langchain-ai/langchain/releases/tag/langchain-openai%3D%3D1.4.2",
      ),
    ).not.toThrow();
    expect(() =>
      assertGitHubReleaseUrl(
        "qdrant/qdrant",
        "v1",
        "https://github.com/other/repo/releases/tag/v1",
      ),
    ).toThrow(/does not match/);
  });

  it("validates provider fields together rather than independently", () => {
    const observation = observationSchema.parse({
      schemaVersion: 1,
      id: "obs_example",
      type: "huggingface_model_revision",
      provider: "huggingface",
      sourceId: "huggingface-qwen",
      externalId: "6a21fc4fd949accacad1f3b0",
      externalRevision: "abc123",
      title: "new-model",
      url: "https://huggingface.co/Qwen/new-model",
      occurredAt: "2026-07-26T00:00:00.000Z",
      collectedAt: "2026-07-26T01:00:00.000Z",
      categoryId: "foundation-model",
      sourceTags: ["llm"],
      details: {
        modelId: "Qwen/new-model",
        revision: "abc123",
        lastModified: "2026-07-26T00:00:00.000Z",
        tags: [],
        gated: false,
      },
    });
    const source = {
      id: "huggingface-qwen",
      kind: "huggingface_org" as const,
      locator: "qwen",
      displayName: "Qwen",
      categoryId: "foundation-model",
      tags: ["llm"],
      enabled: true,
      createdAt: "2026-07-25T00:00:00.000Z",
      updatedAt: "2026-07-25T00:00:00.000Z",
    };

    expect(() =>
      validateObservationProviderSemantics(observation, source),
    ).not.toThrow();
    expect(() =>
      validateObservationProviderSemantics(
        { ...observation, title: "wrong-model" },
        source,
      ),
    ).toThrow(/title does not match/);
  });
});
