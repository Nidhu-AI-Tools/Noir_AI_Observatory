"use client";

import type {
  DashboardFeedData,
  HealthIndexData,
  ResearchDashboardData,
} from "@noir/dashboard-data";
import Link from "next/link";

import { useGeneratedData } from "../../hooks/use-generated-data";
import { formatDateTime } from "../../lib/dashboard-format";
import { EmptyState } from "../empty-state";
import { GeneratedDataState } from "./generated-data-state";
import { MetricCard } from "./metric-card";
import { ObservationCard } from "./observation-card";
import { StatusBadge } from "./status-badge";

export function OverviewDashboard() {
  const { data, error, loading, retry } = useGeneratedData<DashboardFeedData>(
    "/generated/feed.json",
  );
  const { data: health } = useGeneratedData<HealthIndexData>(
    "/generated/health/index.json",
  );
  const { data: research } = useGeneratedData<ResearchDashboardData>(
    "/generated/research/index.json",
  );

  if (!data)
    return (
      <GeneratedDataState error={error} loading={loading} onRetry={retry} />
    );

  return (
    <div className="space-y-8">
      <section
        aria-label="Ecosystem statistics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard label="GitHub releases" value={data.summary.releases} />
        <MetricCard label="Model updates" value={data.summary.modelRevisions} />
        <MetricCard label="Last 24 hours" value={data.summary.last24Hours} />
        <MetricCard label="Last 7 days" value={data.summary.last7Days} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)]">
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium tracking-[0.18em] text-violet-300 uppercase">
                Latest signal
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Recent ecosystem activity
              </h2>
            </div>
            <Link
              className="text-sm font-medium text-violet-300 hover:text-violet-200"
              href="/digests/"
            >
              View digests
            </Link>
          </div>
          {data.recent.length === 0 ? (
            <EmptyState
              description="Run the collector after adding sources. A successful zero-change run will still appear in Daily Digests."
              title="No observations collected yet"
            />
          ) : (
            <div className="space-y-3">
              {data.recent.slice(0, 6).map((observation) => (
                <ObservationCard
                  compact
                  key={observation.id}
                  observation={observation}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--muted)]">Research watch</p>
              <Link
                className="text-xs text-violet-300 hover:text-violet-200"
                href="/research/"
              >
                Explore
              </Link>
            </div>
            {research ? (
              <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="text-xl font-semibold text-white">
                    {research.summary.papers7Days}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Papers · 7d</p>
                </div>
                <div>
                  <p className="text-xl font-semibold text-white">
                    {research.summary.announcements7Days}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Announcements · 7d
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Loading research signal.
              </p>
            )}
          </article>
          <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--muted)]">API health</p>
              <Link
                className="text-xs text-violet-300 hover:text-violet-200"
                href="/health/"
              >
                Details
              </Link>
            </div>
            {health ? (
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xl font-semibold text-emerald-300">
                    {health.summary.healthy}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Healthy</p>
                </div>
                <div>
                  <p className="text-xl font-semibold text-amber-300">
                    {health.summary.degraded}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Degraded</p>
                </div>
                <div>
                  <p className="text-xl font-semibold text-rose-300">
                    {health.summary.down}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Down</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Loading operational status.
              </p>
            )}
          </article>
          <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="text-sm text-[var(--muted)]">Latest collection</p>
            {data.latestRun ? (
              <div className="mt-4 space-y-3">
                <StatusBadge
                  label={data.latestRun.status}
                  tone={data.latestRun.status}
                />
                <p className="text-sm text-white">
                  {data.latestRun.succeeded} succeeded · {data.latestRun.failed}{" "}
                  failed
                </p>
                <time
                  className="block text-xs text-slate-500"
                  dateTime={data.latestRun.finishedAt}
                  title={data.latestRun.finishedAt}
                >
                  {formatDateTime(data.latestRun.finishedAt)}
                </time>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                No collection run report is available yet.
              </p>
            )}
          </article>
          <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--muted)]">
                Most active categories
              </p>
              <Link
                className="text-xs text-violet-300 hover:text-violet-200"
                href="/radar/"
              >
                Radar
              </Link>
            </div>
            {data.categories.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                Waiting for activity.
              </p>
            ) : (
              <ol className="mt-4 space-y-3">
                {data.categories.slice(0, 5).map((category) => (
                  <li
                    className="flex items-center justify-between gap-3 text-sm"
                    key={category.id}
                  >
                    <span className="text-white">{category.name}</span>
                    <span className="text-[var(--muted)]">
                      {category.observations}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </article>
        </aside>
      </div>
    </div>
  );
}
