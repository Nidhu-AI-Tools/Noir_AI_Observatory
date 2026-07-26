import { z } from "zod";

import { normalizeLocator, normalizeTags } from "./normalization";
import { SOURCE_KINDS } from "./types";

export const sourceKindSchema = z.enum(SOURCE_KINDS);
export const sourceTagSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const sourceConfigSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    kind: sourceKindSchema,
    locator: z.string().min(1),
    displayName: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
    categoryId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    tags: z.array(sourceTagSchema),
    enabled: z.boolean(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .superRefine((source, context) => {
    const normalized = normalizeLocator(source.kind, source.locator);
    const locatorPattern =
      source.kind === "github_repo"
        ? /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/
        : /^[a-z0-9_.-]+$/;

    if (!locatorPattern.test(normalized)) {
      context.addIssue({
        code: "custom",
        message:
          source.kind === "github_repo"
            ? "GitHub locators must use owner/repository."
            : "Hugging Face locators must use an organization identifier.",
        path: ["locator"],
      });
    }

    if (normalized !== source.locator) {
      context.addIssue({
        code: "custom",
        message: `Locator must be normalized as ${normalized}.`,
        path: ["locator"],
      });
    }

    if (normalizeTags(source.tags).length !== source.tags.length) {
      context.addIssue({
        code: "custom",
        message: "Tags must be unique and normalized.",
        path: ["tags"],
      });
    }
  });

export const sourceRegistrySchema = z
  .object({
    version: z.literal(1),
    sources: z.array(sourceConfigSchema),
  })
  .strict()
  .superRefine((registry, context) => {
    const ids = new Set<string>();
    const locators = new Set<string>();

    registry.sources.forEach((source, index) => {
      if (ids.has(source.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate source ID: ${source.id}`,
          path: ["sources", index, "id"],
        });
      }
      ids.add(source.id);

      const key = `${source.kind}:${source.locator}`;
      if (locators.has(key)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate source locator: ${source.locator}`,
          path: ["sources", index, "locator"],
        });
      }
      locators.add(key);
    });
  });

export type SourceConfig = z.infer<typeof sourceConfigSchema>;
export type SourceRegistry = z.infer<typeof sourceRegistrySchema>;
