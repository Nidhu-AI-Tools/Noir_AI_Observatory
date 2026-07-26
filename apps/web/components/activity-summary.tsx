"use client";

import type { ActivityDashboardData } from "@noir/dashboard-data";
import { useEffect, useState } from "react";

import { EmptyState } from "./empty-state";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function ActivitySummary() {
  const [data, setData] = useState<ActivityDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${basePath}/generated/activity.json`)
      .then(async (response) => {
        if (!response.ok)
          throw new Error(`Activity data returned ${response.status}.`);
        return (await response.json()) as ActivityDashboardData;
      })
      .then(setData)
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Activity data could not be loaded.",
        ),
      );
  }, []);

  const metrics = [
    [
      "Model revisions",
      data?.summary.modelRevisions ?? "—",
      "Collected from Hugging Face",
    ],
    ["Releases", data?.summary.releases ?? "—", "Published GitHub releases"],
    [
      "Last 24 hours",
      data?.summary.last24Hours ?? "—",
      "Recent ecosystem changes",
    ],
    [
      "Last 7 days",
      data?.summary.last7Days ?? "—",
      "Current observation window",
    ],
  ] as const;

  return (
    <>
      <section
        aria-label="Observatory metrics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {metrics.map(([label, value, helper]) => (
          <article
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
            key={label}
          >
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              {helper}
            </p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <EmptyState
          description={
            data?.recent.length
              ? `${data.recent.length} recent normalized observations are ready for the Phase 3 radar and digest views.`
              : "Tracked GitHub releases and Hugging Face model revisions will appear after the first collection run."
          }
          title={
            data?.recent.length
              ? "Collection data is ready"
              : "No ecosystem observations yet"
          }
        />
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-xs font-semibold tracking-[0.18em] text-violet-300 uppercase">
            System status
          </p>
          <dl className="mt-5 space-y-4 text-sm">
            <StatusRow label="Current phase" value="Automated collection" />
            <StatusRow
              label="Collection"
              tone={
                data?.latestRun?.status === "success"
                  ? "success"
                  : data?.latestRun
                    ? "warning"
                    : "neutral"
              }
              value={
                error
                  ? "Data unavailable"
                  : (data?.latestRun?.status ?? "Awaiting first run")
              }
            />
            <StatusRow
              label="Last completed"
              value={
                data?.latestRun
                  ? new Date(data.latestRun.finishedAt).toLocaleString()
                  : "—"
              }
            />
            <StatusRow label="Dashboard mode" value="Static export" />
          </dl>
        </div>
      </section>
    </>
  );
}

function StatusRow({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "neutral" | "success" | "warning";
  value: string;
}) {
  const color =
    tone === "success"
      ? "text-emerald-200"
      : tone === "warning"
        ? "text-amber-200"
        : "text-white";
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className={`font-medium capitalize ${color}`}>{value}</dd>
    </div>
  );
}
