import { z } from "zod";

import { sourceTagSchema } from "../source/schema";
import {
  researchFacetDefaultsSchema,
  researchProviderFacetEvidenceSchema,
  type ResearchFacetDefaults,
} from "./discovery-schema";

const stableIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const commonSourceFields = {
  id: stableIdSchema,
  displayName: z.string().trim().min(1).max(120),
  category: stableIdSchema,
  tags: z.array(sourceTagSchema),
  weight: z.number().int().min(1).max(5),
  enabled: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  facetDefaults: researchFacetDefaultsSchema.optional(),
  coverageDescription: z.string().trim().min(1).max(500).optional(),
};

function publicFeedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      host !== "localhost" &&
      !host.endsWith(".localhost") &&
      !host.endsWith(".local") &&
      !host.includes(":") &&
      !/^(?:0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|100\.6[4-9]\.|100\.[7-9]\d\.|100\.1[01]\d\.|100\.12[0-7]\.|198\.1[89]\.)/.test(
        host,
      )
    );
  } catch {
    return false;
  }
}

export const arxivResearchSourceSchema = z
  .object({
    ...commonSourceFields,
    kind: z.literal("arxiv_query"),
    query: z.string().trim().min(1).max(500),
  })
  .strict();

export const feedResearchSourceSchema = z
  .object({
    ...commonSourceFields,
    kind: z.literal("rss_feed"),
    url: z
      .url()
      .refine(publicFeedUrl, "Feed URL must target a public HTTPS host."),
    publisher: z.string().trim().min(1).max(120),
  })
  .strict();

export const researchSourceSchema = z.discriminatedUnion("kind", [
  arxivResearchSourceSchema,
  feedResearchSourceSchema,
]);

export const researchRegistrySchema = z
  .object({ version: z.literal(1), sources: z.array(researchSourceSchema) })
  .strict()
  .superRefine((registry, context) => {
    const ids = new Set<string>();
    const locators = new Set<string>();
    registry.sources.forEach((source, index) => {
      if (ids.has(source.id))
        context.addIssue({
          code: "custom",
          message: `Duplicate research source ID: ${source.id}`,
          path: ["sources", index, "id"],
        });
      ids.add(source.id);
      const locator =
        source.kind === "arxiv_query"
          ? `${source.kind}:${source.query}`
          : `${source.kind}:${source.url}`;
      if (locators.has(locator))
        context.addIssue({
          code: "custom",
          message: `Duplicate research source locator: ${locator}`,
          path: ["sources", index],
        });
      locators.add(locator);
    });
  });

const commonItemFields = {
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  id: z.string().min(1).max(300),
  sourceIds: z.array(stableIdSchema).min(1),
  title: z.string().trim().min(1).max(500),
  url: z.url(),
  publishedAt: z.iso.datetime({ offset: true }),
  collectedAt: z.iso.datetime({ offset: true }),
  category: stableIdSchema,
  tags: z.array(sourceTagSchema),
  summaryExcerpt: z.string().trim().max(2_000).optional(),
  facetEvidence: z.array(researchProviderFacetEvidenceSchema).optional(),
};

export const researchPaperSchema = z
  .object({
    ...commonItemFields,
    type: z.literal("research_paper"),
    provider: z.literal("arxiv"),
    arxivId: z.string().trim().min(1).max(80),
    authors: z.array(z.string().trim().min(1).max(200)).max(100),
    abstractExcerpt: z.string().trim().max(2_000),
    primaryCategory: z.string().trim().min(1).max(80),
    categories: z.array(z.string().trim().min(1).max(80)).max(50),
    pdfUrl: z.url(),
    updatedAt: z.iso.datetime({ offset: true }).optional(),
    doi: z.string().trim().max(200).optional(),
  })
  .strict();

export const announcementSchema = z
  .object({
    ...commonItemFields,
    type: z.literal("official_announcement"),
    provider: z.literal("rss"),
    publisher: z.string().trim().min(1).max(120),
    externalId: z.string().trim().min(1).max(1_000),
    authors: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
    publishedAtInferred: z.boolean().optional(),
  })
  .strict();

export const researchItemSchema = z.discriminatedUnion("type", [
  researchPaperSchema,
  announcementSchema,
]);

export const researchStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    sourceId: stableIdSchema,
    cursorPublishedAt: z.iso.datetime({ offset: true }),
    cursorItemIds: z.array(z.string().min(1).max(300)),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const researchRunReportSchema = z
  .object({
    schemaVersion: z.literal(1),
    runId: z.string().min(1).max(200),
    trigger: z.enum(["schedule", "manual", "local"]),
    startedAt: z.iso.datetime({ offset: true }),
    finishedAt: z.iso.datetime({ offset: true }),
    status: z.enum(["success", "partial", "failure"]),
    totals: z
      .object({
        configured: z.number().int().nonnegative(),
        attempted: z.number().int().nonnegative(),
        skipped: z.number().int().nonnegative(),
        fetched: z.number().int().nonnegative(),
        added: z.number().int().nonnegative(),
        updated: z.number().int().nonnegative(),
        duplicatesMerged: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
      })
      .strict(),
    sources: z.array(
      z
        .object({
          sourceId: stableIdSchema,
          status: z.enum(["success", "failed", "skipped"]),
          fetched: z.number().int().nonnegative(),
          accepted: z.number().int().nonnegative(),
          error: z.string().max(500).optional(),
        })
        .strict(),
    ),
  })
  .strict();

export type ResearchSource = z.infer<typeof researchSourceSchema>;
export type ArxivResearchSource = z.infer<typeof arxivResearchSourceSchema>;
export type FeedResearchSource = z.infer<typeof feedResearchSourceSchema>;
export type ResearchRegistry = z.infer<typeof researchRegistrySchema>;
export type ResearchItem = z.infer<typeof researchItemSchema>;
export type ResearchPaper = z.infer<typeof researchPaperSchema>;
export type OfficialAnnouncement = z.infer<typeof announcementSchema>;
export type ResearchState = z.infer<typeof researchStateSchema>;
export type ResearchRunReport = z.infer<typeof researchRunReportSchema>;

export type ResearchSourceCandidate =
  | {
      kind: "arxiv_query";
      displayName: string;
      query: string;
      category: string;
      tags: string[];
      weight?: number;
      enabled?: boolean;
      facetDefaults?: ResearchFacetDefaults;
      coverageDescription?: string;
    }
  | {
      kind: "rss_feed";
      displayName: string;
      url: string;
      publisher: string;
      category: string;
      tags: string[];
      weight?: number;
      enabled?: boolean;
      facetDefaults?: ResearchFacetDefaults;
      coverageDescription?: string;
    };

export type ResearchSourceUpdate = Partial<
  Pick<
    ResearchSource,
    | "displayName"
    | "category"
    | "tags"
    | "weight"
    | "enabled"
    | "facetDefaults"
    | "coverageDescription"
  >
> & { query?: string; url?: string; publisher?: string };
