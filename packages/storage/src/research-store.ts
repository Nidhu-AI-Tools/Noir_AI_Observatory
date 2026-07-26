import type {
  ResearchItem,
  ResearchRegistry,
  ResearchRunReport,
  ResearchState,
} from "@noir/core";

export interface ResearchRegistryStore {
  read(): Promise<ResearchRegistry>;
  write(registry: ResearchRegistry): Promise<void>;
}

export interface ResearchItemWriteResult {
  added: number;
  updated: number;
  duplicatesMerged: number;
}

export interface ResearchItemStore {
  readAll(): Promise<ResearchItem[]>;
  upsert(items: ResearchItem[]): Promise<ResearchItemWriteResult>;
}

export interface ResearchStateStore {
  read(sourceId: string): Promise<ResearchState | undefined>;
  write(state: ResearchState): Promise<void>;
}

export interface ResearchRunReportStore {
  readAll(): Promise<ResearchRunReport[]>;
  write(report: ResearchRunReport): Promise<void>;
}
