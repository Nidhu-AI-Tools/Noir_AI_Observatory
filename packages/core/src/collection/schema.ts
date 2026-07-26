import { z } from "zod";

export const collectionCursorSchema = z
  .object({
    timestamp: z.iso.datetime({ offset: true }),
    externalIdsAtTimestamp: z.array(z.string().min(1)),
  })
  .strict();

export const sourceCollectionStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    sourceId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    lastSuccessfulAt: z.iso.datetime({ offset: true }),
    cursor: collectionCursorSchema,
    etag: z.string().optional(),
  })
  .strict();

const collectionSourceResultSchema = z
  .object({
    sourceId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    status: z.enum(["success", "failed", "skipped", "truncated"]),
    durationMs: z.number().int().nonnegative(),
    observations: z.number().int().nonnegative(),
    cursorBefore: collectionCursorSchema.optional(),
    cursorAfter: collectionCursorSchema.optional(),
    error: z
      .object({
        code: z.string().min(1).max(100),
        message: z.string().min(1).max(500),
      })
      .strict()
      .optional(),
  })
  .strict();

export const collectionRunReportSchema = z
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
        succeeded: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
        skipped: z.number().int().nonnegative(),
        observations: z.number().int().nonnegative(),
      })
      .strict(),
    sources: z.array(collectionSourceResultSchema),
  })
  .strict();

export type CollectionCursor = z.infer<typeof collectionCursorSchema>;
export type SourceCollectionState = z.infer<typeof sourceCollectionStateSchema>;
export type CollectionSourceResult = z.infer<
  typeof collectionSourceResultSchema
>;
export type CollectionRunReport = z.infer<typeof collectionRunReportSchema>;
