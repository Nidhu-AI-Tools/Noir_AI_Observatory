import {
  JsonCollectionStateStore,
  JsonRunReportStore,
  JsonlObservationStore,
  YamlRegistryStore,
} from "../packages/storage/src/index";
import { validateObservationProviderSemantics } from "../packages/core/src/index";

async function main(): Promise<void> {
  const root = process.cwd();
  const registry = await new YamlRegistryStore(root).read();
  const observations = await new JsonlObservationStore(root).readAll();
  const reports = await new JsonRunReportStore(root).readAll();
  const stateStore = new JsonCollectionStateStore(root);
  const states = await Promise.all(
    registry.registry.sources.map((source) => stateStore.read(source.id)),
  );
  const duplicateIds = observations.filter(
    (item, index) =>
      observations.findIndex((candidate) => candidate.id === item.id) !== index,
  );
  if (duplicateIds.length > 0) {
    throw new Error(
      `Duplicate observation IDs: ${duplicateIds.map((item) => item.id).join(", ")}`,
    );
  }
  const sources = new Map(
    registry.registry.sources.map((source) => [source.id, source]),
  );
  for (const observation of observations) {
    const source = sources.get(observation.sourceId);
    if (!source)
      throw new Error(
        `Observation ${observation.id} references unknown source ${observation.sourceId}.`,
      );
    validateObservationProviderSemantics(observation, source);
  }
  console.log(
    `Observation data is valid: ${observations.length} observations, ${reports.length} run reports, ${states.filter(Boolean).length} source states.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Validation failed.");
  process.exitCode = 1;
});
