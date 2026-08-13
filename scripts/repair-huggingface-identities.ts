import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { resolveHuggingFaceProviderIds } from "../packages/collectors/src/index";
import {
  modelReleaseEventSchema,
  observationSchema,
  parseHuggingFaceModelIdentity,
  validateObservationProviderSemantics,
  type HuggingFaceModelObservation,
  type ModelReleaseEvent,
  type Observation,
} from "../packages/core/src/index";
import { stableHash } from "../packages/model-intelligence/src/index";
import {
  YamlRegistryStore,
  parseCurationNote,
  renderCurationNote,
} from "../packages/storage/src/index";

import { atomicWrite } from "../packages/storage/src/generated/atomic-write";

const migrationId = "huggingface-identity-v1";

interface MappingFile {
  schemaVersion: 1;
  migrationId: typeof migrationId;
  generatedAt: string;
  mappings: Array<{
    owner: string;
    providerId: string;
    canonicalName: string;
  }>;
  unresolved: Array<{ owner: string; providerId: string }>;
}

interface Located<T> {
  file: string;
  values: T[];
}

async function filesBelow(
  directory: string,
  suffix: string,
): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const files = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory()
        ? filesBelow(target, suffix)
        : Promise.resolve(entry.name.endsWith(suffix) ? [target] : []);
    }),
  );
  return files.flat().sort();
}

async function readJsonl<T>(
  directory: string,
  parse: (value: unknown) => T,
): Promise<Located<T>[]> {
  return Promise.all(
    (await filesBelow(directory, ".jsonl")).map(async (file) => ({
      file,
      values: (await readFile(file, "utf8"))
        .split("\n")
        .filter(Boolean)
        .map((line) => parse(JSON.parse(line))),
    })),
  );
}

function isCanonicalObservation(
  observation: HuggingFaceModelObservation,
): boolean {
  try {
    parseHuggingFaceModelIdentity(observation.details.modelId);
    return true;
  } catch {
    return false;
  }
}

function parseArguments() {
  const values = process.argv.slice(2).filter((value) => value !== "--");
  const mode = values.includes("--resolve")
    ? "resolve"
    : values.includes("--apply")
      ? "apply"
      : "audit";
  const mappingIndex = values.indexOf("--mapping");
  return {
    mode,
    mappingPath: mappingIndex >= 0 ? values[mappingIndex + 1] : undefined,
  } as const;
}

function parseMappingFile(value: unknown): MappingFile {
  const file = value as Partial<MappingFile>;
  if (
    file.schemaVersion !== 1 ||
    file.migrationId !== migrationId ||
    !Array.isArray(file.mappings) ||
    !Array.isArray(file.unresolved)
  )
    throw new Error("The identity mapping file has an invalid shape.");
  for (const mapping of file.mappings) {
    if (!mapping.owner || !mapping.providerId || !mapping.canonicalName)
      throw new Error("The identity mapping file contains an invalid entry.");
    parseHuggingFaceModelIdentity(mapping.canonicalName);
  }
  return file as MappingFile;
}

function replacementFor(
  value: string,
  replacements: Map<string, string>,
): string {
  let result = value;
  for (const [providerId, canonicalName] of replacements)
    result = result.replaceAll(providerId, canonicalName);
  return result;
}

function assertMigrationTargetsClean(root: string): void {
  const output = execFileSync(
    "git",
    [
      "status",
      "--porcelain",
      "--",
      "data/observations",
      "data/model-events",
      "data/curation",
      "data/migrations",
    ],
    { cwd: root, encoding: "utf8" },
  ).trim();
  if (output)
    throw new Error(
      `Repair targets have uncommitted changes. Commit or stash them first:\n${output}`,
    );
}

async function main(): Promise<void> {
  const root = process.cwd();
  const args = parseArguments();
  const defaultMappingPath = path.join(
    root,
    ".noir",
    "migrations",
    `${migrationId}-mapping.json`,
  );
  const mappingPath = path.resolve(
    root,
    args.mappingPath ?? defaultMappingPath,
  );
  const snapshot = await new YamlRegistryStore(root).read();
  const sources = new Map(
    snapshot.registry.sources.map((source) => [source.id, source]),
  );
  const observationFiles = await readJsonl<Observation>(
    path.join(root, "data", "observations"),
    (value) => observationSchema.parse(value),
  );
  const observations = observationFiles.flatMap((file) => file.values);
  const affected = observations.filter(
    (item): item is HuggingFaceModelObservation =>
      item.type === "huggingface_model_revision" &&
      !isCanonicalObservation(item),
  );
  const requests = affected.map((item) => {
    const source = sources.get(item.sourceId);
    if (!source || source.kind !== "huggingface_org")
      throw new Error(
        `Observation ${item.id} has no matching Hugging Face source.`,
      );
    const displayNameCanBeOwner =
      /^[a-z0-9_.-]+$/i.test(source.displayName) &&
      source.displayName.toLowerCase() === source.locator;
    return {
      owner: source.locator,
      providerId: item.externalId,
      ...(item.details.revision ? { revision: item.details.revision } : {}),
      ...(displayNameCanBeOwner ? { queryOwners: [source.displayName] } : {}),
    };
  });
  const uniqueRequests = new Map(
    requests.map((request) => [
      `${request.owner.toLowerCase()}:${request.providerId}`,
      request,
    ]),
  );

  console.log(
    `Hugging Face identity audit: ${affected.length} affected observations, ${uniqueRequests.size} provider identities.`,
  );
  if (args.mode === "audit") {
    console.log(
      affected.length
        ? `Run with --resolve to create an authoritative mapping at ${path.relative(root, mappingPath)}.`
        : "No malformed Hugging Face observations were found.",
    );
    return;
  }

  if (args.mode === "resolve") {
    const resolution = await resolveHuggingFaceProviderIds(
      [...uniqueRequests.values()],
      {
        ...(process.env.HF_TOKEN ? { accessToken: process.env.HF_TOKEN } : {}),
      },
    );
    const mapping: MappingFile = {
      schemaVersion: 1,
      migrationId,
      generatedAt: new Date().toISOString(),
      ...resolution,
    };
    await mkdir(path.dirname(mappingPath), { recursive: true });
    await atomicWrite(mappingPath, `${JSON.stringify(mapping, null, 2)}\n`);
    console.log(
      `Resolved ${mapping.mappings.length}; ${mapping.unresolved.length} remain unresolved. Mapping written to ${path.relative(root, mappingPath)}.`,
    );
    if (mapping.unresolved.length)
      throw new Error(
        "Unresolved provider IDs remain; no repository data was changed.",
      );
    console.log("Review the mapping, then run with --apply.");
    return;
  }

  if (affected.length === 0) {
    console.log("No repair is needed; the migration is already applied.");
    return;
  }
  assertMigrationTargetsClean(root);
  const mapping = parseMappingFile(
    JSON.parse(await readFile(mappingPath, "utf8")),
  );
  if (mapping.unresolved.length)
    throw new Error(
      "The mapping contains unresolved provider IDs; refusing to apply.",
    );
  const mappings = new Map(
    mapping.mappings.map((item) => [
      `${item.owner.toLowerCase()}:${item.providerId}`,
      item,
    ]),
  );
  const repairedByObservation = new Map<
    string,
    {
      original: HuggingFaceModelObservation;
      repaired: HuggingFaceModelObservation;
    }
  >();
  const changedObservationFiles = new Map<string, Observation[]>();
  for (const located of observationFiles) {
    const next = located.values.map((item) => {
      if (
        item.type !== "huggingface_model_revision" ||
        isCanonicalObservation(item)
      )
        return item;
      const source = sources.get(item.sourceId);
      if (!source || source.kind !== "huggingface_org")
        throw new Error(
          `Observation ${item.id} has no matching Hugging Face source.`,
        );
      const resolved = mappings.get(
        `${source.locator.toLowerCase()}:${item.externalId}`,
      );
      if (!resolved)
        throw new Error(
          `No authoritative mapping exists for ${item.externalId}.`,
        );
      const identity = parseHuggingFaceModelIdentity(resolved.canonicalName);
      const repaired = observationSchema.parse({
        ...item,
        title: identity.repository,
        url: identity.url,
        details: { ...item.details, modelId: identity.canonicalName },
      }) as HuggingFaceModelObservation;
      validateObservationProviderSemantics(repaired, source);
      repairedByObservation.set(item.id, { original: item, repaired });
      return repaired;
    });
    if (next.some((item, index) => item !== located.values[index]))
      changedObservationFiles.set(located.file, next);
  }
  if (repairedByObservation.size !== affected.length)
    throw new Error("Not every affected observation received a repair.");

  const eventFiles = await readJsonl<ModelReleaseEvent>(
    path.join(root, "data", "model-events"),
    (value) => modelReleaseEventSchema.parse(value),
  );
  const repairByEvent = new Map(
    [...repairedByObservation.entries()].map(([observationId, repair]) => [
      `model-event-${stableHash(observationId).slice(0, 32)}`,
      { observationId, ...repair },
    ]),
  );
  const changedEventFiles = new Map<string, ModelReleaseEvent[]>();
  let repairedEvents = 0;
  for (const located of eventFiles) {
    const next = located.values.map((event) => {
      const repair = repairByEvent.get(event.id);
      if (!repair) return event;
      const identity = parseHuggingFaceModelIdentity(
        repair.repaired.details.modelId,
      );
      repairedEvents += 1;
      return modelReleaseEventSchema.parse({
        ...event,
        canonicalName: identity.repository,
        externalModelId: identity.canonicalName,
        links: event.links.map((link) =>
          link.kind === "model-card" ? { ...link, url: identity.url } : link,
        ),
        provenance: event.provenance.map((provenance) =>
          provenance.kind === "huggingface-model"
            ? {
                ...provenance,
                observationId: repair.observationId,
                url: identity.url,
              }
            : provenance,
        ),
      });
    });
    if (next.some((item, index) => item !== located.values[index]))
      changedEventFiles.set(located.file, next);
  }

  const replacementsBySource = new Map<
    string,
    { providerId: string; canonicalName: string; url: string }
  >();
  for (const [observationId, repair] of repairedByObservation) {
    const value = {
      providerId: repair.original.details.modelId,
      canonicalName: repair.repaired.details.modelId,
      url: repair.repaired.url,
    };
    replacementsBySource.set(observationId, value);
    replacementsBySource.set(
      `model-event-${stableHash(observationId).slice(0, 32)}`,
      value,
    );
  }
  const changedCurationFiles = new Map<string, string>();
  for (const file of await filesBelow(
    path.join(root, "data", "curation"),
    ".md",
  )) {
    const originalText = await readFile(file, "utf8");
    const note = parseCurationNote(originalText, file);
    const relevant = note.sourceIds
      .map((sourceId) => replacementsBySource.get(sourceId))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (!relevant.length) continue;
    const replacements = new Map(
      relevant.map((item) => [item.providerId, item.canonicalName]),
    );
    const repaired = {
      ...note,
      headline: replacementFor(note.headline, replacements),
      summary: replacementFor(note.summary, replacements),
      caveats: note.caveats.map((item) => replacementFor(item, replacements)),
      highlights: note.highlights.map((highlight) => {
        const sourceRepair = replacementsBySource.get(highlight.sourceId);
        return {
          ...highlight,
          title: replacementFor(highlight.title, replacements),
          summary: replacementFor(highlight.summary, replacements),
          whyItMatters: replacementFor(highlight.whyItMatters, replacements),
          ...(sourceRepair ? { sourceUrl: sourceRepair.url } : {}),
        };
      }),
    };
    const rendered = renderCurationNote(repaired);
    if (rendered !== originalText) changedCurationFiles.set(file, rendered);
  }

  for (const [file, values] of changedObservationFiles)
    await atomicWrite(
      file,
      `${values.map((item) => JSON.stringify(item)).join("\n")}\n`,
    );
  for (const [file, values] of changedEventFiles)
    await atomicWrite(
      file,
      `${values.map((item) => JSON.stringify(item)).join("\n")}\n`,
    );
  for (const [file, value] of changedCurationFiles)
    await atomicWrite(file, value);

  const reportPath = path.join(
    root,
    "data",
    "migrations",
    `${migrationId}.json`,
  );
  const report = {
    schemaVersion: 1,
    migrationId,
    appliedAt: new Date().toISOString(),
    strategy:
      "Preserved observation, event, model, cursor, and run-report IDs; repaired canonical display fields and exact provenance lineage.",
    totals: {
      observations: repairedByObservation.size,
      modelEvents: repairedEvents,
      curationNotes: changedCurationFiles.size,
      unresolved: 0,
    },
    mappings: mapping.mappings,
    changedFiles: [
      ...changedObservationFiles.keys(),
      ...changedEventFiles.keys(),
      ...changedCurationFiles.keys(),
    ].map((file) => path.relative(root, file)),
  };
  await atomicWrite(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `Applied ${migrationId}: ${report.totals.observations} observations, ${report.totals.modelEvents} model events, ${report.totals.curationNotes} curation notes.`,
  );
  console.log(`Review ${path.relative(root, reportPath)} and git diff.`);
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Identity repair failed.",
  );
  process.exitCode = 1;
});
