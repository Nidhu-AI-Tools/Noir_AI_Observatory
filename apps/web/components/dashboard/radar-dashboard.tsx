"use client";

import type { RadarDashboardData } from "@noir/dashboard-data";
import { useEffect, useMemo, useState } from "react";

import { useGeneratedData } from "../../hooks/use-generated-data";
import {
  defaultRadarUrlState,
  parseRadarUrl,
  radarPath,
  type RadarConfigurationStatus,
  type RadarKind,
  type RadarPeriod,
  type RadarUrlState,
} from "../../lib/radar-url";
import { EmptyState } from "../empty-state";
import { FilterSelect } from "./filter-select";
import { GeneratedDataState } from "./generated-data-state";
import { MetricCard } from "./metric-card";
import { RadarSourceCard } from "./radar-source-card";

export function RadarDashboard() {
  const { data, error, loading, retry } = useGeneratedData<RadarDashboardData>(
    "/generated/radar.json",
  );
  const [filters, setFilters] = useState<RadarUrlState>(defaultRadarUrlState);
  const [urlReady, setUrlReady] = useState(false);

  useEffect(() => {
    const readUrl = () => setFilters(parseRadarUrl(window.location.search));
    queueMicrotask(() => {
      readUrl();
      setUrlReady(true);
    });
    window.addEventListener("popstate", readUrl);
    return () => window.removeEventListener("popstate", readUrl);
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    window.history.replaceState(
      null,
      "",
      radarPath(filters, window.location.pathname),
    );
  }, [filters, urlReady]);

  const sources = useMemo(() => {
    if (!data) return [];
    const normalized = filters.query.trim().toLowerCase();
    return data.sources.filter((source) => {
      const matchesQuery =
        !normalized ||
        [
          source.id,
          source.displayName,
          source.locator,
          source.description ?? "",
          source.category.id,
          source.category.name,
          ...source.tags,
        ].some((value) => value.toLowerCase().includes(normalized));
      const matchesKind =
        filters.kind === "all" || source.kind === filters.kind;
      const matchesCategory =
        filters.category === "all" || source.category.id === filters.category;
      const matchesTag =
        filters.tag === "all" || source.tags.includes(filters.tag);
      const matchesStatus =
        filters.status === "all" ||
        (filters.status === "enabled" ? source.enabled : !source.enabled);
      const matchesSource = !filters.sourceId || source.id === filters.sourceId;
      const matchesPeriod =
        filters.period === "all" ||
        (filters.period === "24h" && source.activity.last24Hours > 0) ||
        (filters.period === "7d" && source.activity.last7Days > 0) ||
        (filters.period === "30d" && source.activity.last30Days > 0) ||
        (filters.period === "none" && source.activity.total === 0);
      return (
        matchesQuery &&
        matchesKind &&
        matchesCategory &&
        matchesTag &&
        matchesStatus &&
        matchesSource &&
        matchesPeriod
      );
    });
  }, [data, filters]);

  const update = <Key extends keyof RadarUrlState>(
    key: Key,
    value: RadarUrlState[Key],
  ) => setFilters((current) => ({ ...current, [key]: value }));

  if (!data)
    return (
      <GeneratedDataState error={error} loading={loading} onRetry={retry} />
    );

  const selectedSource = filters.sourceId
    ? data.sources.find((source) => source.id === filters.sourceId)
    : undefined;
  const filtered = Object.values(filters).some(
    (value) => value !== "" && value !== "all",
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
          label="Active this week"
          value={data.summary.activeLast7Days}
        />
        <MetricCard label="Categories" value={data.summary.categories} />
      </section>

      <section className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-2 xl:grid-cols-6">
        <label>
          <span className="sr-only">Search radar</span>
          <input
            className="w-full rounded-lg border border-[var(--border)] bg-[#0c1015] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400"
            onChange={(event) => update("query", event.target.value)}
            placeholder="Search source or tag"
            type="search"
            value={filters.query}
          />
        </label>
        <FilterSelect
          label="Source type"
          onChange={(value) => update("kind", value as RadarKind)}
          value={filters.kind}
        >
          <option value="all">All source types</option>
          <option value="github_repo">GitHub repositories</option>
          <option value="huggingface_org">Hugging Face organizations</option>
        </FilterSelect>
        <FilterSelect
          label="Category"
          onChange={(value) => update("category", value)}
          value={filters.category}
        >
          <option value="all">All categories</option>
          {data.filters.categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Tag"
          onChange={(value) => update("tag", value)}
          value={filters.tag}
        >
          <option value="all">All tags</option>
          {data.filters.tags.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Activity period"
          onChange={(value) => update("period", value as RadarPeriod)}
          value={filters.period}
        >
          <option value="all">Any activity</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="none">No observations</option>
        </FilterSelect>
        <FilterSelect
          label="Configuration status"
          onChange={(value) =>
            update("status", value as RadarConfigurationStatus)
          }
          value={filters.status}
        >
          <option value="all">Enabled and disabled</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </FilterSelect>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
        <p>
          {sources.length} of {data.sources.length} sources
          {selectedSource ? ` · focused on ${selectedSource.displayName}` : ""}
          {!selectedSource && filters.sourceId
            ? ` · unknown source ${filters.sourceId}`
            : ""}
        </p>
        {filtered ? (
          <button
            className="font-medium text-violet-300 hover:text-violet-200"
            onClick={() => setFilters(defaultRadarUrlState)}
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
            <RadarSourceCard
              focused={source.id === filters.sourceId}
              key={`${source.id}:${source.id === filters.sourceId}`}
              onSelectTag={(tag) =>
                setFilters((current) => ({
                  ...current,
                  tag,
                  sourceId: "",
                }))
              }
              source={source}
            />
          ))}
        </section>
      )}

      <p className="rounded-lg border border-[var(--border)] bg-black/15 px-4 py-3 text-sm text-[var(--muted)]">
        Radar manages GitHub repository and Hugging Face organization tracking.
        Research feeds and API monitors are managed from their own dashboards.
      </p>
    </div>
  );
}
