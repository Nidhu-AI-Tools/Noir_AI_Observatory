import type { CurationNote } from "@noir/core";

export interface CurationDashboardData {
  schemaVersion: 1;
  generatedAt: string;
  summary: {
    publishedNotes: number;
    published30Days: number;
    totalHighlights: number;
    ollamaNotes: number;
    codexNotes: number;
  };
  latest?: CurationNote;
  notes: CurationNote[];
}

export function buildCurationDashboardData(
  notes: CurationNote[],
  generatedAt = new Date(),
): CurationDashboardData {
  const published = notes
    .filter((note) => note.status === "published")
    .sort((left, right) => right.date.localeCompare(left.date));
  const cutoff = new Date(generatedAt.valueOf() - 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const latest = published[0];
  return {
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
    summary: {
      publishedNotes: published.length,
      published30Days: published.filter((note) => note.date >= cutoff).length,
      totalHighlights: published.reduce(
        (sum, note) => sum + note.highlights.length,
        0,
      ),
      ollamaNotes: published.filter(
        (note) => note.assistedBy.provider === "ollama",
      ).length,
      codexNotes: published.filter(
        (note) => note.assistedBy.provider === "codex",
      ).length,
    },
    ...(latest ? { latest } : {}),
    notes: published,
  };
}
