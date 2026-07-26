import type {
  CollectionRunReport,
  Observation,
  SourceCollectionState,
} from "@noir/core";

export interface ObservationStore {
  readAll(): Promise<Observation[]>;
  append(observations: Observation[]): Promise<number>;
}

export interface CollectionStateStore {
  read(sourceId: string): Promise<SourceCollectionState | undefined>;
  write(state: SourceCollectionState): Promise<void>;
}

export interface RunReportStore {
  readAll(): Promise<CollectionRunReport[]>;
  write(report: CollectionRunReport): Promise<void>;
}
