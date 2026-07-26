import {
  normalizeTags,
  researchRegistrySchema,
  researchSourceSchema,
  toStableId,
  type ResearchSource,
  type ResearchSourceCandidate,
  type ResearchSourceUpdate,
} from "@noir/core";
import type { ResearchRegistryStore } from "@noir/storage";

export class ResearchRegistryService {
  constructor(
    private readonly store: ResearchRegistryStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async validate() {
    return this.store.read();
  }

  async add(candidate: ResearchSourceCandidate): Promise<ResearchSource> {
    const registry = await this.store.read();
    const locator =
      candidate.kind === "arxiv_query" ? candidate.query : candidate.url;
    const baseId =
      toStableId(`${candidate.kind}-${candidate.displayName}`) ||
      toStableId(locator) ||
      "research-source";
    let id = baseId;
    let suffix = 2;
    while (registry.sources.some((source) => source.id === id))
      id = `${baseId}-${suffix++}`;
    const now = this.clock().toISOString();
    const source = researchSourceSchema.parse({
      ...candidate,
      id,
      ...(candidate.kind === "rss_feed"
        ? { url: new URL(candidate.url).toString() }
        : {}),
      tags: normalizeTags(candidate.tags),
      weight: candidate.weight ?? 3,
      enabled: candidate.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    });
    await this.store.write(
      researchRegistrySchema.parse({
        ...registry,
        sources: [...registry.sources, source],
      }),
    );
    return source;
  }

  async update(
    id: string,
    update: ResearchSourceUpdate,
  ): Promise<ResearchSource> {
    const registry = await this.store.read();
    const current = registry.sources.find((source) => source.id === id);
    if (!current) throw new Error(`Unknown research source: ${id}`);
    if (current.kind === "arxiv_query" && update.url)
      throw new Error("An arXiv source cannot be changed to a feed.");
    if (current.kind === "rss_feed" && update.query)
      throw new Error("A feed source cannot be changed to an arXiv query.");
    const updated = researchSourceSchema.parse({
      ...current,
      ...update,
      ...(update.tags ? { tags: normalizeTags(update.tags) } : {}),
      ...(update.url ? { url: new URL(update.url).toString() } : {}),
      updatedAt: this.clock().toISOString(),
    });
    await this.store.write({
      ...registry,
      sources: registry.sources.map((source) =>
        source.id === id ? updated : source,
      ),
    });
    return updated;
  }

  async setEnabled(id: string, enabled: boolean) {
    return this.update(id, { enabled });
  }
}
