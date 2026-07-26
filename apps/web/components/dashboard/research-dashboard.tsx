"use client";

import type {
  DashboardResearchItem,
  ResearchDashboardData,
} from "@noir/dashboard-data";
import { useEffect, useMemo, useState } from "react";

import { useGeneratedData } from "../../hooks/use-generated-data";
import { formatDateTime } from "../../lib/dashboard-format";
import { EmptyState } from "../empty-state";
import { FilterSelect } from "./filter-select";
import { GeneratedDataState } from "./generated-data-state";
import { MetricCard } from "./metric-card";
import { StatusBadge } from "./status-badge";

const repositoryUrl =
  process.env.NEXT_PUBLIC_REPOSITORY_URL ??
  "https://github.com/Nidhu-AI-Tools/Noir_AI_Observatory";

export function ResearchDashboard() {
  const { data, error, loading, retry } =
    useGeneratedData<ResearchDashboardData>("/generated/research/index.json");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [source, setSource] = useState("all");
  const [tag, setTag] = useState("all");
  const [category, setCategory] = useState("all");
  const [arxivCategory, setArxivCategory] = useState("all");
  const [urlReady, setUrlReady] = useState(false);

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    queueMicrotask(() => {
      setQuery(parameters.get("q") ?? "");
      setType(parameters.get("type") ?? "all");
      setSource(parameters.get("source") ?? "all");
      setTag(parameters.get("tag") ?? "all");
      setCategory(parameters.get("category") ?? "all");
      setArxivCategory(parameters.get("arxiv") ?? "all");
      setUrlReady(true);
    });
  }, []);
  useEffect(() => {
    if (!urlReady) return;
    const parameters = new URLSearchParams();
    if (query) parameters.set("q", query);
    if (type !== "all") parameters.set("type", type);
    if (source !== "all") parameters.set("source", source);
    if (tag !== "all") parameters.set("tag", tag);
    if (category !== "all") parameters.set("category", category);
    if (arxivCategory !== "all") parameters.set("arxiv", arxivCategory);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${parameters.size ? `?${parameters}` : ""}`,
    );
  }, [arxivCategory, category, query, source, tag, type, urlReady]);

  const items = useMemo(
    () =>
      data?.items.filter((item) => {
        const text = query.trim().toLowerCase();
        return (
          (!text ||
            [
              item.title,
              item.summaryExcerpt ?? "",
              ...item.tags,
              ...item.sourceNames,
              ...(item.type === "research_paper"
                ? item.authors
                : [item.publisher]),
            ].some((value) => value.toLowerCase().includes(text))) &&
          (type === "all" || item.type === type) &&
          (source === "all" || item.sourceIds.includes(source)) &&
          (tag === "all" || item.tags.includes(tag)) &&
          (category === "all" || item.category === category) &&
          (arxivCategory === "all" ||
            (item.type === "research_paper" &&
              item.categories.includes(arxivCategory)))
        );
      }) ?? [],
    [arxivCategory, category, data, query, source, tag, type],
  );

  if (!data)
    return (
      <GeneratedDataState error={error} loading={loading} onRetry={retry} />
    );
  return (
    <div className="space-y-6">
      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Research statistics"
      >
        <MetricCard label="Papers today" value={data.summary.papersToday} />
        <MetricCard label="Papers · 7 days" value={data.summary.papers7Days} />
        <MetricCard
          label="Announcements · 7 days"
          value={data.summary.announcements7Days}
        />
        <MetricCard label="Active sources" value={data.summary.activeSources} />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {data.latestRun ? (
          <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
            <StatusBadge
              label={`Latest run: ${data.latestRun.status}`}
              tone={data.latestRun.status}
            />
            <span>{formatDateTime(data.latestRun.finishedAt)}</span>
          </div>
        ) : (
          <span />
        )}
        <a
          className="rounded-lg bg-violet-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-violet-200"
          href={`${repositoryUrl}/issues/new?template=add-research-source.yml`}
          rel="noreferrer"
          target="_blank"
        >
          Add research source
        </a>
      </div>

      <section className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-2 xl:grid-cols-6">
        <label>
          <span className="sr-only">Search research</span>
          <input
            className="w-full rounded-lg border border-[var(--border)] bg-[#0c1015] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, author, publisher, or tag"
            type="search"
            value={query}
          />
        </label>
        <FilterSelect label="Content type" onChange={setType} value={type}>
          <option value="all">All content</option>
          <option value="research_paper">Research papers</option>
          <option value="official_announcement">Announcements</option>
        </FilterSelect>
        <FilterSelect
          label="Tracked source"
          onChange={setSource}
          value={source}
        >
          <option value="all">All sources</option>
          {data.filters.sources.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Tag" onChange={setTag} value={tag}>
          <option value="all">All tags</option>
          {data.filters.tags.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Category" onChange={setCategory} value={category}>
          <option value="all">All categories</option>
          {data.filters.categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="arXiv category"
          onChange={setArxivCategory}
          value={arxivCategory}
        >
          <option value="all">All arXiv categories</option>
          {data.filters.arxivCategories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </FilterSelect>
      </section>

      {items.length === 0 ? (
        <EmptyState
          title={
            data.items.length
              ? "No research matches"
              : "No research indexed yet"
          }
          description={
            data.items.length
              ? "Try clearing one or more filters."
              : "Add an arXiv query or official RSS/Atom feed, then run the research collector."
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <ResearchCard item={item} key={item.id} />
          ))}
        </div>
      )}

      {data.trends.tags.length > 0 ||
      data.trends.arxivCategories.length > 0 ||
      data.trends.publishers.length > 0 ? (
        <section className="grid gap-4 lg:grid-cols-3">
          <TrendList title="Frequent tags · 7 days" values={data.trends.tags} />
          <TrendList
            title="arXiv categories · 7 days"
            values={data.trends.arxivCategories}
          />
          <TrendList
            title="Publishers · 7 days"
            values={data.trends.publishers}
          />
        </section>
      ) : null}

      {data.sources.length > 0 ? (
        <section>
          <div className="mb-4 border-b border-[var(--border)] pb-3">
            <h2 className="text-xl font-semibold text-white">
              Tracked research sources
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Review immutable IDs and request changes to queries, categories,
              tags, weights, or status.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {data.sources.map((tracked) => (
              <article
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                key={tracked.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-white">
                      {tracked.displayName}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">{tracked.id}</p>
                  </div>
                  <StatusBadge
                    label={tracked.enabled ? "Enabled" : "Disabled"}
                    tone={tracked.enabled ? "success" : "neutral"}
                  />
                </div>
                <p className="mt-3 text-sm break-all text-[var(--muted)]">
                  {tracked.kind} · {tracked.locator}
                </p>
                <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-500">
                    {tracked.category} · weight {tracked.weight}
                  </span>
                  <a
                    className="text-violet-300 hover:text-violet-200"
                    href={`${repositoryUrl}/issues/new?template=edit-research-source.yml&title=${encodeURIComponent(`[Research Edit] ${tracked.id}`)}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Request edit
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function ResearchCard({
  item,
  compact = false,
}: {
  item: DashboardResearchItem;
  compact?: boolean;
}) {
  const authors =
    item.type === "research_paper" ? item.authors.join(", ") : item.publisher;
  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-violet-300">
            {item.type === "research_paper"
              ? `Paper · ${item.primaryCategory}`
              : `Announcement · ${item.publisher}`}
          </p>
          <a
            className="mt-2 block text-lg leading-6 font-semibold text-white hover:text-violet-200"
            href={item.url}
            rel="noreferrer"
            target="_blank"
          >
            {item.title}
          </a>
        </div>
        <span
          className="shrink-0 rounded-full border border-violet-400/20 bg-violet-400/5 px-2.5 py-1 text-xs text-violet-200"
          title={item.matchReasons.join(" · ")}
        >
          Match {item.matchScore}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">{authors}</p>
      {!compact && item.summaryExcerpt ? (
        <p className="mt-4 line-clamp-4 text-sm leading-6 text-slate-300">
          {item.summaryExcerpt}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {item.tags.map((value) => (
          <span
            className="rounded-md bg-white/5 px-2 py-1 text-xs text-slate-400"
            key={value}
          >
            {value}
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4 text-xs text-slate-500">
        <time dateTime={item.publishedAt}>
          {formatDateTime(item.publishedAt)}
        </time>
        <span title={item.matchReasons.join(" · ")}>
          Why: {item.sourceNames.join(", ")}
        </span>
        {item.type === "research_paper" ? (
          <a
            className="text-violet-300 hover:text-violet-200"
            href={item.pdfUrl}
            rel="noreferrer"
            target="_blank"
          >
            PDF
          </a>
        ) : null}
        <a
          className="text-violet-300 hover:text-violet-200"
          href={`${repositoryUrl}/issues/new?template=edit-research-source.yml&title=${encodeURIComponent(`[Research Edit] ${item.sourceIds[0] ?? ""}`)}`}
          rel="noreferrer"
          target="_blank"
        >
          Request source edit
        </a>
      </div>
    </article>
  );
}

function TrendList({
  title,
  values,
}: {
  title: string;
  values: { name: string; count: number }[];
}) {
  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-medium text-white">{title}</h2>
      <ol className="mt-4 space-y-2">
        {values.slice(0, 6).map((item) => (
          <li className="flex justify-between gap-3 text-sm" key={item.name}>
            <span className="text-[var(--muted)]">{item.name}</span>
            <span className="text-white">{item.count}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}
