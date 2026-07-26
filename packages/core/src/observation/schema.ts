import { z } from "zod";

import { sourceTagSchema } from "../source/schema";

const observationBase = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1).max(300),
  sourceId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  externalId: z.string().min(1).max(300),
  title: z.string().trim().min(1).max(300),
  url: z.url(),
  occurredAt: z.iso.datetime({ offset: true }),
  collectedAt: z.iso.datetime({ offset: true }),
  categoryId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  sourceTags: z.array(sourceTagSchema),
});

export const githubReleaseObservationSchema = observationBase
  .extend({
    type: z.literal("github_release"),
    provider: z.literal("github"),
    details: z
      .object({
        releaseId: z.string().min(1),
        tagName: z.string().min(1).max(300),
        author: z.string().max(100).optional(),
        createdAt: z.iso.datetime({ offset: true }),
        publishedAt: z.iso.datetime({ offset: true }),
        prerelease: z.boolean(),
        releaseNotesExcerpt: z.string().max(1_000).optional(),
        assetCount: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export const huggingFaceModelObservationSchema = observationBase
  .extend({
    type: z.literal("huggingface_model_revision"),
    provider: z.literal("huggingface"),
    externalRevision: z.string().min(1).max(200).optional(),
    details: z
      .object({
        modelId: z.string().min(1).max(300),
        revision: z.string().min(1).max(200).optional(),
        createdAt: z.iso.datetime({ offset: true }).optional(),
        lastModified: z.iso.datetime({ offset: true }),
        pipelineTag: z.string().max(100).optional(),
        libraryName: z.string().max(100).optional(),
        tags: z.array(z.string().min(1).max(200)),
        downloads: z.number().int().nonnegative().optional(),
        likes: z.number().int().nonnegative().optional(),
        gated: z.union([z.boolean(), z.literal("auto"), z.literal("manual")]),
      })
      .strict(),
  })
  .strict();

export const observationSchema = z.discriminatedUnion("type", [
  githubReleaseObservationSchema,
  huggingFaceModelObservationSchema,
]);

export type GitHubReleaseObservation = z.infer<
  typeof githubReleaseObservationSchema
>;
export type HuggingFaceModelObservation = z.infer<
  typeof huggingFaceModelObservationSchema
>;
export type Observation = z.infer<typeof observationSchema>;
