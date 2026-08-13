import type { SourceConfig } from "../source/schema";
import {
  assertGitHubReleaseUrl,
  assertHuggingFaceModelUrl,
  assertHuggingFaceOwner,
  parseHuggingFaceModelIdentity,
} from "./provider-identity";
import type { Observation } from "./schema";

export function validateObservationProviderSemantics(
  observation: Observation,
  source: SourceConfig,
): void {
  if (observation.sourceId !== source.id)
    throw new Error(
      `Observation ${observation.id} references ${observation.sourceId}, not ${source.id}.`,
    );

  if (observation.type === "huggingface_model_revision") {
    if (source.kind !== "huggingface_org")
      throw new Error(
        `Hugging Face observation ${observation.id} requires a Hugging Face organization source.`,
      );
    const identity = parseHuggingFaceModelIdentity(observation.details.modelId);
    assertHuggingFaceOwner(identity.canonicalName, source.locator);
    assertHuggingFaceModelUrl(identity.canonicalName, observation.url);
    if (observation.title !== identity.repository)
      throw new Error(
        `Hugging Face observation ${observation.id} title does not match ${identity.canonicalName}.`,
      );
    if (observation.externalRevision !== observation.details.revision)
      throw new Error(
        `Hugging Face observation ${observation.id} has inconsistent revisions.`,
      );
    if (observation.occurredAt !== observation.details.lastModified)
      throw new Error(
        `Hugging Face observation ${observation.id} has inconsistent timestamps.`,
      );
    return;
  }

  if (source.kind !== "github_repo")
    throw new Error(
      `GitHub observation ${observation.id} requires a GitHub repository source.`,
    );
  assertGitHubReleaseUrl(
    source.locator,
    observation.details.tagName,
    observation.url,
  );
  if (observation.externalId !== observation.details.releaseId)
    throw new Error(
      `GitHub observation ${observation.id} has inconsistent release IDs.`,
    );
  if (observation.occurredAt !== observation.details.publishedAt)
    throw new Error(
      `GitHub observation ${observation.id} has inconsistent timestamps.`,
    );
}
