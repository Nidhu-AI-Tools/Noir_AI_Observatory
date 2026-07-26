import {
  researchItemSchema,
  researchRunReportSchema,
} from "../packages/core/src/index";
import {
  JsonResearchRunReportStore,
  JsonlResearchItemStore,
  YamlResearchRegistryStore,
} from "../packages/storage/src/index";

const root = process.cwd();
const [registry, items, reports] = await Promise.all([
  new YamlResearchRegistryStore(root).read(),
  new JsonlResearchItemStore(root).readAll(),
  new JsonResearchRunReportStore(root).readAll(),
]);
items.forEach((item) => researchItemSchema.parse(item));
reports.forEach((report) => researchRunReportSchema.parse(report));
const sourceIds = new Set(registry.sources.map((source) => source.id));
const itemIds = new Set<string>();
for (const item of items) {
  if (itemIds.has(item.id))
    throw new Error(`Duplicate research item ID: ${item.id}`);
  itemIds.add(item.id);
  for (const sourceId of item.sourceIds)
    if (!sourceIds.has(sourceId))
      throw new Error(
        `Research item ${item.id} references unknown source ${sourceId}.`,
      );
}
console.log(
  `Research data is valid: ${registry.sources.length} sources, ${items.length} items, ${reports.length} run reports.`,
);
