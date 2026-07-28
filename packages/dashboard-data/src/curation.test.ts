import type { CurationNote } from "@noir/core";
import { describe, expect, it } from "vitest";

import { buildCurationDashboardData } from "./curation";

const base: CurationNote = {
  schemaVersion: 1,
  date: "2026-07-27",
  status: "published",
  createdAt: "2026-07-27T12:00:00.000Z",
  reviewedAt: "2026-07-27T13:00:00.000Z",
  assistedBy: { provider: "ollama", model: "llama3.1:8b" },
  contextHash: "b".repeat(64),
  sourceIds: ["source-one"],
  headline: "Daily signal",
  summary: "Summary",
  highlights: [
    {
      sourceId: "source-one",
      title: "Release",
      summary: "A release.",
      whyItMatters: "Relevant.",
      sourceUrl: "https://example.com/release",
    },
  ],
  caveats: [],
};

describe("curation dashboard data", () => {
  it("exposes published notes and excludes drafts", () => {
    const result = buildCurationDashboardData(
      [
        base,
        { ...base, date: "2026-07-28", status: "draft", reviewedAt: undefined },
      ],
      new Date("2026-07-28T12:00:00.000Z"),
    );
    expect(result.notes).toHaveLength(1);
    expect(result.latest?.date).toBe("2026-07-27");
    expect(result.summary).toMatchObject({ publishedNotes: 1, ollamaNotes: 1 });
  });
});
