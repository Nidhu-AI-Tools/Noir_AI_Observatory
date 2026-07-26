import {
  modelLabConfigSchema,
  modelProfileSchema,
  type ModelProfile,
  type ModelProvider,
} from "@noir/core";
import type {
  BenchmarkCaseStore,
  BenchmarkSuiteStore,
  ModelLabConfigStore,
} from "@noir/storage";

import { sha256 } from "./hash";

export interface ModelProfileCandidate {
  provider: ModelProvider;
  displayName: string;
  model: string;
  timeoutMs?: number;
  maxOutputTokens?: number;
  enabled?: boolean;
}
export type ModelProfileUpdate = Partial<
  Pick<
    ModelProfile,
    "displayName" | "model" | "timeoutMs" | "maxOutputTokens" | "enabled"
  >
>;

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
export class ModelLabRegistryService {
  constructor(
    private readonly configStore: ModelLabConfigStore,
    private readonly suiteStore: BenchmarkSuiteStore,
    private readonly caseStore: BenchmarkCaseStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}
  async validate() {
    const [config, suiteRegistry, caseRegistry] = await Promise.all([
      this.configStore.read(),
      this.suiteStore.read(),
      this.caseStore.read(),
    ]);
    const suites = new Map(
      suiteRegistry.suites.map((suite) => [suite.id, suite]),
    );
    for (const item of caseRegistry.cases) {
      const suite = suites.get(item.suiteId);
      if (!suite)
        throw new Error(
          `Benchmark case ${item.id} references unknown suite ${item.suiteId}.`,
        );
    }
    return { config, suites: suiteRegistry.suites, cases: caseRegistry.cases };
  }
  async add(candidate: ModelProfileCandidate) {
    const { config } = await this.validate();
    const base =
      slug(`${candidate.provider}-${candidate.displayName}`) ||
      `${candidate.provider}-${sha256(candidate.model).slice(0, 8)}`;
    let id = base;
    let suffix = 2;
    while (config.models.some((profile) => profile.id === id))
      id = `${base}-${suffix++}`;
    const now = this.clock().toISOString();
    const profile = modelProfileSchema.parse({
      id,
      ...candidate,
      timeoutMs: candidate.timeoutMs ?? 60_000,
      maxOutputTokens: candidate.maxOutputTokens ?? 800,
      enabled: candidate.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    });
    await this.configStore.write(
      modelLabConfigSchema.parse({
        ...config,
        models: [...config.models, profile],
      }),
    );
    return profile;
  }
  async update(id: string, update: ModelProfileUpdate) {
    const { config } = await this.validate();
    const current = config.models.find((profile) => profile.id === id);
    if (!current) throw new Error(`Unknown model profile: ${id}`);
    const profile = modelProfileSchema.parse({
      ...current,
      ...update,
      updatedAt: this.clock().toISOString(),
    });
    await this.configStore.write({
      ...config,
      models: config.models.map((item) => (item.id === id ? profile : item)),
    });
    return profile;
  }
  async setEnabled(id: string, enabled: boolean) {
    return this.update(id, { enabled });
  }
}
