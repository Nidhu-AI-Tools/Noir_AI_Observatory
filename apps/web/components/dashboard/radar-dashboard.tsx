"use client";

import type {
  HealthIndexData,
  RadarActivityStatus,
  RadarDashboardData,
} from "@noir/dashboard-data";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useGeneratedData } from "../../hooks/use-generated-data";
import { formatDateTime, sourceKindLabel } from "../../lib/dashboard-format";
import { EmptyState } from "../empty-state";
import { FilterSelect } from "./filter-select";
import { GeneratedDataState } from "./generated-data-state";
import { MetricCard } from "./metric-card";
import { StatusBadge } from "./status-badge";

const statusLabels: Record<RadarActivityStatus, string> = {
  today: "Active today",
  "this-week": "Active this week",
  "this-month": "Active this month",
  earlier: "Earlier activity",
  none: "No activity yet",
  disabled: "Disabled",
};

export function RadarDashboard() {
  const { data, error, loading, retry } = useGeneratedData<RadarDashboardData>(
    "/generated/radar.json",
  );
  const { data: health } = useGeneratedData<HealthIndexData>(
    "/generated/health/index.json",
  );
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [category, setCategory] = useState("all");
  const [tag, setTag] = useState("all");
  const [period, setPeriod] = useState("all");
  const [sourceId, setSourceId] = useState("");
  const [urlReady, setUrlReady] = useState(false);

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    queueMicrotask(() => {
      setQuery(parameters.get("q") ?? "");
      setKind(parameters.get("kind") ?? "all");
      setCategory(parameters.get("category") ?? "all");
      setTag(parameters.get("tag") ?? "all");
      setPeriod(parameters.get("period") ?? "all");
      setSourceId(parameters.get("source") ?? "");
      setUrlReady(true);
    });
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const parameters = new URLSearchParams();
    if (query) parameters.set("q", query);
    if (kind !== "all") parameters.set("kind", kind);
    if (category !== "all") parameters.set("category", category);
    if (tag !== "all") parameters.set("tag", tag);
    if (period !== "all") parameters.set("period", period);
    if (sourceId) parameters.set("source", sourceId);
    const search = parameters.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}`,
    );
  }, [category, kind, period, query, sourceId, tag, urlReady]);

  const sources = useMemo(() => {
    if (!data) return [];
    const normalized = query.trim().toLowerCase();
    return data.sources.filter((source) => {
      const matchesQuery =
        !normalized ||
        [
          source.displayName,
          source.locator,
          source.description ?? "",
          ...source.tags,
        ].some((value) => value.toLowerCase().includes(normalized));
      const matchesKind = kind === "all" || source.kind === kind;
      const matchesCategory =
        category === "all" || source.category.id === category;
      const matchesTag = tag === "all" || source.tags.includes(tag);
      const matchesSource = !sourceId || source.id === sourceId;
      const matchesPeriod =
        period === "all" ||
        (period === "24h" && source.activity.last24Hours > 0) ||
        (period === "7d" && source.activity.last7Days > 0) ||
        (period === "30d" && source.activity.last30Days > 0) ||
        (period === "none" && source.activity.total === 0);
      return (
        matchesQuery &&
        matchesKind &&
        matchesCategory &&
        matchesTag &&
        matchesSource &&
        matchesPeriod
      );
    });
  }, [category, data, kind, period, query, sourceId, tag]);

  const clearFilters = () => {
    setQuery("");
    setKind("all");
    setCategory("all");
    setTag("all");
    setPeriod("all");
    setSourceId("");
  };

  if (!data)
    return (
      <GeneratedDataState error={error} loading={loading} onRetry={retry} />
    );

  const selectedSource = sourceId
    ? data.sources.find((source) => source.id === sourceId)
    : undefined;
  const healthBySource = new Map(
    health?.monitors
      .filter((monitor) => monitor.linkedSourceId)
      .map((monitor) => [monitor.linkedSourceId as string, monitor]),
  );

  return (
    <div className="space-y-6">
      <section
        aria-label="Radar statistics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard label="Tracked sources" value={data.summary.tracked} />
        <MetricCard label="Enabled" value={data.summary.enabled} />
        <MetricCard
          label="With observations"
          value={data.summary.withActivity}
        />
        <MetricCard
          label="Active this week"
          value={data.summary.activeLast7Days}
        />
      </section>

      <section className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-2 xl:grid-cols-5">
        <label>
          <span className="sr-only">Search radar</span>
          <input
            className="w-full rounded-lg border border-[var(--border)] bg-[#0c1015] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search source or tag"
            type="search"
            value={query}
          />
        </label>
        <FilterSelect label="Source type" onChange={setKind} value={kind}>
          <option value="all">All source types</option>
          <option value="github_repo">GitHub repositories</option>
          <option value="huggingface_org">Hugging Face organizations</option>
        </FilterSelect>
        <FilterSelect label="Category" onChange={setCategory} value={category}>
          <option value="all">All categories</option>
          {data.filters.categories.map((item) => (
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
        <FilterSelect
          label="Activity period"
          onChange={setPeriod}
          value={period}
        >
          <option value="all">Any activity</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="none">No observations</option>
        </FilterSelect>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
        <p>
          {sources.length} of {data.sources.length} sources
          {selectedSource ? ` · focused on ${selectedSource.displayName}` : ""}
        </p>
        {query ||
        kind !== "all" ||
        category !== "all" ||
        tag !== "all" ||
        period !== "all" ||
        sourceId ? (
          <button
            className="font-medium text-violet-300 hover:text-violet-200"
            onClick={clearFilters}
            type="button"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {sources.length === 0 ? (
        <EmptyState
          description="Try clearing one or more filters, or add another source to the registry."
          title="No radar sources match"
        />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {sources.map((source) => (
            <article
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6"
              key={source.id}
            >
              {healthBySource.get(source.id) ? (
                <div className="mb-4 flex items-center justify-between rounded-lg border border-[var(--border)] bg-black/15 px-3 py-2 text-xs">
                  <span className="text-[var(--muted)]">Linked API</span>
                  <Link
                    className="font-medium text-violet-300 hover:text-violet-200"
                    href={`/health/?monitor=${healthBySource.get(source.id)?.id}`}
                  >
                    {healthBySource.get(source.id)?.displayName} ·{" "}
                    {healthBySource.get(source.id)?.status}
                  </Link>
                </div>
              ) : null}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-violet-300">
                    {sourceKindLabel(source.kind)} · {source.category.name}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-white">
                    <a
                      className="hover:text-violet-200"
                      href={source.externalUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {source.displayName}
                    </a>
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {source.locator}
                  </p>
                </div>
                <StatusBadge
                  label={statusLabels[source.activity.status]}
                  tone={
                    source.activity.status === "today" ||
                    source.activity.status === "this-week"
                      ? "success"
                      : source.activity.status === "disabled"
                        ? "neutral"
                        : "active"
                  }
                />
              </div>
              {source.description ? (
                <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                  {source.description}
                </p>
              ) : null}
              <dl className="mt-5 grid grid-cols-4 gap-3 border-y border-[var(--border)] py-4 text-center">
                {[
                  ["24h", source.activity.last24Hours],
                  ["7d", source.activity.last7Days],
                  ["30d", source.activity.last30Days],
                  ["All", source.activity.total],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-slate-500">{label}</dt>
                    <dd className="mt-1 font-semibold text-white">{value}</dd>
                  </div>
                ))}
              </dl>
              {source.latestObservation ? (
                <div className="mt-4">
                  <p className="text-xs text-slate-500">Latest observation</p>
                  <a
                    className="mt-1 block text-sm font-medium text-white hover:text-violet-200"
                    href={source.latestObservation.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {source.latestObservation.title}
                  </a>
                  <time
                    className="mt-1 block text-xs text-[var(--muted)]"
                    dateTime={source.latestObservation.occurredAt}
                    title={source.latestObservation.occurredAt}
                  >
                    {formatDateTime(source.latestObservation.occurredAt)}
                  </time>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  No observations collected for this source yet.
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                {source.tags.map((item) => (
                  <button
                    className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-slate-400 hover:border-violet-400/40 hover:text-violet-200"
                    key={item}
                    onClick={() => {
                      setTag(item);
                      setSourceId("");
                    }}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="mt-5 border-t border-[var(--border)] pt-4 text-right">
                <Link
                  className="text-sm font-medium text-violet-300 hover:text-violet-200"
                  href={`/sources/?source=${source.id}`}
                >
                  Source settings
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
