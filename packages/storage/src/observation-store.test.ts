import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createObservationId, type Observation } from "@noir/core";
import { describe, expect, it } from "vitest";

import { JsonCollectionStateStore } from "./json-collection-state-store";
import { JsonlObservationStore } from "./jsonl-observation-store";

function release(id: string, occurredAt: string): Observation {
  return {
    schemaVersion: 1,
    id: createObservationId("github_release", "github-qdrant-qdrant", id),
    type: "github_release",
    provider: "github",
    sourceId: "github-qdrant-qdrant",
    externalId: id,
    title: `Release ${id}`,
    url: `https://github.com/qdrant/qdrant/releases/tag/${id}`,
    occurredAt,
    collectedAt: "2026-07-26T02:00:00.000Z",
    categoryId: "vector-database",
    sourceTags: ["rag"],
    details: {
      releaseId: id,
      tagName: id,
      createdAt: occurredAt,
      publishedAt: occurredAt,
      prerelease: false,
      assetCount: 0,
    },
  };
}

describe("generated data stores", () => {
  it("partitions, sorts, and deduplicates observations", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "noir-storage-"));
    const store = new JsonlObservationStore(root);
    const later = release("2", "2026-07-26T02:00:00.000Z");
    const earlier = release("1", "2026-07-26T01:00:00.000Z");

    expect(await store.append([later, earlier, later])).toBe(2);
    expect(await store.append([earlier])).toBe(0);
    expect((await store.readAll()).map((item) => item.externalId)).toEqual([
      "1",
      "2",
    ]);
    const text = await readFile(
      path.join(root, "data", "observations", "2026", "07", "26.jsonl"),
      "utf8",
    );
    expect(text.trim().split("\n")).toHaveLength(2);
  });

  it("round-trips per-source cursor state", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "noir-state-"));
    const store = new JsonCollectionStateStore(root);
    const state = {
      schemaVersion: 1 as const,
      sourceId: "github-qdrant-qdrant",
      lastSuccessfulAt: "2026-07-26T02:00:00.000Z",
      cursor: {
        timestamp: "2026-07-26T01:00:00.000Z",
        externalIdsAtTimestamp: ["1"],
      },
    };
    await store.write(state);
    expect(await store.read(state.sourceId)).toEqual(state);
  });
});
