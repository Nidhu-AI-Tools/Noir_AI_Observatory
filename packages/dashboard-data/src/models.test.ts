import type { ModelReleaseEvent } from "@noir/core";
import { describe, expect, it } from "vitest";

import {
  buildModelRadarDashboardData,
  classifyPublicModelSignal,
} from "./models";

function event(overrides: Partial<ModelReleaseEvent> = {}): ModelReleaseEvent {
  return {
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
    ...overrides,
  };
}

describe("model radar dashboard data", () => {
  it("builds one compact model and references it from category leaders", () => {
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
      [event()],
      [],
      new Date("2026-07-26T12:00:00.000Z"),
    );
    expect(result.index.schemaVersion).toBe(3);
    expect(result.index.summary).toMatchObject({
      models: 1,
      signalsToday: 1,
      firstObservedToday: 1,
      confirmedReleasesToday: 0,
    });
    expect(result.index.latestByCategory[0]?.model?.id).toBe(
      "model-acme-reasoner",
    );
    expect(result.catalog.models[0]?.p).toBe(1);
    expect(result.pages[0]?.models[0]).not.toHaveProperty("releases");
    expect(result.pages[0]?.models[0]).not.toHaveProperty("latestEvent");
    expect(result.index.definition).toContain("counted separately");
  });

  it("keeps the catalog complete while splitting full cards into pages", () => {
    const events = Array.from({ length: 49 }, (_, index) =>
      event({
        id: `model-event-${index}`,
        modelId: `model-acme-${index}`,
        canonicalName: `Model ${index}`,
        occurredAt: `2026-07-${String((index % 28) + 1).padStart(2, "0")}T10:00:00.000Z`,
      }),
    );
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
      events,
      [],
      new Date("2026-07-30T12:00:00.000Z"),
      24,
    );
    expect(result.catalog.models).toHaveLength(49);
    expect(result.pages.map((page) => page.models.length)).toEqual([24, 24, 1]);
    expect(result.catalog.models.at(-1)?.p).toBe(3);
  });

  it("distinguishes release, observation, revision, and lifecycle evidence", () => {
    expect(classifyPublicModelSignal(event())).toBe("first-observed");
    expect(
      classifyPublicModelSignal(
        event({
          releaseKind: "new-version",
          provenance: [
            {
              kind: "official-announcement",
              sourceId: "official-acme",
              url: "https://acme.example/reasoner-2",
              observedAt: "2026-07-26T11:00:00.000Z",
            },
          ],
        }),
      ),
    ).toBe("confirmed-release");
    expect(classifyPublicModelSignal(event({ releaseKind: "update" }))).toBe(
      "revision",
    );
    expect(
      classifyPublicModelSignal(event({ releaseKind: "deprecation" })),
    ).toBe("lifecycle-change");
    expect(
      classifyPublicModelSignal(
        event({
          releaseKind: "new-version",
          occurredAtInferred: true,
        }),
      ),
    ).toBe("first-observed");
  });
});
