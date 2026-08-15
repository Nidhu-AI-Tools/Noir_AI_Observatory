import type { ResearchIndexData } from "@noir/dashboard-data";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadResearchPage, loadResearchSearch } from "./research-repository";

const index = {
  pages: [{ page: 1, path: "/generated/research/pages/0001.json" }],
  searchIndexPath: "/generated/research/search/index.json",
} as ResearchIndexData;

describe("research repository", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads each page shard and the lazy search index only once", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => ({
      ok: true,
      json: async () =>
        String(url).includes("/search/")
          ? { schemaVersion: 1, generatedAt: "2026-08-15", documents: [] }
          : {
              schemaVersion: 1,
              generatedAt: "2026-08-15",
              page: 1,
              pageSize: 24,
              total: 0,
              items: [],
            },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([loadResearchPage(index, 1), loadResearchPage(index, 1)]);
    await Promise.all([loadResearchSearch(index), loadResearchSearch(index)]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "/generated/research/pages/0001.json",
      "/generated/research/search/index.json",
    ]);
  });

  it("rejects page numbers that are absent from the manifest", () => {
    expect(() => loadResearchPage(index, 2)).toThrow(
      "Research page 2 is unavailable.",
    );
  });
});
