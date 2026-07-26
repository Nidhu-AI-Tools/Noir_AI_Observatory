import type {
  BenchmarkCaseRegistry,
  BenchmarkSuiteRegistry,
  ModelLabConfig,
  ModelLabResponse,
  ModelLabRunReport,
} from "@noir/core";

export interface ModelLabConfigStore {
  read(): Promise<ModelLabConfig>;
  write(config: ModelLabConfig): Promise<void>;
}
export interface BenchmarkSuiteStore {
  read(): Promise<BenchmarkSuiteRegistry>;
  write(registry: BenchmarkSuiteRegistry): Promise<void>;
}
export interface BenchmarkCaseStore {
  read(): Promise<BenchmarkCaseRegistry>;
  write(registry: BenchmarkCaseRegistry): Promise<void>;
}
export interface ModelLabResponseStore {
  readAll(): Promise<ModelLabResponse[]>;
  append(responses: ModelLabResponse[]): Promise<number>;
}
export interface ModelLabRunReportStore {
  readAll(): Promise<ModelLabRunReport[]>;
  write(report: ModelLabRunReport): Promise<void>;
}
