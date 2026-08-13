import type { SourceConfig } from "@noir/core";
import { describe, expect, it } from "vitest";

import type { HttpClient, HttpResponse } from "../http-client";
import { GitHubReleaseCollector } from "./github-release-collector";
import {
  HuggingFaceModelCollector,
  type HuggingFaceModelClient,
} from "./huggingface-model-collector";

class FixtureHttpClient implements HttpClient {
  constructor(private readonly fixture: HttpResponse) {}
  async get<T>(): Promise<HttpResponse<T>> {
    return this.fixture as HttpResponse<T>;
  }
}

const githubSource: SourceConfig = {
  id: "github-qdrant-qdrant",
  kind: "github_repo",
  locator: "qdrant/qdrant",
  displayName: "Qdrant",
  categoryId: "vector-database",
  tags: ["rag"],
  enabled: true,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

const context = {
  collectedAt: new Date("2026-07-26T02:00:00.000Z"),
  lookbackDays: 7,
  maxObservationsPerSource: 100,
};

describe("observation collectors", () => {
  it("normalizes published GitHub releases and excludes drafts", async () => {
    const collector = new GitHubReleaseCollector(
      new FixtureHttpClient({
        status: 200,
        headers: new Headers({ etag: '"abc"' }),
        data: [
          {
            id: 2,
            html_url: "https://github.com/qdrant/qdrant/releases/tag/v2",
            tag_name: "v2",
            name: "Release 2",
            body: "Useful release notes",
            draft: false,
            prerelease: true,
            created_at: "2026-07-25T01:00:00.000Z",
            published_at: "2026-07-25T02:00:00.000Z",
            author: { login: "maintainer" },
            assets: [{}],
          },
          {
            id: 1,
            html_url: "https://github.com/qdrant/qdrant/releases/tag/v1",
            tag_name: "v1",
            name: null,
            body: null,
            draft: true,
            prerelease: false,
            created_at: "2026-07-25T00:00:00.000Z",
            published_at: "2026-07-25T00:00:00.000Z",
            author: null,
            assets: [],
          },
        ],
      }),
    );
    const batch = await collector.collect(githubSource, undefined, context);
    expect(batch.observations).toHaveLength(1);
    expect(batch.observations[0]).toMatchObject({
      type: "github_release",
      title: "Release 2",
      details: { prerelease: true, assetCount: 1 },
    });
    expect(batch.etag).toBe('"abc"');
  });

  it("normalizes Hugging Face revisions and respects an existing cursor", async () => {
    const client: HuggingFaceModelClient = {
      async listRecentModels() {
        return [
          {
            providerId: "6a21fc4fd949accacad1f3b0",
            canonicalName: "Qwen/new-model",
            private: false,
            gated: false,
            task: "text-generation",
            likes: 10,
            downloads: 100,
            updatedAt: new Date("2026-07-25T03:00:00.000Z"),
            createdAt: "2026-07-25T02:00:00.000Z",
            sha: "abc123",
            library_name: "transformers",
            tags: ["transformers", "text-generation"],
          },
        ];
      },
    };
    const source: SourceConfig = {
      ...githubSource,
      id: "huggingface-qwen",
      kind: "huggingface_org",
      locator: "qwen",
      displayName: "Qwen",
      categoryId: "foundation-model",
    };
    const batch = await new HuggingFaceModelCollector(client).collect(
      source,
      {
        schemaVersion: 1,
        sourceId: source.id,
        lastSuccessfulAt: "2026-07-25T00:00:00.000Z",
        cursor: {
          timestamp: "2026-07-25T01:00:00.000Z",
          externalIdsAtTimestamp: [],
        },
      },
      context,
    );
    expect(batch.observations[0]).toMatchObject({
      type: "huggingface_model_revision",
      externalId: "6a21fc4fd949accacad1f3b0",
      externalRevision: "abc123",
      title: "new-model",
      url: "https://huggingface.co/Qwen/new-model",
      details: {
        modelId: "Qwen/new-model",
        pipelineTag: "text-generation",
      },
    });
  });
});
