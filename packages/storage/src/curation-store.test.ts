import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { CurationNote } from "@noir/core";
import { afterEach, describe, expect, it } from "vitest";

import { MarkdownCurationNoteStore } from "./markdown-curation-note-store";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const note: CurationNote = {
  schemaVersion: 1,
  date: "2026-07-27",
  status: "draft",
  createdAt: "2026-07-27T12:00:00.000Z",
  assistedBy: { provider: "ollama", model: "llama3.1:8b" },
  contextHash: "a".repeat(64),
  sourceIds: ["source-one"],
  headline: "Daily signal",
  summary: "A concise source-grounded summary.",
  highlights: [
    {
      sourceId: "source-one",
      title: "Release one",
      summary: "A release was published.",
      whyItMatters: "It may affect tracked users.",
      sourceUrl: "https://example.com/release",
    },
  ],
  caveats: ["Publisher claims were not independently verified."],
};

describe("MarkdownCurationNoteStore", () => {
  it("round-trips a deterministic note and protects published notes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "noir-curation-store-"));
    directories.push(root);
    const store = new MarkdownCurationNoteStore(root);
    await store.write(note);
    expect(await store.read(note.date)).toEqual(note);
    const published: CurationNote = {
      ...note,
      status: "published",
      reviewedAt: "2026-07-27T13:00:00.000Z",
    };
    await store.write(published, { overwrite: true });
    await expect(
      store.write({ ...note, headline: "Replacement" }, { overwrite: true }),
    ).rejects.toThrow("immutable");
  });
});
