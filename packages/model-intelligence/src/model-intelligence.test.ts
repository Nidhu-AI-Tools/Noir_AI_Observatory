import type {
  HuggingFaceModelObservation,
  ModelIntelligenceRunReport,
  ModelReleaseEvent,
} from "@noir/core";
import type {
  ModelIntelligenceRunReportStore,
  ModelReleaseEventStore,
  ObservationStore,
  RegistrySnapshot,
} from "@noir/storage";
import { describe, expect, it } from "vitest";

import { classifyObservation } from "./classification";
import { modelIdForExternalId, stableHash } from "./identity";
import { ModelIntelligenceRunner } from "./runner";

const observation: HuggingFaceModelObservation = {
  schemaVersion: 1,
  id: "huggingface-acme:model:reasoner:revision-1",
  sourceId: "huggingface-acme",
  externalId: "acme/reasoner:revision-1",
  externalRevision: "revision-1",
  type: "huggingface_model_revision",
  provider: "huggingface",
  title: "acme/reasoner",
  url: "https://huggingface.co/acme/reasoner",
  occurredAt: "2026-07-20T08:00:00.000Z",
  collectedAt: "2026-07-21T08:00:00.000Z",
  categoryId: "foundation-model",
  sourceTags: ["reasoning", "open-weights"],
  details: {
    modelId: "acme/reasoner",
    revision: "revision-1",
    lastModified: "2026-07-20T08:00:00.000Z",
    pipelineTag: "text-generation",
    libraryName: "transformers",
    tags: ["text", "reasoning", "open-weights"],
    downloads: 100,
    likes: 10,
    gated: false,
  },
};

class MemoryEvents implements ModelReleaseEventStore {
  values: ModelReleaseEvent[] = [];
  async readAll() {
    return this.values;
  }
  async append(events: ModelReleaseEvent[]) {
    this.values.push(...events);
    return events.length;
  }
}
class MemoryReports implements ModelIntelligenceRunReportStore {
  values: ModelIntelligenceRunReport[] = [];
  async readAll() {
    return this.values;
  }
  async write(report: ModelIntelligenceRunReport) {
    this.values.push(report);
  }
}

describe("model intelligence", () => {
  it("classifies public Hugging Face metadata deterministically", () => {
    expect(classifyObservation(observation)).toMatchObject({
      categories: ["language-models", "reasoning"],
      modalities: ["text"],
      availability: ["open-weights", "downloadable"],
    });
    expect(stableHash({ b: 2, a: { d: 4, c: 3 } })).toBe(
      stableHash({ a: { c: 3, d: 4 }, b: 2 }),
    );
    expect(modelIdForExternalId("acme/reasoner")).toBe(
      modelIdForExternalId("acme/reasoner"),
    );
  });

  it("creates one release event and makes a repeated run a no-op", async () => {
    const events = new MemoryEvents();
    const reports = new MemoryReports();
    const snapshot: RegistrySnapshot = {
      registry: {
        version: 1,
        sources: [
          {
            id: "huggingface-acme",
            kind: "huggingface_org",
            locator: "acme",
            displayName: "Acme AI",
            categoryId: "foundation-model",
            tags: ["models"],
            enabled: true,
            createdAt: "2026-07-01T00:00:00.000Z",
            updatedAt: "2026-07-01T00:00:00.000Z",
          },
        ],
      },
      taxonomy: {
        version: 1,
        categories: [{ id: "foundation-model", name: "Foundation Model" }],
      },
    };
    const observations: ObservationStore = {
      async readAll() {
        return [observation];
      },
      async append() {
        return 0;
      },
    };
    const runner = new ModelIntelligenceRunner(
      {
        async read() {
          return { version: 1, policy: { maxEventsPerRun: 10 } };
        },
      },
      {
        async read() {
          return {
            version: 1,
            categories: [
              {
                id: "language-models",
                name: "Language Models",
                description: "Text models.",
              },
              {
                id: "reasoning",
                name: "Reasoning",
                description: "Reasoning models.",
              },
            ],
          };
        },
        async write() {},
      },
      {
        async read() {
          return { version: 1, models: [] };
        },
        async write() {},
      },
      {
        async read() {
          return snapshot;
        },
        async writeRegistry() {},
        async writeTaxonomy() {},
      },
      observations,
      events,
      reports,
      () => new Date("2026-07-22T08:00:00.000Z"),
    );
    const first = await runner.run({ runId: "first", trigger: "local" });
    const second = await runner.run({ runId: "second", trigger: "local" });
    expect(first.events).toHaveLength(1);
    expect(first.events[0]?.releaseKind).toBe("initial-release");
    expect(second.events).toHaveLength(0);
    expect(second.report.status).toBe("no-op");
    expect(events.values).toHaveLength(1);
    expect(reports.values).toHaveLength(2);
  });
});
