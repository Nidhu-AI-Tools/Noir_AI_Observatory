import {
  modelIntelligenceRunReportSchema,
  modelReleaseEventSchema,
} from "../packages/core/src/index";
import { ModelIntelligenceRegistryService } from "../packages/model-intelligence/src/index";
import {
  JsonModelIntelligenceRunReportStore,
  JsonlModelReleaseEventStore,
  YamlModelCategoryStore,
  YamlModelOverrideStore,
} from "../packages/storage/src/index";

const root = process.cwd();
const categories = new YamlModelCategoryStore(root);
const overrides = new YamlModelOverrideStore(root);
const [registry, events, reports] = await Promise.all([
  new ModelIntelligenceRegistryService(categories, overrides).validate(),
  new JsonlModelReleaseEventStore(root).readAll(),
  new JsonModelIntelligenceRunReportStore(root).readAll(),
]);
const ids = new Set<string>();
const categoryIds = new Set(
  registry.categories.categories.map((item) => item.id),
);
for (const event of events) {
  modelReleaseEventSchema.parse(event);
  if (ids.has(event.id))
    throw new Error(`Duplicate model event ID: ${event.id}`);
  ids.add(event.id);
  for (const category of event.categories)
    if (!categoryIds.has(category))
      throw new Error(
        `Event ${event.id} references unknown category ${category}.`,
      );
}
reports.forEach((report) => modelIntelligenceRunReportSchema.parse(report));
console.log(
  `Model intelligence is valid: ${registry.categories.categories.length} categories, ${registry.models.models.length} reviewed models, ${events.length} events, ${reports.length} reports.`,
);
