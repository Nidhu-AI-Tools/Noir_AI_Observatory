"use client";

import type {
  RadarDashboardData,
  SourceDashboardData,
} from "@noir/dashboard-data";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { FilterSelect } from "../../components/dashboard/filter-select";
import { GeneratedDataState } from "../../components/dashboard/generated-data-state";
import { MetricCard } from "../../components/dashboard/metric-card";
import { StatusBadge } from "../../components/dashboard/status-badge";
import { EmptyState } from "../../components/empty-state";
import { PageHeading } from "../../components/page-heading";
import { useGeneratedData } from "../../hooks/use-generated-data";
import { formatDateTime } from "../../lib/dashboard-format";

const repositoryUrl =
  process.env.NEXT_PUBLIC_REPOSITORY_URL ??
  "https://github.com/Nidhu-AI-Tools/Noir_AI_Observatory";

function sourceKindLabel(kind: "github_repo" | "huggingface_org"): string {
  return kind === "github_repo"
    ? "GitHub repository"
    : "Hugging Face organization";
}

export default function SourcesPage() {
  const { data, error, loading, retry } = useGeneratedData<SourceDashboardData>(
    "/generated/sources.json",
  );
  const { data: radar } = useGeneratedData<RadarDashboardData>(
    "/generated/radar.json",
  );
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [category, setCategory] = useState("all");
  const [tag, setTag] = useState("all");
  const [status, setStatus] = useState("all");
  const [sourceId, setSourceId] = useState("");

  useEffect(() => {
    queueMicrotask(() =>
      setSourceId(
        new URLSearchParams(window.location.search).get("source") ?? "",
      ),
    );
  }, []);

  const sources = useMemo(() => {
    if (!data) return [];
    const normalizedQuery = query.trim().toLowerCase();
    return data.sources.filter((source) => {
      const matchesQuery =
        !normalizedQuery ||
        source.displayName.toLowerCase().includes(normalizedQuery) ||
        source.locator.toLowerCase().includes(normalizedQuery) ||
        source.tags.some((tag) => tag.includes(normalizedQuery));
      const matchesKind = kind === "all" || source.kind === kind;
      const matchesCategory =
        category === "all" || source.category.id === category;
      const matchesTag = tag === "all" || source.tags.includes(tag);
      const matchesStatus =
        status === "all" ||
        (status === "enabled" ? source.enabled : !source.enabled);
      const matchesSource = !sourceId || source.id === sourceId;
      return (
        matchesQuery &&
        matchesKind &&
        matchesCategory &&
        matchesTag &&
        matchesStatus &&
        matchesSource
      );
    });
  }, [category, data, kind, query, sourceId, status, tag]);

  const activityBySource = useMemo(
    () => new Map(radar?.sources.map((source) => [source.id, source])),
    [radar],
  );

  return (
    <div className="space-y-8">
      <PageHeading
        action={
          <a
            className="inline-flex w-fit items-center justify-center rounded-lg bg-violet-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-violet-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
            href={`${repositoryUrl}/issues/new?template=add-source.yml`}
            rel="noreferrer"
            target="_blank"
          >
            Add source
          </a>
        }
        description="Browse and manage the repositories and model publishers included in the observatory. Configuration changes are reviewed through GitHub."
        eyebrow="Source registry"
        title="Control what the observatory follows"
      />

      {!data ? (
        <GeneratedDataState error={error} loading={loading} onRetry={retry} />
      ) : (
        <>
          <section
            aria-label="Source statistics"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <MetricCard label="Tracked sources" value={data.summary.total} />
            <MetricCard label="Enabled" value={data.summary.enabled} />
            <MetricCard label="Disabled" value={data.summary.disabled} />
            <MetricCard label="Categories" value={data.summary.categories} />
          </section>

          {sourceId ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-violet-400/20 bg-violet-400/5 px-4 py-3 text-sm text-violet-100">
              <span>Showing one source selected from Radar.</span>
              <button
                className="font-medium text-violet-300 hover:text-violet-200"
                onClick={() => setSourceId("")}
                type="button"
              >
                Show all
              </button>
            </div>
          ) : null}

          <section className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-2 xl:grid-cols-5">
            <label>
              <span className="sr-only">Search sources</span>
              <input
                className="w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, locator, or tag"
                type="search"
                value={query}
              />
            </label>
            <FilterSelect label="Source type" onChange={setKind} value={kind}>
              <option value="all">All source types</option>
              <option value="github_repo">GitHub repositories</option>
              <option value="huggingface_org">
                Hugging Face organizations
              </option>
            </FilterSelect>
            <FilterSelect
              label="Category"
              onChange={setCategory}
              value={category}
            >
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
            <FilterSelect label="Status" onChange={setStatus} value={status}>
              <option value="all">All statuses</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </FilterSelect>
          </section>

          {sources.length === 0 ? (
            <EmptyState
              description={
                data.sources.length === 0
                  ? "Use the Add source button or run pnpm source:add to create the first registry entry."
                  : "Try clearing one or more filters."
              }
              title={
                data.sources.length === 0
                  ? "No tracked sources configured"
                  : "No sources match"
              }
            />
          ) : (
            <section className="grid gap-4 lg:grid-cols-2">
              {sources.map((source) => (
                <article
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6"
                  key={source.id}
                >
                  {(() => {
                    const sourceActivity = activityBySource.get(source.id);
                    return (
                      <>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-medium text-violet-300">
                              {sourceKindLabel(source.kind)}
                            </p>
                            <h2 className="mt-2 text-lg font-semibold text-white">
                              {source.displayName}
                            </h2>
                            <a
                              className="mt-1 block text-sm text-[var(--muted)] hover:text-violet-200"
                              href={source.externalUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {source.locator}
                            </a>
                          </div>
                          <StatusBadge
                            label={source.enabled ? "Enabled" : "Disabled"}
                            tone={source.enabled ? "success" : "neutral"}
                          />
                        </div>
                        {source.description ? (
                          <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                            {source.description}
                          </p>
                        ) : null}
                        <div className="mt-5 flex flex-wrap gap-2">
                          <span className="rounded-md border border-violet-400/20 bg-violet-400/5 px-2 py-1 text-xs text-violet-200">
                            {source.category.name}
                          </span>
                          {source.tags.map((tag) => (
                            <span
                              className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]"
                              key={tag}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="mt-5 rounded-lg border border-[var(--border)] bg-black/15 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-medium tracking-[0.14em] text-slate-500 uppercase">
                              Observed activity
                            </p>
                            <Link
                              className="text-xs font-medium text-violet-300 hover:text-violet-200"
                              href={`/radar/?source=${source.id}`}
                            >
                              Open in Radar
                            </Link>
                          </div>
                          {sourceActivity?.latestObservation ? (
                            <div className="mt-3">
                              <a
                                className="text-sm font-medium text-white hover:text-violet-200"
                                href={sourceActivity.latestObservation.url}
                                rel="noreferrer"
                                target="_blank"
                              >
                                {sourceActivity.latestObservation.title}
                              </a>
                              <p className="mt-1 text-xs text-[var(--muted)]">
                                {sourceActivity.activity.total} total · latest{" "}
                                {formatDateTime(
                                  sourceActivity.latestObservation.occurredAt,
                                )}
                              </p>
                            </div>
                          ) : (
                            <p className="mt-3 text-sm text-slate-500">
                              No observations collected yet.
                            </p>
                          )}
                        </div>
                        <div className="mt-6 flex items-center justify-between border-t border-[var(--border)] pt-4">
                          <code className="text-xs text-slate-500">
                            {source.id}
                          </code>
                          <a
                            className="text-sm font-medium text-violet-300 hover:text-violet-200"
                            href={`${repositoryUrl}/issues/new?template=edit-source.yml&title=${encodeURIComponent(`[Source Edit] ${source.id}`)}`}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Request edit
                          </a>
                        </div>
                      </>
                    );
                  })()}
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
