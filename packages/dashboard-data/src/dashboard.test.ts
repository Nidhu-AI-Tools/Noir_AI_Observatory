import type {
  CollectionRunReport,
  ModelReleaseEvent,
  Observation,
} from "@noir/core";
import type { RegistrySnapshot } from "@noir/storage";
import { describe, expect, it } from "vitest";

import { buildDigestDashboardData } from "./digests";
import { buildDashboardFeedData } from "./feed";
import { buildObservationViews, isWithinWindow } from "./observation-view";
import { buildRadarDashboardData } from "./radar";

const snapshot: RegistrySnapshot = {
  taxonomy: {
    version: 1,
    categories: [
      { id: "model", name: "Models" },
      { id: "vector-database", name: "Vector databases" },
    ],
  },
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
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "huggingface-qwen",
        kind: "huggingface_org",
        locator: "qwen",
        displayName: "Qwen",
        categoryId: "model",
        tags: ["language-model"],
        enabled: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "github-disabled-tool",
        kind: "github_repo",
        locator: "example/tool",
        displayName: "Disabled Tool",
        categoryId: "model",
        tags: [],
        enabled: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  },
};

const observations: Observation[] = [
  {
    schemaVersion: 1,
    id: "github-qdrant-qdrant:release:100",
    sourceId: "github-qdrant-qdrant",
    externalId: "100",
    type: "github_release",
    provider: "github",
    title: "Qdrant v2.0.0",
    url: "https://github.com/qdrant/qdrant/releases/tag/v2.0.0",
    occurredAt: "2026-07-26T11:00:00.000Z",
    collectedAt: "2026-07-26T12:00:00.000Z",
    categoryId: "vector-database",
    sourceTags: ["rag", "vector-search"],
    details: {
      releaseId: "100",
      tagName: "v2.0.0",
      createdAt: "2026-07-26T10:00:00.000Z",
      publishedAt: "2026-07-26T11:00:00.000Z",
      prerelease: false,
      releaseNotesExcerpt: "A major vector search release.",
      assetCount: 4,
    },
  },
  {
    schemaVersion: 1,
    id: "huggingface-qwen:model:qwen-test:abc",
    sourceId: "huggingface-qwen",
    externalId: "qwen-test:abc",
    externalRevision: "abc",
    type: "huggingface_model_revision",
    provider: "huggingface",
    title: "qwen/qwen-test",
    url: "https://huggingface.co/qwen/qwen-test",
    occurredAt: "2026-07-20T08:00:00.000Z",
    collectedAt: "2026-07-26T12:00:00.000Z",
    categoryId: "model",
    sourceTags: ["language-model"],
    details: {
      modelId: "qwen/qwen-test",
      revision: "abc",
      lastModified: "2026-07-20T08:00:00.000Z",
      pipelineTag: "text-generation",
      libraryName: "transformers",
      tags: ["transformers"],
      downloads: 1_200,
      likes: 42,
      gated: false,
    },
  },
];

const reports: CollectionRunReport[] = [
  {
    schemaVersion: 1,
    runId: "2026-07-26T12-00-00-000Z",
    trigger: "schedule",
    startedAt: "2026-07-26T12:00:00.000Z",
    finishedAt: "2026-07-26T12:00:10.000Z",
    status: "partial",
    totals: {
      configured: 3,
      attempted: 2,
      succeeded: 1,
      failed: 1,
      skipped: 1,
      observations: 1,
    },
    sources: [
      {
        sourceId: "github-qdrant-qdrant",
        status: "success",
        durationMs: 100,
        observations: 1,
      },
      {
        sourceId: "huggingface-qwen",
        status: "failed",
        durationMs: 100,
        observations: 0,
        error: { code: "rate_limited", message: "Try again later." },
      },
    ],
  },
  {
    schemaVersion: 1,
    runId: "2026-07-25T12-00-00-000Z",
    trigger: "schedule",
    startedAt: "2026-07-25T12:00:00.000Z",
    finishedAt: "2026-07-25T12:00:02.000Z",
    status: "success",
    totals: {
      configured: 3,
      attempted: 2,
      succeeded: 2,
      failed: 0,
      skipped: 1,
      observations: 0,
    },
    sources: [],
  },
];

const now = new Date("2026-07-26T12:00:00.000Z");

describe("Phase 3 dashboard view models", () => {
  it("enriches observations without mutating collection data", () => {
    const [release, model] = buildObservationViews(snapshot, observations);

    expect(release?.source.displayName).toBe("Qdrant");
    expect(release?.category.name).toBe("Vector databases");
    expect(release?.release?.tagName).toBe("v2.0.0");
    expect(model?.model?.pipelineTag).toBe("text-generation");
  });

  it("computes radar windows and explicit inactive states", () => {
    const radar = buildRadarDashboardData(snapshot, observations, now);

    expect(radar.summary).toEqual({
      tracked: 3,
      enabled: 2,
      withActivity: 2,
      activeLast7Days: 2,
    });
    expect(
      radar.sources.map((source) => [
        source.displayName,
        source.activity.status,
      ]),
    ).toEqual([
      ["Qdrant", "today"],
      ["Qwen", "this-week"],
      ["Disabled Tool", "disabled"],
    ]);
    expect(isWithinWindow("2026-07-27T00:00:00.000Z", now, 604_800_000)).toBe(
      false,
    );
  });

  it("creates deterministic UTC digests, including zero-change run days", () => {
    const result = buildDigestDashboardData(
      snapshot,
      observations,
      reports,
      now,
    );

    expect(result.index.dates.map((entry) => entry.date)).toEqual([
      "2026-07-26",
      "2026-07-25",
      "2026-07-20",
    ]);
    expect(result.daily.get("2026-07-26")?.summary.observations).toBe(1);
    expect(result.daily.get("2026-07-26")?.latestRun?.status).toBe("partial");
    expect(result.daily.get("2026-07-25")?.summary.observations).toBe(0);
    expect(result.daily.get("2026-07-25")?.latestRun?.status).toBe("success");
  });

  it("shows a promoted Hugging Face observation once as a model event", () => {
    const modelObservation = observations[1]!;
    const modelEvent: ModelReleaseEvent = {
      schemaVersion: 1,
      id: "model-event-qwen-test",
      modelId: "model-provider-record",
      canonicalName: "qwen-test",
      organization: "Qwen",
      externalModelId: "qwen/qwen-test",
      releaseKind: "initial-release",
      version: "abc",
      occurredAt: modelObservation.occurredAt,
      occurredAtInferred: false,
      collectedAt: modelObservation.collectedAt,
      categories: ["language-models"],
      tags: ["language-model"],
      modalities: ["text"],
      availability: ["open-weights"],
      lifecycle: "active",
      links: [{ kind: "model-card", url: modelObservation.url }],
      provenance: [
        {
          kind: "huggingface-model",
          sourceId: modelObservation.sourceId,
          observationId: modelObservation.id,
          url: modelObservation.url,
          observedAt: modelObservation.collectedAt,
        },
      ],
    };
    const result = buildDigestDashboardData(
      snapshot,
      observations,
      reports,
      now,
      { modelEvents: [modelEvent] },
    );
    const digest = result.daily.get("2026-07-20");
    expect(digest?.summary).toMatchObject({
      observations: 1,
      modelRevisions: 0,
      modelReleases: 1,
    });
    expect(digest?.categories).toEqual([]);
    expect(digest?.modelEvents).toHaveLength(1);
  });

  it("builds a compact overview feed from the same observations", () => {
    const feed = buildDashboardFeedData(
      snapshot,
      observations,
      reports,
      now,
      1,
    );

    expect(feed.recent).toHaveLength(1);
    expect(feed.recent[0]?.source.displayName).toBe("Qdrant");
    expect(feed.summary.last24Hours).toBe(1);
    expect(feed.categories[0]).toMatchObject({
      name: "Models",
      observations: 1,
    });
  });
});
