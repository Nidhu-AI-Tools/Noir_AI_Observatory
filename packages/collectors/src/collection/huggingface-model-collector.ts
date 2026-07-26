import { listModels } from "@huggingface/hub";
import {
  createObservationId,
  huggingFaceModelObservationSchema,
  type HuggingFaceModelObservation,
  type SourceCollectionState,
  type SourceConfig,
} from "@noir/core";

import {
  CollectionError,
  collectionCutoff,
  isAfterCursor,
  nextCursor,
  type CollectionBatch,
  type CollectionContext,
  type ObservationCollector,
} from "./observation-collector";
import { withRetry } from "./retry";

export interface HuggingFaceModelRecord {
  id: string;
  private: boolean;
  gated: false | "auto" | "manual";
  task?: string;
  likes: number;
  downloads: number;
  updatedAt: Date;
  createdAt?: string;
  sha?: string;
  library_name?: string;
  tags?: string[];
}

export interface HuggingFaceModelClient {
  listRecentModels(options: {
    owner: string;
    limit: number;
    accessToken?: string;
  }): Promise<HuggingFaceModelRecord[]>;
}

export class OfficialHuggingFaceModelClient implements HuggingFaceModelClient {
  async listRecentModels(options: {
    owner: string;
    limit: number;
    accessToken?: string;
  }): Promise<HuggingFaceModelRecord[]> {
    const models: HuggingFaceModelRecord[] = [];
    const iterator = listModels({
      search: { owner: options.owner },
      sort: "lastModified",
      limit: options.limit,
      additionalFields: ["createdAt", "sha", "library_name", "tags"],
      ...(options.accessToken ? { accessToken: options.accessToken } : {}),
    });
    for await (const model of iterator) {
      models.push({
        id: model.id,
        private: model.private,
        gated: model.gated,
        ...(model.task ? { task: model.task } : {}),
        likes: model.likes,
        downloads: model.downloads,
        updatedAt: model.updatedAt,
        ...(model.createdAt ? { createdAt: model.createdAt } : {}),
        ...(model.sha ? { sha: model.sha } : {}),
        ...(model.library_name ? { library_name: model.library_name } : {}),
        ...(model.tags ? { tags: model.tags } : {}),
      });
    }
    return models;
  }
}

function normalizeProviderTags(tags: string[] | undefined): string[] {
  return [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))]
    .sort()
    .slice(0, 50);
}

export class HuggingFaceModelCollector implements ObservationCollector {
  readonly kind = "huggingface_org" as const;

  constructor(
    private readonly client: HuggingFaceModelClient = new OfficialHuggingFaceModelClient(),
  ) {}

  async collect(
    source: SourceConfig,
    state: SourceCollectionState | undefined,
    context: CollectionContext,
  ): Promise<CollectionBatch> {
    const cursor = collectionCutoff(state, context);
    const displayNameCanBeOwner =
      /^[a-z0-9_.-]+$/i.test(source.displayName) &&
      source.displayName.toLowerCase() === source.locator;
    const owners = [
      ...(displayNameCanBeOwner ? [source.displayName] : []),
      source.locator,
    ].filter((owner, index, values) => values.indexOf(owner) === index);
    let records: HuggingFaceModelRecord[] = [];
    for (const owner of owners) {
      records = await withRetry(
        async () => {
          try {
            return await this.client.listRecentModels({
              owner,
              limit: context.maxObservationsPerSource,
              ...(context.huggingFaceToken
                ? { accessToken: context.huggingFaceToken }
                : {}),
            });
          } catch (error) {
            if (error instanceof CollectionError) throw error;
            throw new CollectionError(
              `Hugging Face collection failed for ${source.locator}.`,
              "network_error",
              true,
            );
          }
        },
        {
          shouldRetry: (error) =>
            error instanceof CollectionError && error.retryable,
        },
      );
      if (records.length > 0) break;
    }

    const eligible = records
      .filter((model) => {
        if (model.private) return false;
        const timestamp = model.updatedAt.toISOString();
        return isAfterCursor(timestamp, model.id, cursor);
      })
      .sort(
        (left, right) =>
          left.updatedAt.valueOf() - right.updatedAt.valueOf() ||
          left.id.localeCompare(right.id),
      );
    const limited = eligible.slice(0, context.maxObservationsPerSource);
    const observations = limited.map((model): HuggingFaceModelObservation => {
      const revision = model.sha;
      const revisionIdentity = revision ?? model.updatedAt.toISOString();
      return huggingFaceModelObservationSchema.parse({
        schemaVersion: 1,
        id: createObservationId(
          "huggingface_model_revision",
          source.id,
          model.id,
          revisionIdentity,
        ),
        type: "huggingface_model_revision",
        provider: "huggingface",
        sourceId: source.id,
        externalId: model.id,
        ...(revision ? { externalRevision: revision } : {}),
        title: model.id.split("/").at(-1) ?? model.id,
        url: `https://huggingface.co/${model.id}`,
        occurredAt: model.updatedAt.toISOString(),
        collectedAt: context.collectedAt.toISOString(),
        categoryId: source.categoryId,
        sourceTags: source.tags,
        details: {
          modelId: model.id,
          ...(revision ? { revision } : {}),
          ...(model.createdAt
            ? { createdAt: new Date(model.createdAt).toISOString() }
            : {}),
          lastModified: model.updatedAt.toISOString(),
          ...(model.task ? { pipelineTag: model.task } : {}),
          ...(model.library_name ? { libraryName: model.library_name } : {}),
          tags: normalizeProviderTags(model.tags),
          downloads: model.downloads,
          likes: model.likes,
          gated: model.gated,
        },
      });
    });
    const truncated =
      records.length >= context.maxObservationsPerSource &&
      eligible.length >= context.maxObservationsPerSource;
    return {
      observations,
      cursor: nextCursor(cursor, observations),
      truncated,
      warnings: truncated
        ? ["Hugging Face results reached the per-source safety limit."]
        : [],
    };
  }
}
