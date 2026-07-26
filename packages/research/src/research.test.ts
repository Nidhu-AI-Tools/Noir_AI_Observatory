import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type {
  ArxivResearchSource,
  FeedResearchSource,
  ResearchItem,
} from "@noir/core";
import { JsonlResearchItemStore } from "@noir/storage";
import { afterEach, describe, expect, it } from "vitest";

import { ArxivAdapter, FeedAdapter } from "./adapters";
import { ResearchRunner } from "./research-runner";

const fixture = (name: string) =>
  readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const now = new Date("2026-07-26T00:00:00.000Z");
const common = {
  category: "research-paper",
  tags: ["ai"],
  weight: 3,
  enabled: true,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};
function fetcher(body: string): typeof fetch {
  return async () =>
    new Response(body, {
      status: 200,
      headers: { "content-type": "application/xml" },
    });
}

describe("research adapters", () => {
  it("normalizes arXiv versions and structured metadata", async () => {
    const source: ArxivResearchSource = {
      id: "arxiv-ai",
      kind: "arxiv_query",
      displayName: "arXiv AI",
      query: "cat:cs.AI",
      ...common,
    };
    const items = await new ArxivAdapter().collect(source, {
      since: new Date("2026-07-20T00:00:00Z"),
      now,
      maxItems: 10,
      fetcher: fetcher(await fixture("arxiv.xml")),
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "arxiv:2607.12345",
      type: "research_paper",
      primaryCategory: "cs.AI",
      sourceIds: ["arxiv-ai"],
    });
  });

  it("parses RSS, removes tracking parameters, and sanitizes excerpts", async () => {
    const source: FeedResearchSource = {
      id: "official-lab",
      kind: "rss_feed",
      displayName: "Official Lab",
      url: "https://example.com/feed.xml",
      publisher: "Official Lab",
      ...common,
      category: "official-announcement",
    };
    const items = await new FeedAdapter().collect(source, {
      since: new Date("2026-07-20T00:00:00Z"),
      now,
      maxItems: 10,
      fetcher: fetcher(await fixture("feed.xml")),
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.url).toBe("https://example.com/news/model");
    expect(items[0]?.summaryExcerpt).toBe("A new model is available.");
  });
});

describe("research item storage", () => {
  const roots: string[] = [];
  afterEach(async () =>
    Promise.all(
      roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
    ),
  );
  it("merges overlapping source provenance and remains idempotent", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "noir-research-"));
    roots.push(root);
    const store = new JsonlResearchItemStore(root);
    const base: ResearchItem = {
      schemaVersion: 1,
      id: "arxiv:2607.12345",
      type: "research_paper",
      provider: "arxiv",
      sourceIds: ["arxiv-ai"],
      title: "A Paper",
      url: "https://arxiv.org/abs/2607.12345",
      publishedAt: "2026-07-24T09:00:00.000Z",
      collectedAt: "2026-07-26T00:00:00.000Z",
      category: "research-paper",
      tags: ["ai"],
      arxivId: "2607.12345",
      authors: ["Ada"],
      abstractExcerpt: "Abstract",
      primaryCategory: "cs.AI",
      categories: ["cs.AI"],
      pdfUrl: "https://arxiv.org/pdf/2607.12345",
    };
    expect(await store.upsert([base])).toMatchObject({ added: 1, updated: 0 });
    expect(
      await store.upsert([
        { ...base, sourceIds: ["arxiv-ml"], tags: ["machine-learning"] },
      ]),
    ).toMatchObject({ added: 0, updated: 1, duplicatesMerged: 1 });
    expect(
      await store.upsert([
        {
          ...base,
          sourceIds: ["arxiv-ai", "arxiv-ml"],
          tags: ["ai", "machine-learning"],
        },
      ]),
    ).toMatchObject({ added: 0, updated: 0, duplicatesMerged: 1 });
    expect((await store.readAll())[0]).toMatchObject({
      sourceIds: ["arxiv-ai", "arxiv-ml"],
      tags: ["ai", "machine-learning"],
    });
  });
});

describe("research runner", () => {
  it("persists a successful run report when the registry has no changes", async () => {
    let writtenReport: unknown;
    const runner = new ResearchRunner(
      {
        read: async () => ({ version: 1 as const, sources: [] }),
        write: async () => undefined,
      },
      {
        readAll: async () => [],
        upsert: async () => ({ added: 0, updated: 0, duplicatesMerged: 0 }),
      },
      { read: async () => undefined, write: async () => undefined },
      {
        readAll: async () => [],
        write: async (report) => {
          writtenReport = report;
        },
      },
      undefined,
      () => now,
    );
    const result = await runner.run({ runId: "zero-change", trigger: "local" });
    expect(result.report.status).toBe("success");
    expect(result.report.totals).toMatchObject({
      configured: 0,
      added: 0,
      failed: 0,
    });
    expect(writtenReport).toEqual(result.report);
  });
});
