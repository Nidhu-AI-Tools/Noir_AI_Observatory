import type {
  CollectionCursor,
  Observation,
  SourceCollectionState,
  SourceConfig,
  SourceKind,
} from "@noir/core";

export interface CollectionContext {
  collectedAt: Date;
  lookbackDays: number;
  maxObservationsPerSource: number;
  githubToken?: string;
  huggingFaceToken?: string;
}

export interface CollectionBatch {
  observations: Observation[];
  cursor: CollectionCursor;
  etag?: string;
  truncated: boolean;
  warnings: string[];
}

export interface ObservationCollector {
  readonly kind: SourceKind;
  collect(
    source: SourceConfig,
    state: SourceCollectionState | undefined,
    context: CollectionContext,
  ): Promise<CollectionBatch>;
}

export class CollectionError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_found"
      | "rate_limited"
      | "unauthorized"
      | "invalid_response"
      | "network_error",
    readonly retryable = false,
  ) {
    super(message);
    this.name = "CollectionError";
  }
}

export function collectionCutoff(
  state: SourceCollectionState | undefined,
  context: CollectionContext,
): CollectionCursor {
  if (state) return state.cursor;
  const timestamp = new Date(
    context.collectedAt.valueOf() - context.lookbackDays * 86_400_000,
  ).toISOString();
  return { timestamp, externalIdsAtTimestamp: [] };
}

export function isAfterCursor(
  timestamp: string,
  externalId: string,
  cursor: CollectionCursor,
): boolean {
  return (
    timestamp > cursor.timestamp ||
    (timestamp === cursor.timestamp &&
      !cursor.externalIdsAtTimestamp.includes(externalId))
  );
}

export function nextCursor(
  current: CollectionCursor,
  observations: Observation[],
): CollectionCursor {
  if (observations.length === 0) return current;
  const timestamp = observations.reduce(
    (latest, item) => (item.occurredAt > latest ? item.occurredAt : latest),
    current.timestamp,
  );
  const externalIdsAtTimestamp = [
    ...new Set([
      ...(timestamp === current.timestamp
        ? current.externalIdsAtTimestamp
        : []),
      ...observations
        .filter((item) => item.occurredAt === timestamp)
        .map((item) => item.externalId),
    ]),
  ].sort();
  return { timestamp, externalIdsAtTimestamp };
}
