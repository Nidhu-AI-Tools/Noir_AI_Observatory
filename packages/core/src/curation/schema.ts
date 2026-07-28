import { z } from "zod";

const timestamp = z.iso.datetime({ offset: true });
const date = z.iso.date();
const sourceId = z.string().trim().min(1).max(300);
const shortText = z.string().trim().min(1).max(500);

export const curationProviderKindSchema = z.enum(["ollama", "codex"]);
export const curationCandidateKindSchema = z.enum([
  "github-release",
  "model-revision",
  "model-release",
  "research-paper",
  "announcement",
  "health-transition",
]);

export const curationCandidateSchema = z
  .object({
    id: sourceId,
    kind: curationCandidateKindSchema,
    title: z.string().trim().min(1).max(500),
    url: z.url(),
    occurredAt: timestamp,
    category: z.string().trim().min(1).max(120),
    tags: z.array(z.string().trim().min(1).max(120)).max(30),
    evidence: z.string().trim().min(1).max(2_000),
    score: z.number().int().min(0).max(1_000),
    reasons: z.array(shortText).min(1).max(10),
  })
  .strict();

export const curationContextSchema = z
  .object({
    schemaVersion: z.literal(1),
    date,
    generatedAt: timestamp,
    windowStartedAt: timestamp,
    windowFinishedAt: timestamp,
    candidates: z.array(curationCandidateSchema).max(50),
  })
  .strict();

export const curationHighlightSchema = z
  .object({
    sourceId,
    title: z.string().trim().min(1).max(300),
    summary: z.string().trim().min(1).max(800),
    whyItMatters: z.string().trim().min(1).max(800),
    sourceUrl: z.url(),
  })
  .strict();

export const curationModelOutputSchema = z
  .object({
    headline: z.string().trim().min(1).max(180),
    summary: z.string().trim().min(1).max(1_000),
    highlights: z.array(curationHighlightSchema).min(1).max(8),
    caveats: z.array(z.string().trim().min(1).max(500)).max(8),
  })
  .strict();

export const curationNoteSchema = z
  .object({
    schemaVersion: z.literal(1),
    date,
    status: z.enum(["draft", "published"]),
    createdAt: timestamp,
    reviewedAt: timestamp.optional(),
    assistedBy: z
      .object({
        provider: curationProviderKindSchema,
        model: z.string().trim().min(1).max(200),
      })
      .strict(),
    contextHash: z.string().regex(/^[a-f0-9]{64}$/),
    sourceIds: z.array(sourceId).min(1).max(50),
    headline: curationModelOutputSchema.shape.headline,
    summary: curationModelOutputSchema.shape.summary,
    highlights: curationModelOutputSchema.shape.highlights,
    caveats: curationModelOutputSchema.shape.caveats,
  })
  .strict()
  .superRefine((note, context) => {
    if (note.status === "published" && !note.reviewedAt)
      context.addIssue({
        code: "custom",
        message: "Published notes require reviewedAt.",
        path: ["reviewedAt"],
      });
    const allowed = new Set(note.sourceIds);
    note.highlights.forEach((highlight, index) => {
      if (!allowed.has(highlight.sourceId))
        context.addIssue({
          code: "custom",
          message: `Highlight references undeclared source ${highlight.sourceId}.`,
          path: ["highlights", index, "sourceId"],
        });
    });
  });

export const curationConfigSchema = z
  .object({
    version: z.literal(1),
    provider: z.object({ default: curationProviderKindSchema }).strict(),
    ollama: z
      .object({
        baseUrl: z.url(),
        defaultModel: z.string().trim().min(1).max(200),
        timeoutMs: z.number().int().min(10_000).max(600_000),
        temperature: z.number().min(0).max(2),
        contextTokens: z.number().int().min(2_048).max(131_072),
        maxOutputTokens: z.number().int().min(256).max(8_192),
      })
      .strict(),
    selection: z
      .object({
        lookbackHours: z.number().int().min(1).max(168),
        maxCandidates: z.number().int().min(1).max(50),
        maxPerCategory: z.number().int().min(1).max(20),
      })
      .strict(),
    output: z
      .object({
        maxHighlights: z.number().int().min(1).max(8),
        maxSummaryCharacters: z.number().int().min(100).max(1_000),
        maxSignificanceCharacters: z.number().int().min(100).max(800),
      })
      .strict(),
  })
  .strict();

export type CurationProviderKind = z.infer<typeof curationProviderKindSchema>;
export type CurationCandidate = z.infer<typeof curationCandidateSchema>;
export type CurationContext = z.infer<typeof curationContextSchema>;
export type CurationModelOutput = z.infer<typeof curationModelOutputSchema>;
export type CurationNote = z.infer<typeof curationNoteSchema>;
export type CurationConfig = z.infer<typeof curationConfigSchema>;
