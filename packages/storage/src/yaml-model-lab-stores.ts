import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  benchmarkCaseRegistrySchema,
  benchmarkSuiteRegistrySchema,
  modelLabConfigSchema,
  type BenchmarkCaseRegistry,
  type BenchmarkSuiteRegistry,
  type ModelLabConfig,
} from "@noir/core";
import { parse, stringify } from "yaml";

import { atomicWrite } from "./generated/atomic-write";
import type {
  BenchmarkCaseStore,
  BenchmarkSuiteStore,
  ModelLabConfigStore,
} from "./model-lab-store";

function yaml(value: unknown) {
  return stringify(value, { indent: 2, lineWidth: 0, sortMapEntries: false });
}

export class YamlModelLabConfigStore implements ModelLabConfigStore {
  private readonly file: string;
  constructor(root: string) {
    this.file = path.join(root, "config", "model-lab.yaml");
  }
  async read() {
    return modelLabConfigSchema.parse(parse(await readFile(this.file, "utf8")));
  }
  async write(config: ModelLabConfig) {
    const value = modelLabConfigSchema.parse({
      ...config,
      models: [...config.models].sort((a, b) => a.id.localeCompare(b.id)),
    });
    await atomicWrite(this.file, yaml(value));
  }
}

export class YamlBenchmarkSuiteStore implements BenchmarkSuiteStore {
  private readonly file: string;
  constructor(root: string) {
    this.file = path.join(root, "config", "model-lab-suites.yaml");
  }
  async read() {
    return benchmarkSuiteRegistrySchema.parse(
      parse(await readFile(this.file, "utf8")),
    );
  }
  async write(registry: BenchmarkSuiteRegistry) {
    await atomicWrite(
      this.file,
      yaml(
        benchmarkSuiteRegistrySchema.parse({
          ...registry,
          suites: [...registry.suites].sort((a, b) => a.id.localeCompare(b.id)),
        }),
      ),
    );
  }
}

export class YamlBenchmarkCaseStore implements BenchmarkCaseStore {
  private readonly file: string;
  constructor(root: string) {
    this.file = path.join(root, "config", "model-lab-cases.yaml");
  }
  async read() {
    return benchmarkCaseRegistrySchema.parse(
      parse(await readFile(this.file, "utf8")),
    );
  }
  async write(registry: BenchmarkCaseRegistry) {
    await atomicWrite(
      this.file,
      yaml(
        benchmarkCaseRegistrySchema.parse({
          ...registry,
          cases: [...registry.cases].sort((a, b) => a.id.localeCompare(b.id)),
        }),
      ),
    );
  }
}
