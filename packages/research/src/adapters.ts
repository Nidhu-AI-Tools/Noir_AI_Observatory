import { createHash } from "node:crypto";

import {
  researchItemSchema,
  type ArxivResearchSource,
  type FeedResearchSource,
  type ResearchItem,
  type ResearchSource,
} from "@noir/core";

import { fetchXml, type ResearchFetch } from "./fetch-xml";
import {
  array,
  canonicalUrl,
  cleanText,
  scalar,
  timestamp,
  xmlParser,
} from "./xml";

export interface AdapterOptions {
  since: Date;
  now: Date;
  maxItems: number;
  fetcher?: ResearchFetch;
}

export interface ResearchAdapter {
  kind: ResearchSource["kind"];
  collect(
    source: ResearchSource,
    options: AdapterOptions,
  ): Promise<ResearchItem[]>;
}

// XML nodes vary between RSS 2.0 and Atom; access is narrowed by the helpers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Xml = Record<string, any>;

function arxivBaseId(value: string): string {
  const id = value.split("/abs/").pop() ?? value;
  return id.replace(/v\d+$/i, "");
}

export class ArxivAdapter implements ResearchAdapter {
  readonly kind = "arxiv_query" as const;
  async collect(source: ArxivResearchSource, options: AdapterOptions) {
    const parameters = new URLSearchParams({
      search_query: source.query,
      start: "0",
      max_results: String(Math.min(options.maxItems, 100)),
      sortBy: "submittedDate",
      sortOrder: "descending",
    });
    const body = await fetchXml(
      `https://export.arxiv.org/api/query?${parameters}`,
      options.fetcher ?? fetch,
    );
    const document = xmlParser.parse(body) as Xml;
    const entries = array<Xml>(document.feed?.entry);
    return entries.flatMap((entry): ResearchItem[] => {
      const publishedAt = timestamp(entry.published);
      const rawId = scalar(entry.id);
      const arxivId = arxivBaseId(rawId);
      if (!publishedAt || !arxivId || new Date(publishedAt) < options.since)
        return [];
      const links = array<Xml>(entry.link);
      const abstractUrl = canonicalUrl(
        scalar(
          links.find((link) => link["@_rel"] === "alternate")?.["@_href"],
        ) || `https://arxiv.org/abs/${arxivId}`,
      );
      const categories = array<Xml>(entry.category)
        .map((category) => scalar(category["@_term"]))
        .filter(Boolean);
      const abstractExcerpt = cleanText(entry.summary);
      const parsed = researchItemSchema.safeParse({
        schemaVersion: 1,
        id: `arxiv:${arxivId}`,
        type: "research_paper",
        provider: "arxiv",
        sourceIds: [source.id],
        title: cleanText(entry.title, 500),
        url: abstractUrl,
        publishedAt,
        collectedAt: options.now.toISOString(),
        category: source.category,
        tags: source.tags,
        ...(abstractExcerpt ? { summaryExcerpt: abstractExcerpt } : {}),
        arxivId,
        authors: array<Xml>(entry.author)
          .map((author) => cleanText(author.name, 200))
          .filter(Boolean),
        abstractExcerpt,
        primaryCategory:
          scalar(entry["arxiv:primary_category"]?.["@_term"]) ||
          categories[0] ||
          "unknown",
        categories,
        pdfUrl:
          scalar(links.find((link) => link["@_title"] === "pdf")?.["@_href"]) ||
          `https://arxiv.org/pdf/${arxivId}`,
        ...(timestamp(entry.updated)
          ? { updatedAt: timestamp(entry.updated) }
          : {}),
        ...(scalar(entry["arxiv:doi"])
          ? { doi: scalar(entry["arxiv:doi"]) }
          : {}),
      });
      return parsed.success ? [parsed.data] : [];
    });
  }
}

function feedLink(entry: Xml): string {
  const links = array<Xml | string>(entry.link);
  for (const link of links) {
    if (typeof link === "string" && link.trim()) return link.trim();
    if (typeof link === "object") {
      const href = scalar(link["@_href"]);
      if (href && (!link["@_rel"] || link["@_rel"] === "alternate"))
        return href;
      const text = scalar(link);
      if (text) return text;
    }
  }
  return "";
}

export class FeedAdapter implements ResearchAdapter {
  readonly kind = "rss_feed" as const;
  async collect(source: FeedResearchSource, options: AdapterOptions) {
    const body = await fetchXml(source.url, options.fetcher ?? fetch);
    const document = xmlParser.parse(body) as Xml;
    const entries = document.rss?.channel
      ? array<Xml>(document.rss.channel.item)
      : array<Xml>(document.feed?.entry);
    return entries
      .slice(0, options.maxItems)
      .flatMap((entry): ResearchItem[] => {
        const rawLink = feedLink(entry);
        if (!rawLink) return [];
        let url: string;
        try {
          url = canonicalUrl(new URL(rawLink, source.url).toString());
        } catch {
          return [];
        }
        if (!["http:", "https:"].includes(new URL(url).protocol)) return [];
        const actualPublishedAt =
          timestamp(entry.pubDate) ??
          timestamp(entry.published) ??
          timestamp(entry.updated) ??
          timestamp(entry["dc:date"]);
        const publishedAt = actualPublishedAt ?? options.now.toISOString();
        if (new Date(publishedAt) < options.since) return [];
        const externalId = scalar(entry.guid) || scalar(entry.id) || url;
        const digest = createHash("sha256")
          .update(url || externalId)
          .digest("hex")
          .slice(0, 32);
        const summary = cleanText(
          entry.description ??
            entry.summary ??
            entry.content ??
            entry["content:encoded"],
        );
        const authorValues = array<Xml | string>(
          entry.author ?? entry["dc:creator"],
        )
          .map((author) =>
            cleanText(
              typeof author === "object" ? (author.name ?? author) : author,
              200,
            ),
          )
          .filter(Boolean);
        const parsed = researchItemSchema.safeParse({
          schemaVersion: 1,
          id: `announcement:${digest}`,
          type: "official_announcement",
          provider: "rss",
          sourceIds: [source.id],
          title: cleanText(entry.title, 500),
          url,
          publishedAt,
          collectedAt: options.now.toISOString(),
          category: source.category,
          tags: source.tags,
          ...(summary ? { summaryExcerpt: summary } : {}),
          publisher: source.publisher,
          externalId: externalId.slice(0, 1_000),
          ...(authorValues.length ? { authors: authorValues } : {}),
          ...(!actualPublishedAt ? { publishedAtInferred: true } : {}),
        });
        return parsed.success ? [parsed.data] : [];
      });
  }
}

export class ResearchAdapterRegistry {
  private readonly adapters = new Map<
    ResearchSource["kind"],
    ResearchAdapter
  >();
  constructor(
    adapters: ResearchAdapter[] = [new ArxivAdapter(), new FeedAdapter()],
  ) {
    for (const adapter of adapters) this.adapters.set(adapter.kind, adapter);
  }
  get(kind: ResearchSource["kind"]): ResearchAdapter {
    const adapter = this.adapters.get(kind);
    if (!adapter) throw new Error(`No research adapter for ${kind}.`);
    return adapter;
  }
}
