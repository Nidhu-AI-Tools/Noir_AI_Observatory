import { z } from "zod";

export const categorySchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(300).optional(),
  })
  .strict();

export const taxonomySchema = z
  .object({
    version: z.literal(1),
    categories: z.array(categorySchema),
  })
  .strict()
  .superRefine((taxonomy, context) => {
    const ids = new Set<string>();
    taxonomy.categories.forEach((category, index) => {
      if (ids.has(category.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate category ID: ${category.id}`,
          path: ["categories", index, "id"],
        });
      }
      ids.add(category.id);
    });
  });

export type Category = z.infer<typeof categorySchema>;
export type Taxonomy = z.infer<typeof taxonomySchema>;

export function validateCategoryReferences(
  sourceCategoryIds: readonly string[],
  taxonomy: Taxonomy,
): string[] {
  const categoryIds = new Set(
    taxonomy.categories.map((category) => category.id),
  );
  return [
    ...new Set(
      sourceCategoryIds.filter((categoryId) => !categoryIds.has(categoryId)),
    ),
  ];
}
