import type { ModelReleaseEvent } from "@noir/core";
import { describe, expect, it } from "vitest";

import { buildModelRadarDashboardData } from "./models";

describe("model radar dashboard data", () => {
  it("groups release history and exposes category leaders", () => {
    const event: ModelReleaseEvent = {
      schemaVersion: 1,
      id: "model-event-one",
      modelId: "model-acme-reasoner",
      canonicalName: "Reasoner",
      organization: "Acme AI",
      externalModelId: "acme/reasoner",
      releaseKind: "initial-release",
      occurredAt: "2026-07-26T10:00:00.000Z",
      occurredAtInferred: false,
      collectedAt: "2026-07-26T11:00:00.000Z",
      categories: ["reasoning"],
      tags: ["reasoning"],
      modalities: ["text"],
      availability: ["open-weights"],
      lifecycle: "active",
      links: [
        { kind: "model-card", url: "https://huggingface.co/acme/reasoner" },
      ],
      provenance: [
        {
          kind: "huggingface-model",
          sourceId: "huggingface-acme",
          url: "https://huggingface.co/acme/reasoner",
          observedAt: "2026-07-26T11:00:00.000Z",
        },
      ],
    };
    const result = buildModelRadarDashboardData(
      {
        version: 1,
        categories: [
          {
            id: "reasoning",
            name: "Reasoning",
            description: "Reasoning models.",
          },
        ],
      },
      [event],
      [],
      new Date("2026-07-26T12:00:00.000Z"),
    );
    expect(result.summary).toMatchObject({
      models: 1,
      releasesToday: 1,
      openWeightModels: 1,
    });
    expect(result.latestByCategory[0]?.model?.canonicalName).toBe("Reasoner");
    expect(result.definition).toContain("not the best-performing model");
  });
});
