import type {
  CollectionRunReport,
  Observation,
  SourceCollectionState,
} from "@noir/core";
import type {
  CollectionStateStore,
  ObservationStore,
  RegistrySnapshot,
  RegistryStore,
  RunReportStore,
} from "@noir/storage";
import { describe, expect, it } from "vitest";

import type { HttpClient } from "../http-client";
import { ObservationCollectorRegistry } from "./collector-registry";
import { CollectionRunner } from "./collection-runner";

class MemoryGeneratedStore implements ObservationStore, CollectionStateStore {
  observations: Observation[] = [];
  states = new Map<string, SourceCollectionState>();

  async append(observations: Observation[]): Promise<number> {
    this.observations.push(...observations);
    return observations.length;
  }
  async readAll(): Promise<Observation[]> {
    return this.observations;
  }
  async read(sourceId: string): Promise<SourceCollectionState | undefined> {
    return this.states.get(sourceId);
  }
  async write(value: SourceCollectionState): Promise<void> {
    this.states.set(value.sourceId, value);
  }
}

class MemoryRunReportStore implements RunReportStore {
  reports: CollectionRunReport[] = [];
  async readAll(): Promise<CollectionRunReport[]> {
    return this.reports;
  }
  async write(report: CollectionRunReport): Promise<void> {
    this.reports.push(report);
  }
}

describe("CollectionRunner", () => {
  it("collects enabled sources and reports disabled sources as skipped", async () => {
    const snapshot: RegistrySnapshot = {
      registry: {
        version: 1,
        sources: [
          {
            id: "github-test-test",
            kind: "github_repo",
            locator: "test/test",
            displayName: "Test",
            categoryId: "developer-tool",
            tags: ["llm"],
            enabled: true,
            createdAt: "2026-07-01T00:00:00.000Z",
            updatedAt: "2026-07-01T00:00:00.000Z",
          },
          {
            id: "huggingface-disabled",
            kind: "huggingface_org",
            locator: "disabled",
            displayName: "Disabled",
            categoryId: "foundation-model",
            tags: ["llm"],
            enabled: false,
            createdAt: "2026-07-01T00:00:00.000Z",
            updatedAt: "2026-07-01T00:00:00.000Z",
          },
        ],
      },
      taxonomy: {
        version: 1,
        categories: [
          { id: "developer-tool", name: "Developer Tool" },
          { id: "foundation-model", name: "Foundation Model" },
        ],
      },
    };
    const registryStore: RegistryStore = {
      async read() {
        return snapshot;
      },
      async writeRegistry() {},
      async writeTaxonomy() {},
    };
    const httpClient: HttpClient = {
      async get<T>() {
        return {
          status: 200,
          headers: new Headers(),
          data: [
            {
              id: 1,
              html_url: "https://github.com/test/test/releases/tag/v1",
              tag_name: "v1",
              name: "Version 1",
              body: null,
              draft: false,
              prerelease: false,
              created_at: "2026-07-25T00:00:00.000Z",
              published_at: "2026-07-25T01:00:00.000Z",
              author: null,
              assets: [],
            },
          ] as T,
        };
      },
    };
    const generated = new MemoryGeneratedStore();
    const runner = new CollectionRunner(
      registryStore,
      generated,
      generated,
      new MemoryRunReportStore(),
      new ObservationCollectorRegistry(httpClient),
      () => new Date("2026-07-26T02:00:00.000Z"),
    );
    const result = await runner.run({
      runId: "test-run",
      trigger: "local",
      collectedAt: new Date("2026-07-26T02:00:00.000Z"),
    });
    expect(result.report.status).toBe("success");
    expect(result.report.totals).toMatchObject({
      attempted: 1,
      succeeded: 1,
      skipped: 1,
      observations: 1,
    });
    expect(generated.states.has("github-test-test")).toBe(true);
    expect(generated.states.has("huggingface-disabled")).toBe(false);
  });
});
