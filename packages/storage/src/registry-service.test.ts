import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { RegistryService } from "./registry-service";
import { YamlRegistryStore } from "./yaml-registry-store";

const temporaryDirectories: string[] = [];

async function createStore(): Promise<{
  root: string;
  service: RegistryService;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "noir-registry-"));
  temporaryDirectories.push(root);
  await mkdir(path.join(root, "config"));
  await writeFile(
    path.join(root, "config", "sources.yaml"),
    "version: 1\nsources: []\n",
  );
  await writeFile(
    path.join(root, "config", "taxonomy.yaml"),
    "version: 1\ncategories:\n  - id: vector-database\n    name: Vector Database\n",
  );
  const store = new YamlRegistryStore(root);
  return {
    root,
    service: new RegistryService(
      store,
      () => new Date("2026-07-26T12:00:00.000Z"),
    ),
  };
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("RegistryService", () => {
  it("adds a normalized source and edits its metadata without changing identity", async () => {
    const { service } = await createStore();
    const source = await service.addSource(
      {
        kind: "github_repo",
        locator: "Qdrant/Qdrant",
        categoryId: "vector-database",
        tags: ["Vector Search", "RAG", "rag"],
      },
      {
        kind: "github_repo",
        locator: "qdrant/qdrant",
        displayName: "Qdrant",
        externalUrl: "https://github.com/qdrant/qdrant",
        warnings: [],
        metadata: {},
      },
    );

    const updated = await service.updateSource(source.id, {
      displayName: "Qdrant Database",
      tags: ["database", "rag"],
    });

    expect(updated.id).toBe(source.id);
    expect(updated.tags).toEqual(["database", "rag"]);
    expect(updated.displayName).toBe("Qdrant Database");
  });

  it("writes deterministic YAML", async () => {
    const { root, service } = await createStore();
    await service.addSource(
      {
        kind: "github_repo",
        locator: "qdrant/qdrant",
        categoryId: "vector-database",
        tags: ["vector-search", "rag"],
      },
      {
        kind: "github_repo",
        locator: "qdrant/qdrant",
        displayName: "Qdrant",
        externalUrl: "https://github.com/qdrant/qdrant",
        warnings: [],
        metadata: {},
      },
    );

    const content = await readFile(
      path.join(root, "config", "sources.yaml"),
      "utf8",
    );
    expect(content).toContain("      - rag\n      - vector-search");
  });

  it("rejects an unknown category before writing", async () => {
    const { service } = await createStore();
    await expect(
      service.addSource(
        {
          kind: "huggingface_org",
          locator: "meta-llama",
          categoryId: "unknown",
          tags: [],
        },
        {
          kind: "huggingface_org",
          locator: "meta-llama",
          displayName: "Meta Llama",
          externalUrl: "https://huggingface.co/meta-llama",
          warnings: [],
          metadata: {},
        },
      ),
    ).rejects.toThrow("Unknown category");
  });

  it("rejects private sources from the public registry", async () => {
    const { service } = await createStore();
    await expect(
      service.addSource(
        {
          kind: "github_repo",
          locator: "private/repository",
          categoryId: "vector-database",
          tags: [],
        },
        {
          kind: "github_repo",
          locator: "private/repository",
          displayName: "Private repository",
          externalUrl: "https://github.com/private/repository",
          warnings: [],
          metadata: { private: true },
        },
      ),
    ).rejects.toThrow("Private sources cannot be added");
  });
});
