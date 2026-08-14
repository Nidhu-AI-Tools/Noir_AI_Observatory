import { describe, expect, it } from "vitest";

import {
  defaultRadarUrlState,
  legacyRadarTarget,
  parseRadarUrl,
  radarPath,
} from "./radar-url";

describe("Radar URL state", () => {
  it("parses and serializes combined filters", () => {
    const state = parseRadarUrl(
      "?q=vector&kind=github_repo&category=database&tag=rag&period=7d&status=enabled&source=github-qdrant",
    );

    expect(state).toEqual({
      query: "vector",
      kind: "github_repo",
      category: "database",
      tag: "rag",
      period: "7d",
      status: "enabled",
      sourceId: "github-qdrant",
    });
    expect(radarPath(state)).toBe(
      "/radar/?q=vector&kind=github_repo&category=database&tag=rag&period=7d&status=enabled&source=github-qdrant",
    );
  });

  it("normalizes unsupported enum values", () => {
    expect(parseRadarUrl("?kind=website&period=year&status=active")).toEqual(
      defaultRadarUrlState,
    );
  });

  it("omits default values and trims search", () => {
    expect(radarPath({ ...defaultRadarUrlState, query: "  Qdrant  " })).toBe(
      "/radar/?q=Qdrant",
    );
  });

  it("redirects legacy Sources URLs with the deployment base path", () => {
    expect(
      legacyRadarTarget(
        "/Noir_AI_Observatory",
        "?source=github-qdrant-qdrant&status=disabled",
      ),
    ).toBe(
      "/Noir_AI_Observatory/radar/?status=disabled&source=github-qdrant-qdrant",
    );
  });
});
