import type {
  CollectionRunReport,
  CurationNote,
  ModelReleaseEvent,
  Observation,
} from "@noir/core";
import type { RegistrySnapshot } from "@noir/storage";
import { describe, expect, it } from "vitest";

import { buildObservationViews, isWithinWindow } from "./observation-view";
import { buildRadarDashboardData } from "./radar";
import { buildTodayDashboardData } from "./today";

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

const now = new Date("2026-07-26T13:00:00.000Z");

describe("Phase 3 dashboard view models", () => {
  it("enriches observations without mutating collection data", () => {
    const [release, model] = buildObservationViews(snapshot, observations);

    expect(release?.source.displayName).toBe("Qdrant");
    expect(release?.category.name).toBe("Vector databases");
    expect(release?.release?.tagName).toBe("v2.0.0");
    expect(model?.model?.pipelineTag).toBe("text-generation");
  });

  it("computes radar windows and explicit inactive states", () => {
    const radar = buildRadarDashboardData(snapshot, observations, now, {
      healthMonitors: [
        {
          id: "api-qdrant",
          displayName: "Qdrant API",
          linkedSourceId: "github-qdrant-qdrant",
          status: "healthy",
          enabled: true,
        },
      ],
    });

    expect(radar.summary).toEqual({
      tracked: 3,
      enabled: 2,
      disabled: 1,
      categories: 2,
      withActivity: 2,
      activeLast7Days: 2,
    });
    expect(radar.schemaVersion).toBe(2);
    expect(radar.sources[0]).toMatchObject({
      id: "github-qdrant-qdrant",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      linkedMonitor: {
        id: "api-qdrant",
        displayName: "Qdrant API",
        status: "healthy",
        enabled: true,
      },
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

  it("chooses a linked monitor deterministically", () => {
    const radar = buildRadarDashboardData(snapshot, observations, now, {
      healthMonitors: [
        {
          id: "monitor-z",
          displayName: "Zulu API",
          linkedSourceId: "github-qdrant-qdrant",
          status: "down",
          enabled: true,
        },
        {
          id: "monitor-a",
          displayName: "Alpha API",
          linkedSourceId: "github-qdrant-qdrant",
          status: "degraded",
          enabled: true,
        },
      ],
    });

    expect(radar.sources[0]?.linkedMonitor).toMatchObject({
      id: "monitor-a",
      status: "degraded",
    });
  });

  it("creates deterministic UTC Today editions, including zero-change run days", () => {
    const result = buildTodayDashboardData(
      snapshot,
      observations,
      reports,
      now,
    );

    expect(result.index.schemaVersion).toBe(2);
    expect(result.index.editions.map((entry) => entry.date)).toEqual([
      "2026-07-26",
      "2026-07-25",
      "2026-07-20",
    ]);
    expect(result.editions.get("2026-07-26")?.counts.totalSignals).toBe(1);
    expect(result.editions.get("2026-07-26")?.collectionRun?.status).toBe(
      "partial",
    );
    expect(result.editions.get("2026-07-25")?.counts.totalSignals).toBe(0);
    expect(result.editions.get("2026-07-25")?.collectionRun?.status).toBe(
      "success",
    );
    expect(result.editions.get("2026-07-25")?.lastUpdatedAt).toBe(
      "2026-07-25T12:00:02.000Z",
    );
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
    const result = buildTodayDashboardData(
      snapshot,
      observations,
      reports,
      now,
      { modelEvents: [modelEvent] },
    );
    const edition = result.editions.get("2026-07-20");
    expect(edition?.counts).toMatchObject({
      ecosystem: 0,
      models: 1,
      totalSignals: 1,
    });
    expect(edition?.sections.ecosystem.items).toEqual([]);
    expect(edition?.sections.models.items).toHaveLength(1);
    expect(edition?.sections.models.items[0]).toMatchObject({
      signalKind: "first-observed",
      sourceUrl: modelObservation.url,
    });
    expect(edition?.sections.models.items[0]).not.toHaveProperty("provenance");
  });

  it("bounds generated sections without changing full counts", () => {
    const result = buildTodayDashboardData(
      snapshot,
      observations,
      reports,
      now,
      { limits: { ecosystem: 0 } },
    );
    const edition = result.editions.get("2026-07-26");
    expect(edition?.sections.ecosystem).toEqual({ total: 1, items: [] });
    expect(edition?.counts.ecosystem).toBe(1);
  });

  it("does not repeat a curated observation through its derived model event", () => {
    const modelObservation = observations[1]!;
    const modelEvent: ModelReleaseEvent = {
      schemaVersion: 1,
      id: "model-event-qwen-test",
      modelId: "model-provider-record",
      canonicalName: "qwen-test",
      organization: "Qwen",
      externalModelId: "qwen/qwen-test",
      releaseKind: "initial-release",
      occurredAt: modelObservation.occurredAt,
      occurredAtInferred: false,
      collectedAt: modelObservation.collectedAt,
      categories: ["language-models"],
      tags: [],
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
    const note: CurationNote = {
      schemaVersion: 1,
      date: "2026-07-20",
      status: "published",
      createdAt: "2026-07-26T12:00:00.000Z",
      reviewedAt: "2026-07-26T12:30:00.000Z",
      assistedBy: { provider: "ollama", model: "llama3.1:8b" },
      contextHash: "a".repeat(64),
      sourceIds: [modelObservation.id],
      headline: "Model signal",
      summary: "A reviewed model update.",
      highlights: [
        {
          sourceId: modelObservation.id,
          sourceUrl: modelObservation.url,
          title: "Qwen model",
          summary: "The model changed.",
          whyItMatters: "The update is tracked.",
        },
      ],
      caveats: [],
    };
    const edition = buildTodayDashboardData(
      snapshot,
      observations,
      reports,
      now,
      { modelEvents: [modelEvent], curationNotes: [note] },
    ).editions.get("2026-07-20");

    expect(edition?.curationNote?.headline).toBe("Model signal");
    expect(edition?.curationNote).not.toHaveProperty("assistedBy");
    expect(edition?.curationNote).not.toHaveProperty("contextHash");
    expect(edition?.curationNote).not.toHaveProperty("sourceIds");
    expect(edition?.counts.models).toBe(1);
    expect(edition?.sections.models.items).toEqual([]);
    expect(edition?.lastUpdatedAt).toBe("2026-07-26T12:30:00.000Z");
  });

  it("excludes future records and draft notes", () => {
    const result = buildTodayDashboardData(
      snapshot,
      [
        ...observations,
        {
          ...observations[0]!,
          id: "future-observation",
          occurredAt: "2026-07-27T00:00:00.000Z",
          collectedAt: "2026-07-27T00:01:00.000Z",
        },
      ],
      reports,
      now,
      {
        curationNotes: [
          {
            schemaVersion: 1,
            date: "2026-07-27",
            status: "draft",
            createdAt: "2026-07-26T12:00:00.000Z",
            assistedBy: { provider: "ollama", model: "llama3.1:8b" },
            contextHash: "b".repeat(64),
            sourceIds: [observations[0]!.id],
            headline: "Draft",
            summary: "Not public.",
            highlights: [
              {
                sourceId: observations[0]!.id,
                sourceUrl: observations[0]!.url,
                title: "Draft",
                summary: "Draft summary.",
                whyItMatters: "Draft rationale.",
              },
            ],
            caveats: [],
          },
        ],
      },
    );
    expect(
      result.index.editions.some((entry) => entry.date === "2026-07-27"),
    ).toBe(false);
    expect(result.index.editions.every((entry) => !entry.curated)).toBe(true);
  });
});
