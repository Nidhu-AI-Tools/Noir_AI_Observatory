import type {
  ModelCategoryRegistry,
  ModelIntelligenceConfig,
  ModelIntelligenceRunReport,
  ModelOverrideRegistry,
  ModelReleaseEvent,
} from "@noir/core";

export interface ModelIntelligenceConfigStore {
  read(): Promise<ModelIntelligenceConfig>;
}
export interface ModelCategoryStore {
  read(): Promise<ModelCategoryRegistry>;
  write(value: ModelCategoryRegistry): Promise<void>;
}
export interface ModelOverrideStore {
  read(): Promise<ModelOverrideRegistry>;
  write(value: ModelOverrideRegistry): Promise<void>;
}
export interface ModelReleaseEventStore {
  readAll(): Promise<ModelReleaseEvent[]>;
  append(events: ModelReleaseEvent[]): Promise<number>;
}
export interface ModelIntelligenceRunReportStore {
  readAll(): Promise<ModelIntelligenceRunReport[]>;
  write(report: ModelIntelligenceRunReport): Promise<void>;
}
