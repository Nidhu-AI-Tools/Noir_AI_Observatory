import {
  monitorConfigSchema,
  monitorRegistrySchema,
  normalizeTags,
  toStableId,
  type MonitorCandidate,
  type MonitorConfig,
  type MonitorUpdate,
} from "@noir/core";
import type { MonitorRegistryStore, RegistryStore } from "@noir/storage";

export class MonitorRegistryService {
  constructor(
    private readonly store: MonitorRegistryStore,
    private readonly sourceStore: RegistryStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private validateReferences(
    monitor: MonitorConfig,
    sources: Awaited<ReturnType<RegistryStore["read"]>>,
  ): void {
    if (
      !sources.taxonomy.categories.some(
        (item) => item.id === monitor.categoryId,
      )
    )
      throw new Error(
        `Monitor ${monitor.id} references unknown category ${monitor.categoryId}.`,
      );
    if (
      monitor.linkedSourceId &&
      !sources.registry.sources.some(
        (item) => item.id === monitor.linkedSourceId,
      )
    )
      throw new Error(
        `Monitor ${monitor.id} references unknown source ${monitor.linkedSourceId}.`,
      );
  }

  async validate() {
    const [registry, sources] = await Promise.all([
      this.store.read(),
      this.sourceStore.read(),
    ]);
    const categories = new Set(
      sources.taxonomy.categories.map((item) => item.id),
    );
    const sourceIds = new Set(sources.registry.sources.map((item) => item.id));
    for (const monitor of registry.monitors) {
      if (!categories.has(monitor.categoryId))
        throw new Error(
          `Monitor ${monitor.id} references unknown category ${monitor.categoryId}.`,
        );
      if (monitor.linkedSourceId && !sourceIds.has(monitor.linkedSourceId))
        throw new Error(
          `Monitor ${monitor.id} references unknown source ${monitor.linkedSourceId}.`,
        );
    }
    return { registry, sources };
  }

  async add(candidate: MonitorCandidate): Promise<MonitorConfig> {
    const { registry, sources } = await this.validate();
    const url = new URL(candidate.url).toString();
    const slug =
      toStableId(`${new URL(url).hostname}-${new URL(url).pathname}`) ||
      "endpoint";
    const baseId = `api-${slug}`;
    let id = baseId;
    let suffix = 2;
    while (registry.monitors.some((item) => item.id === id))
      id = `${baseId}-${suffix++}`;
    const now = this.clock().toISOString();
    const monitor = monitorConfigSchema.parse({
      id,
      displayName: candidate.displayName,
      ...(candidate.description ? { description: candidate.description } : {}),
      url,
      method: candidate.method ?? "GET",
      expectedStatuses: candidate.expectedStatuses ?? [200],
      timeoutMs: candidate.timeoutMs ?? 10_000,
      degradedAfterMs: candidate.degradedAfterMs ?? 1_500,
      categoryId: candidate.categoryId,
      tags: normalizeTags(candidate.tags),
      ...(candidate.linkedSourceId
        ? { linkedSourceId: candidate.linkedSourceId }
        : {}),
      enabled: candidate.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    });
    this.validateReferences(monitor, sources);
    await this.store.write(
      monitorRegistrySchema.parse({
        ...registry,
        monitors: [...registry.monitors, monitor],
      }),
    );
    return monitor;
  }

  async update(id: string, update: MonitorUpdate): Promise<MonitorConfig> {
    const { registry, sources } = await this.validate();
    const current = registry.monitors.find((item) => item.id === id);
    if (!current) throw new Error(`Unknown monitor: ${id}`);
    const updated = monitorConfigSchema.parse({
      ...current,
      ...update,
      ...(update.tags ? { tags: normalizeTags(update.tags) } : {}),
      updatedAt: this.clock().toISOString(),
    });
    this.validateReferences(updated, sources);
    await this.store.write({
      ...registry,
      monitors: registry.monitors.map((item) =>
        item.id === id ? updated : item,
      ),
    });
    return updated;
  }

  async setEnabled(id: string, enabled: boolean) {
    return this.update(id, { enabled });
  }
}
