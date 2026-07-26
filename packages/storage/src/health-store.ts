import type { HealthCheck, HealthRunReport, MonitorRegistry } from "@noir/core";

export interface MonitorRegistryStore {
  read(): Promise<MonitorRegistry>;
  write(registry: MonitorRegistry): Promise<void>;
}

export interface HealthCheckStore {
  readAll(): Promise<HealthCheck[]>;
  append(checks: HealthCheck[]): Promise<number>;
}

export interface HealthRunReportStore {
  readAll(): Promise<HealthRunReport[]>;
  write(report: HealthRunReport): Promise<void>;
}
