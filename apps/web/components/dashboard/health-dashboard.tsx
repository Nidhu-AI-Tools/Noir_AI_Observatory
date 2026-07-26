"use client";

import type {
  DashboardHealthStatus,
  HealthIndexData,
  HealthMonitorDetailData,
  HealthMonitorSummary,
} from "@noir/dashboard-data";
import Link from "next/link";
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
const labels: Record<DashboardHealthStatus, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  down: "Down",
  stale: "Stale",
  unknown: "Unknown",
  disabled: "Disabled",
};
function tone(status: DashboardHealthStatus) {
  return status === "healthy"
    ? "success"
    : status === "degraded" || status === "stale"
      ? "partial"
      : status === "down"
        ? "failure"
        : "neutral";
}
function availability(value: number | null) {
  return value === null
    ? "—"
    : `${(value * 100).toFixed(value === 1 ? 0 : 1)}%`;
}

export function HealthDashboard() {
  const { data, error, loading, retry } = useGeneratedData<HealthIndexData>(
    "/generated/health/index.json",
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [tag, setTag] = useState("all");
  const [selected, setSelected] = useState("");
  useEffect(() => {
    queueMicrotask(() =>
      setSelected(
        new URLSearchParams(window.location.search).get("monitor") ?? "",
      ),
    );
  }, []);
  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    if (selected) parameters.set("monitor", selected);
    else parameters.delete("monitor");
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${parameters.size ? `?${parameters}` : ""}`,
    );
  }, [selected]);
  const monitors = useMemo(
    () =>
      data?.monitors.filter((monitor) => {
        const text = query.trim().toLowerCase();
        return (
          (!text ||
            [monitor.displayName, monitor.url, ...monitor.tags].some((item) =>
              item.toLowerCase().includes(text),
            )) &&
          (status === "all" || monitor.status === status) &&
          (category === "all" || monitor.category.id === category) &&
          (tag === "all" || monitor.tags.includes(tag))
        );
      }) ?? [],
    [category, data, query, status, tag],
  );
  if (!data)
    return (
      <GeneratedDataState error={error} loading={loading} onRetry={retry} />
    );
  if (selected)
    return <MonitorDetail id={selected} onBack={() => setSelected("")} />;
  return (
    <div className="space-y-6">
      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
        aria-label="API health statistics"
      >
        <MetricCard label="Healthy" value={data.summary.healthy} />
        <MetricCard label="Degraded" value={data.summary.degraded} />
        <MetricCard label="Down" value={data.summary.down} />
        <MetricCard
          label="Stale or unknown"
          value={data.summary.stale + data.summary.unknown}
        />
        <MetricCard
          label="Observed availability · 24h"
          value={availability(data.summary.observedAvailability24Hours)}
        />
      </section>
      <div className="flex justify-end">
        <a
          className="rounded-lg bg-violet-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-violet-200"
          href={`${repositoryUrl}/issues/new?template=add-monitor.yml`}
          rel="noreferrer"
          target="_blank"
        >
          Add monitor
        </a>
      </div>
      <section className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-2 xl:grid-cols-4">
        <label>
          <span className="sr-only">Search monitors</span>
          <input
            className="w-full rounded-lg border border-[var(--border)] bg-[#0c1015] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search monitor, URL, or tag"
            type="search"
            value={query}
          />
        </label>
        <FilterSelect label="Health status" onChange={setStatus} value={status}>
          <option value="all">All statuses</option>
          {Object.entries(labels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
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
      </section>
      {monitors.length === 0 ? (
        <EmptyState
          title={
            data.monitors.length
              ? "No monitors match"
              : "No API monitors configured"
          }
          description={
            data.monitors.length
              ? "Try clearing one or more filters."
              : "Add the first public HTTPS endpoint using the Add monitor button or pnpm monitor:add."
          }
        />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {monitors.map((monitor) => (
            <MonitorCard
              key={monitor.id}
              monitor={monitor}
              onSelect={() => setSelected(monitor.id)}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function MonitorCard({
  monitor,
  onSelect,
}: {
  monitor: HealthMonitorSummary;
  onSelect: () => void;
}) {
  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-violet-300">
            {monitor.method} · {monitor.category.name}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            {monitor.displayName}
          </h2>
          <a
            className="mt-1 block text-sm break-all text-[var(--muted)] hover:text-violet-200"
            href={monitor.url}
            rel="noreferrer"
            target="_blank"
          >
            {monitor.url}
          </a>
        </div>
        <StatusBadge
          label={labels[monitor.status]}
          tone={tone(monitor.status)}
        />
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-3 border-y border-[var(--border)] py-4 text-center">
        {[
          ["24h", monitor.windows.last24Hours],
          ["7d", monitor.windows.last7Days],
          ["30d", monitor.windows.last30Days],
        ].map(([label, raw]) => {
          const value = raw as HealthMonitorSummary["windows"]["last24Hours"];
          return (
            <div key={label as string}>
              <dt className="text-xs text-slate-500">{label as string}</dt>
              <dd className="mt-1 font-semibold text-white">
                {availability(value.observedAvailability)}
              </dd>
              <p className="mt-1 text-[10px] text-slate-500">
                p95{" "}
                {value.p95LatencyMs === null ? "—" : `${value.p95LatencyMs}ms`}
              </p>
            </div>
          );
        })}
      </dl>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
        <span>
          {monitor.lastCheck
            ? `Last checked ${formatDateTime(monitor.lastCheck.checkedAt)}`
            : "Never checked"}
        </span>
        <span>
          {monitor.consecutiveFailures
            ? `${monitor.consecutiveFailures} consecutive failures`
            : ""}
        </span>
      </div>
      <div className="mt-5 flex items-center justify-between">
        <button
          className="text-sm font-medium text-violet-300 hover:text-violet-200"
          onClick={onSelect}
          type="button"
        >
          View history
        </button>
        <a
          className="text-sm text-[var(--muted)] hover:text-violet-200"
          href={`${repositoryUrl}/issues/new?template=edit-monitor.yml&title=${encodeURIComponent(`[Monitor Edit] ${monitor.id}`)}`}
          rel="noreferrer"
          target="_blank"
        >
          Request edit
        </a>
      </div>
    </article>
  );
}

function MonitorDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, error, loading, retry } =
    useGeneratedData<HealthMonitorDetailData>(
      `/generated/health/monitors/${id}.json`,
    );
  if (!data)
    return (
      <>
        <button
          className="mb-4 text-sm text-violet-300"
          onClick={onBack}
          type="button"
        >
          ← All monitors
        </button>
        <GeneratedDataState error={error} loading={loading} onRetry={retry} />
      </>
    );
  const monitor = data.monitor;
  return (
    <div className="space-y-6">
      <button
        className="text-sm font-medium text-violet-300 hover:text-violet-200"
        onClick={onBack}
        type="button"
      >
        ← All monitors
      </button>
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-violet-300">
              {monitor.method} · {monitor.category.name}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {monitor.displayName}
            </h2>
            <a
              className="mt-2 block text-sm break-all text-[var(--muted)] hover:text-violet-200"
              href={monitor.url}
              rel="noreferrer"
              target="_blank"
            >
              {monitor.url}
            </a>
          </div>
          <StatusBadge
            label={labels[monitor.status]}
            tone={tone(monitor.status)}
          />
        </div>
      </section>
      <section>
        <h3 className="text-lg font-semibold text-white">Recent checks</h3>
        {data.checks.length === 0 ? (
          <EmptyState
            title="No checks yet"
            description="Run the health workflow to create this monitor's first sample."
          />
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full min-w-[38rem] text-left text-sm">
              <thead className="bg-white/5 text-[var(--muted)]">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">HTTP</th>
                  <th className="p-3">Latency</th>
                  <th className="p-3">Result</th>
                </tr>
              </thead>
              <tbody>
                {data.checks.slice(0, 100).map((check) => (
                  <tr
                    className="border-t border-[var(--border)]"
                    key={check.id}
                  >
                    <td className="p-3 text-[var(--muted)]">
                      {formatDateTime(check.checkedAt)}
                    </td>
                    <td className="p-3">
                      <StatusBadge
                        label={check.status}
                        tone={
                          check.status === "healthy"
                            ? "success"
                            : check.status === "degraded"
                              ? "partial"
                              : "failure"
                        }
                      />
                    </td>
                    <td className="p-3 text-white">
                      {check.statusCode ?? "—"}
                    </td>
                    <td className="p-3 text-white">{check.latencyMs}ms</td>
                    <td className="p-3 text-[var(--muted)]">
                      {check.errorCode ?? "Expected response"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {monitor.linkedSourceId ? (
        <Link
          className="inline-flex text-sm font-medium text-violet-300"
          href={`/radar/?source=${monitor.linkedSourceId}`}
        >
          Open linked Radar source →
        </Link>
      ) : null}
    </div>
  );
}
