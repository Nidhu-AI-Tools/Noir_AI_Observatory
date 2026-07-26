import type { Observation } from "@noir/core";
import type { RegistrySnapshot } from "@noir/storage";

export interface DashboardSourceReference {
  id: string;
  displayName: string;
  locator: string;
  kind: "github_repo" | "huggingface_org";
  externalUrl: string;
}

export interface DashboardObservation {
  id: string;
  type: Observation["type"];
  provider: Observation["provider"];
  title: string;
  url: string;
  occurredAt: string;
  collectedAt: string;
  source: DashboardSourceReference;
  category: { id: string; name: string };
  tags: string[];
  summary?: string;
  release?: {
    tagName: string;
    prerelease: boolean;
    assetCount: number;
  };
  model?: {
    modelId: string;
    pipelineTag?: string;
    libraryName?: string;
    gated: boolean | "auto" | "manual";
    downloads?: number;
    likes?: number;
  };
}

export function buildObservationViews(
  snapshot: RegistrySnapshot,
  observations: Observation[],
): DashboardObservation[] {
  const sources = new Map(
    snapshot.registry.sources.map((source) => [source.id, source]),
  );
  const categories = new Map(
    snapshot.taxonomy.categories.map((category) => [category.id, category]),
  );

  return observations
    .map((observation): DashboardObservation => {
      const source = sources.get(observation.sourceId);
      const kind =
        source?.kind ??
        (observation.provider === "github" ? "github_repo" : "huggingface_org");
      const locator = source?.locator ?? observation.sourceId;
      const category = categories.get(observation.categoryId);
      return {
        id: observation.id,
        type: observation.type,
        provider: observation.provider,
        title: observation.title,
        url: observation.url,
        occurredAt: observation.occurredAt,
        collectedAt: observation.collectedAt,
        source: {
          id: observation.sourceId,
          displayName: source?.displayName ?? observation.sourceId,
          locator,
          kind,
          externalUrl:
            kind === "github_repo"
              ? `https://github.com/${locator}`
              : `https://huggingface.co/${locator}`,
        },
        category: {
          id: observation.categoryId,
          name: category?.name ?? observation.categoryId,
        },
        tags: observation.sourceTags,
        ...(observation.type === "github_release"
          ? {
              ...(observation.details.releaseNotesExcerpt
                ? { summary: observation.details.releaseNotesExcerpt }
                : {}),
              release: {
                tagName: observation.details.tagName,
                prerelease: observation.details.prerelease,
                assetCount: observation.details.assetCount,
              },
            }
          : {
              model: {
                modelId: observation.details.modelId,
                ...(observation.details.pipelineTag
                  ? { pipelineTag: observation.details.pipelineTag }
                  : {}),
                ...(observation.details.libraryName
                  ? { libraryName: observation.details.libraryName }
                  : {}),
                gated: observation.details.gated,
                ...(observation.details.downloads === undefined
                  ? {}
                  : { downloads: observation.details.downloads }),
                ...(observation.details.likes === undefined
                  ? {}
                  : { likes: observation.details.likes }),
              },
            }),
      };
    })
    .sort(
      (left, right) =>
        right.occurredAt.localeCompare(left.occurredAt) ||
        left.id.localeCompare(right.id),
    );
}

export function isWithinWindow(
  timestamp: string,
  now: Date,
  windowMs: number,
): boolean {
  const value = new Date(timestamp).valueOf();
  return value <= now.valueOf() && value >= now.valueOf() - windowMs;
}
