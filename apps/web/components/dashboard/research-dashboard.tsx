"use client";

import type {
  DashboardResearchItem,
  ResearchCoverageEntry,
  ResearchIndexData,
} from "@noir/dashboard-data";
import { useEffect, useRef, useState } from "react";

import { useGeneratedData } from "../../hooks/use-generated-data";
import { useResearchResults } from "../../hooks/use-research-results";
import { formatDateTime } from "../../lib/dashboard-format";
import { deriveRunDisplayStatus } from "../../lib/run-status";
import {
  defaultResearchUrlState,
  parseResearchUrl,
  researchPath,
  resetResearchPage,
  type ResearchSort,
  type ResearchType,
  type ResearchUrlState,
  type ResearchWindow,
} from "../../lib/research-url";
import { EmptyState } from "../empty-state";
import { FilterSelect } from "./filter-select";
import { GeneratedDataState } from "./generated-data-state";
import { MetricCard } from "./metric-card";
import { StatusBadge } from "./status-badge";

const repositoryUrl =
  process.env.NEXT_PUBLIC_REPOSITORY_URL ??
  "https://github.com/Nidhu-AI-Tools/Noir_AI_Observatory";

export function ResearchDashboard() {
  const { data, error, loading, retry } = useGeneratedData<ResearchIndexData>(
    "/generated/research/index.json",
  );
  const [filters, setFilters] = useState<ResearchUrlState>(
    defaultResearchUrlState,
  );
  const [urlReady, setUrlReady] = useState(false);
  const results = useResearchResults(data, filters);
  const resultsHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const read = () => setFilters(parseResearchUrl(window.location.search));
    queueMicrotask(() => {
      const initial = parseResearchUrl(window.location.search);
      setFilters(initial);
      window.history.replaceState(
        null,
        "",
        researchPath(initial, window.location.pathname),
      );
      setUrlReady(true);
    });
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  useEffect(() => {
    if (!urlReady || results.loading || results.page === filters.page) return;
    const corrected = { ...filters, page: results.page };
    queueMicrotask(() => {
      setFilters(corrected);
      window.history.replaceState(
        null,
        "",
        researchPath(corrected, window.location.pathname),
      );
    });
  }, [filters, results.loading, results.page, urlReady]);

  const commit = (
    next: ResearchUrlState,
    history: "push" | "replace" = "push",
  ) => {
    setFilters(next);
    if (!urlReady) return;
    window.history[history === "push" ? "pushState" : "replaceState"](
      null,
      "",
      researchPath(next, window.location.pathname),
    );
  };

  const update = (
    values: Partial<Omit<ResearchUrlState, "page">>,
    history: "push" | "replace" = "push",
  ) => commit(resetResearchPage(filters, values), history);
  const changePage = (page: number) => {
    commit({ ...filters, page });
    queueMicrotask(() => resultsHeading.current?.focus());
  };

  if (!data)
    return (
      <GeneratedDataState error={error} loading={loading} onRetry={retry} />
    );

  const selectedCoverage = [
    filters.organization !== "all"
      ? data.facets.organizations.find(
          (value) => value.id === filters.organization,
        )
      : undefined,
    filters.venue !== "all"
      ? data.facets.venues.find((value) => value.id === filters.venue)
      : undefined,
    filters.topic !== "all"
      ? data.facets.topics.find((value) => value.id === filters.topic)
      : undefined,
  ].filter((value): value is ResearchCoverageEntry => Boolean(value));
  const invalidDateRange =
    Boolean(filters.from && filters.to) && filters.from > filters.to;
  const latestRunStatus = data.latestRun
    ? deriveRunDisplayStatus(
        data.latestRun.status,
        data.latestRun.finishedAt,
        data.generatedAt,
      )
    : undefined;

  return (
    <div className="space-y-6">
      <section
        aria-label="Research statistics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard label="Tracked records" value={data.summary.total} />
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
              label={latestRunStatus!.label}
              tone={latestRunStatus!.tone}
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

      <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label>
            <span className="sr-only">Search research</span>
            <input
              className="w-full rounded-lg border border-[var(--border)] bg-[#0c1015] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400"
              onChange={(event) =>
                update({ query: event.target.value }, "replace")
              }
              placeholder="Search papers, authors, labs, or topics"
              type="search"
              value={filters.query}
            />
          </label>
          <FacetSelect
            label="Organization"
            onChange={(organization) => update({ organization })}
            values={data.facets.organizations}
            value={filters.organization}
          />
          <FacetSelect
            label="Venue"
            onChange={(venue) => update({ venue })}
            values={data.facets.venues}
            value={filters.venue}
          />
          <FacetSelect
            label="Topic"
            onChange={(topic) => update({ topic })}
            values={data.facets.topics}
            value={filters.topic}
          />
          <FilterSelect
            label="Content type"
            onChange={(type) => update({ type: type as ResearchType })}
            value={filters.type}
          >
            <option value="all">All content</option>
            <option value="research_paper">Research papers</option>
            <option value="official_announcement">Announcements</option>
          </FilterSelect>
        </div>

        <details>
          <summary className="cursor-pointer text-sm font-medium text-violet-300 hover:text-violet-200">
            More filters
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FilterSelect
              label="Tracked source"
              onChange={(source) => update({ source })}
              value={filters.source}
            >
              <option value="all">All sources</option>
              {data.facets.sources.map((value) => (
                <option key={value.id} value={value.id}>
                  {value.name} ({value.count})
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Tag"
              onChange={(tag) => update({ tag })}
              value={filters.tag}
            >
              <option value="all">All tags</option>
              {data.facets.tags.map((value) => (
                <option key={value.id} value={value.id}>
                  {value.name} ({value.count})
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="arXiv category"
              onChange={(arxiv) => update({ arxiv })}
              value={filters.arxiv}
            >
              <option value="all">All arXiv categories</option>
              {data.facets.arxivCategories.map((value) => (
                <option key={value.id} value={value.id}>
                  {value.name} ({value.count})
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Recent window"
              onChange={(window) =>
                update({ window: window as ResearchWindow })
              }
              value={filters.window}
            >
              <option value="all">Any date</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </FilterSelect>
            <label className="text-xs text-slate-400">
              From date
              <input
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[#0c1015] px-3 py-2 text-sm text-white"
                onChange={(event) => update({ from: event.target.value })}
                type="date"
                value={filters.from}
              />
            </label>
            <label className="text-xs text-slate-400">
              To date
              <input
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[#0c1015] px-3 py-2 text-sm text-white"
                onChange={(event) => update({ to: event.target.value })}
                type="date"
                value={filters.to}
              />
            </label>
          </div>
        </details>
      </section>

      {selectedCoverage
        .filter((coverage) => coverage.status !== "available")
        .map((coverage) => (
          <div
            className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-100"
            key={coverage.id}
          >
            <strong>{coverage.name}</strong> coverage is{" "}
            {coverage.status === "not-configured"
              ? "not configured"
              : "configured but currently empty"}
            . The Observatory is not claiming that no publications exist.
          </div>
        ))}
      {invalidDateRange ? (
        <div className="rounded-lg border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-100">
          The start date must not be later than the end date.
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            className="text-xl font-semibold text-white outline-none"
            ref={resultsHeading}
            tabIndex={-1}
          >
            Research results
          </h2>
          <p aria-live="polite" className="mt-1 text-sm text-[var(--muted)]">
            {results.loading
              ? "Loading results…"
              : `${results.total} results · page ${results.page} of ${Math.max(1, results.pageCount)}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <FilterSelect
            label="Sort results"
            onChange={(sort) => update({ sort: sort as ResearchSort })}
            value={
              filters.sort === "relevance" && !filters.query
                ? "newest"
                : filters.sort
            }
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option disabled={!filters.query} value="relevance">
              Search relevance
            </option>
          </FilterSelect>
          <button
            className="text-sm font-medium text-violet-300 hover:text-violet-200"
            onClick={() => commit(defaultResearchUrlState)}
            type="button"
          >
            Clear
          </button>
        </div>
      </div>

      {results.error ? (
        <GeneratedDataState
          error={results.error}
          loading={false}
          onRetry={results.retry}
        />
      ) : !results.loading && results.items.length === 0 ? (
        <EmptyState
          description="Try clearing one or more filters. If a selected facet is not configured, add an authoritative research source first."
          title="No research matches"
        />
      ) : (
        <div
          aria-busy={results.loading}
          className={`grid gap-4 lg:grid-cols-2 ${results.loading ? "opacity-60" : ""}`}
        >
          {results.items.map((item) => (
            <ResearchCard item={item} key={item.id} />
          ))}
        </div>
      )}

      <ResearchPagination
        current={results.page}
        onChange={changePage}
        pages={results.pageCount}
      />

      <ResearchSourceManagement index={data} />
    </div>
  );
}

function FacetSelect({
  label,
  onChange,
  value,
  values,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
  values: ResearchCoverageEntry[];
}) {
  return (
    <FilterSelect label={label} onChange={onChange} value={value}>
      <option value="all">All {label.toLowerCase()}s</option>
      {values.map((facet) => (
        <option key={facet.id} value={facet.id}>
          {facet.name} ({facet.count})
          {facet.status === "not-configured" ? " · not configured" : ""}
        </option>
      ))}
    </FilterSelect>
  );
}

export function ResearchCard({
  compact = false,
  item,
}: {
  compact?: boolean;
  item: DashboardResearchItem;
}) {
  const authors =
    item.type === "research_paper" ? item.authors.join(", ") : item.publisher;
  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
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
      <p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">{authors}</p>
      {!compact && item.summaryExcerpt ? (
        <p className="mt-4 line-clamp-4 text-sm leading-6 text-slate-300">
          {item.summaryExcerpt}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          ...item.facets.organizations,
          ...item.facets.venues,
          ...item.facets.topics,
        ].map((facet) => (
          <span
            className="rounded-md border border-violet-400/20 bg-violet-400/5 px-2 py-1 text-xs text-violet-200"
            key={`${facet.id}:${facet.name}`}
            title={facet.evidence
              .map((evidence) =>
                evidence.kind === "source-configuration"
                  ? `Configured by ${evidence.sourceId}`
                  : evidence.kind === "provider-metadata"
                    ? `${evidence.provider} ${evidence.field}: ${evidence.value}`
                    : `Mapped from ${evidence.input}`,
              )
              .join(" · ")}
          >
            {facet.name}
          </span>
        ))}
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
        <span>Tracked via {item.sourceNames.join(", ")}</span>
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
      </div>
    </article>
  );
}

function ResearchPagination({
  current,
  onChange,
  pages,
}: {
  current: number;
  onChange: (page: number) => void;
  pages: number;
}) {
  if (pages <= 1) return null;
  const values = [...new Set([1, current - 1, current, current + 1, pages])]
    .filter((page) => page >= 1 && page <= pages)
    .sort((a, b) => a - b);
  return (
    <nav
      aria-label="Research pagination"
      className="flex flex-wrap justify-center gap-2"
    >
      <button
        className="rounded-md border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-40"
        disabled={current === 1}
        onClick={() => onChange(current - 1)}
        type="button"
      >
        Previous
      </button>
      {values.map((page, index) => (
        <span className="contents" key={page}>
          {index > 0 && page - values[index - 1]! > 1 ? (
            <span className="px-1 py-2 text-slate-500">…</span>
          ) : null}
          <button
            aria-current={page === current ? "page" : undefined}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm aria-[current=page]:border-violet-400/50 aria-[current=page]:bg-violet-400/10 aria-[current=page]:text-violet-200"
            onClick={() => onChange(page)}
            type="button"
          >
            {page}
          </button>
        </span>
      ))}
      <button
        className="rounded-md border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-40"
        disabled={current === pages}
        onClick={() => onChange(current + 1)}
        type="button"
      >
        Next
      </button>
    </nav>
  );
}

function ResearchSourceManagement({ index }: { index: ResearchIndexData }) {
  if (!index.sources.length) return null;
  return (
    <details className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <summary className="cursor-pointer text-lg font-semibold text-white">
        Manage tracked research sources
      </summary>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {index.sources.map((source) => (
          <article
            className="rounded-lg border border-[var(--border)] bg-black/15 p-4"
            key={source.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-medium text-white">{source.displayName}</h3>
                <code className="mt-1 block text-xs text-slate-500">
                  {source.id}
                </code>
              </div>
              <StatusBadge
                label={source.enabled ? "Enabled" : "Disabled"}
                tone={source.enabled ? "success" : "neutral"}
              />
            </div>
            <p className="mt-3 text-sm break-all text-[var(--muted)]">
              {source.kind} · {source.locator}
            </p>
            {source.coverageDescription ? (
              <p className="mt-2 text-xs text-slate-400">
                {source.coverageDescription}
              </p>
            ) : null}
            <div className="mt-4 flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-500">
                {source.category} · weight {source.weight}
              </span>
              <a
                className="text-violet-300 hover:text-violet-200"
                href={`${repositoryUrl}/issues/new?template=edit-research-source.yml&title=${encodeURIComponent(`[Research Edit] ${source.id}`)}`}
                rel="noreferrer"
                target="_blank"
              >
                Request edit
              </a>
            </div>
          </article>
        ))}
      </div>
    </details>
  );
}
