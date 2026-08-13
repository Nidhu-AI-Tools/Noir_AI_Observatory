import {
  modelIntelligenceRunReportSchema,
  modelReleaseEventSchema,
} from "../packages/core/src/index";
import { ModelIntelligenceRegistryService } from "../packages/model-intelligence/src/index";
import { stableHash } from "../packages/model-intelligence/src/index";
import {
  JsonModelIntelligenceRunReportStore,
  JsonlModelReleaseEventStore,
  YamlModelCategoryStore,
  YamlModelOverrideStore,
  JsonlObservationStore,
} from "../packages/storage/src/index";

const root = process.cwd();
const categories = new YamlModelCategoryStore(root);
const overrides = new YamlModelOverrideStore(root);
const [registry, events, reports, observations] = await Promise.all([
  new ModelIntelligenceRegistryService(categories, overrides).validate(),
  new JsonlModelReleaseEventStore(root).readAll(),
  new JsonModelIntelligenceRunReportStore(root).readAll(),
  new JsonlObservationStore(root).readAll(),
]);
const ids = new Set<string>();
const categoryIds = new Set(
  registry.categories.categories.map((item) => item.id),
);
const observationsById = new Map(
  observations.map((observation) => [observation.id, observation]),
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
  for (const provenance of event.provenance) {
    if (provenance.kind !== "huggingface-model") continue;
    if (!provenance.observationId)
      throw new Error(`Event ${event.id} is missing its observation lineage.`);
    const observation = observationsById.get(provenance.observationId);
    if (!observation || observation.type !== "huggingface_model_revision")
      throw new Error(
        `Event ${event.id} references missing Hugging Face observation ${provenance.observationId}.`,
      );
    const expectedEventId = `model-event-${stableHash(observation.id).slice(0, 32)}`;
    if (event.id !== expectedEventId)
      throw new Error(
        `Event ${event.id} does not match observation ${observation.id}.`,
      );
    if (
      provenance.sourceId !== observation.sourceId ||
      provenance.url !== observation.url ||
      provenance.observedAt !== observation.collectedAt ||
      event.externalModelId !== observation.details.modelId
    )
      throw new Error(
        `Event ${event.id} disagrees with observation ${observation.id}.`,
      );
  }
}
reports.forEach((report) => {
  modelIntelligenceRunReportSchema.parse(report);
  for (const eventId of report.eventIds)
    if (!ids.has(eventId))
      throw new Error(
        `Model intelligence report ${report.runId} references missing event ${eventId}.`,
      );
});
console.log(
  `Model intelligence is valid: ${registry.categories.categories.length} categories, ${registry.models.models.length} reviewed models, ${events.length} events, ${reports.length} reports.`,
);
