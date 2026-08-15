import { z } from "zod";

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const facet = z
  .object({
    id,
    name: z.string().trim().min(1).max(120),
    aliases: z.array(z.string().trim().min(1).max(120)).default([]),
  })
  .strict();

export const researchTopicSchema = facet
  .extend({
    mappings: z
      .object({
        arxivCategories: z.array(z.string().trim().min(1).max(80)).default([]),
        tags: z.array(id).default([]),
      })
      .strict(),
  })
  .strict();

export const researchDiscoveryTaxonomySchema = z
  .object({
    version: z.literal(1),
    organizations: z.array(facet),
    venues: z.array(facet),
    topics: z.array(researchTopicSchema),
  })
  .strict()
  .superRefine((taxonomy, context) => {
    for (const [dimension, values] of [
      ["organizations", taxonomy.organizations],
      ["venues", taxonomy.venues],
      ["topics", taxonomy.topics],
    ] as const) {
      const ids = new Set<string>();
      const aliases = new Set<string>();
      values.forEach((value, index) => {
        if (ids.has(value.id))
          context.addIssue({
            code: "custom",
            message: `Duplicate ${dimension} ID: ${value.id}`,
            path: [dimension, index, "id"],
          });
        ids.add(value.id);
        for (const alias of [value.name, ...value.aliases]) {
          const normalized = alias
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
          if (aliases.has(normalized))
            context.addIssue({
              code: "custom",
              message: `Duplicate ${dimension} alias: ${alias}`,
              path: [dimension, index, "aliases"],
            });
          aliases.add(normalized);
        }
      });
    }
  });

export const researchFacetDefaultsSchema = z
  .object({
    organizations: z.array(id).default([]),
    venues: z.array(id).default([]),
    topics: z.array(id).default([]),
  })
  .strict();

export const researchProviderFacetEvidenceSchema = z
  .object({
    dimension: z.enum(["organization", "venue"]),
    facetId: id,
    provider: z.string().trim().min(1).max(80),
    field: z.string().trim().min(1).max(120),
    value: z.string().trim().min(1).max(300),
  })
  .strict();

export type ResearchDiscoveryTaxonomy = z.infer<
  typeof researchDiscoveryTaxonomySchema
>;
export type ResearchFacetDefaults = z.infer<typeof researchFacetDefaultsSchema>;
