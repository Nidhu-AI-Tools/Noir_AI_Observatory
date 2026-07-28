"use client";

import type { DailyDigestData, DigestIndexData } from "@noir/dashboard-data";
import { useEffect, useState } from "react";

import { useGeneratedData } from "../../hooks/use-generated-data";
import { formatDateTime, formatDigestDate } from "../../lib/dashboard-format";
import { EmptyState } from "../empty-state";
import { CurationNoteView } from "./curation-note";
import { GeneratedDataState } from "./generated-data-state";
import { MetricCard } from "./metric-card";
import { ObservationCard } from "./observation-card";
import { ResearchCard } from "./research-dashboard";
import { StatusBadge } from "./status-badge";

export function DigestDashboard() {
  const { data, error, loading, retry } = useGeneratedData<DigestIndexData>(
    "/generated/digests/index.json",
  );
  const [date, setDate] = useState("");
  const [urlReady, setUrlReady] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setDate(new URLSearchParams(window.location.search).get("date") ?? "");
      setUrlReady(true);
    });
  }, []);

  const selectedDate =
    data?.dates.some((entry) => entry.date === date) === true
      ? date
      : (data?.dates[0]?.date ?? "");

  useEffect(() => {
    if (!urlReady || !selectedDate) return;
    const parameters = new URLSearchParams(window.location.search);
    parameters.set("date", selectedDate);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${parameters.toString()}`,
    );
  }, [selectedDate, urlReady]);

  if (!data)
    return (
      <GeneratedDataState error={error} loading={loading} onRetry={retry} />
    );
  if (data.dates.length === 0) {
    return (
      <EmptyState
        description="Run the collector once. Digests are created for both change days and successful zero-change days."
        title="No daily digests yet"
      />
    );
  }
  if (!selectedDate)
    return <GeneratedDataState error={null} loading onRetry={retry} />;

  const index = data.dates.findIndex((entry) => entry.date === selectedDate);
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-violet-300 uppercase">
            UTC daily edition
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {formatDigestDate(selectedDate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={index >= data.dates.length - 1}
            onClick={() => setDate(data.dates[index + 1]?.date ?? selectedDate)}
            type="button"
          >
            Older
          </button>
          <label>
            <span className="sr-only">Digest date</span>
            <select
              aria-label="Digest date"
              className="rounded-lg border border-[var(--border)] bg-[#0c1015] px-3 py-2 text-sm text-white"
              onChange={(event) => setDate(event.target.value)}
              value={selectedDate}
            >
              {data.dates.map((entry) => (
                <option key={entry.date} value={entry.date}>
                  {entry.date} ·{" "}
                  {entry.observations +
                    entry.papers +
                    entry.announcements +
                    entry.modelReleases}{" "}
                  items
                </option>
              ))}
            </select>
          </label>
          <button
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={index <= 0}
            onClick={() => setDate(data.dates[index - 1]?.date ?? selectedDate)}
            type="button"
          >
            Newer
          </button>
        </div>
      </section>
      <SelectedDigest date={selectedDate} key={selectedDate} />
    </div>
  );
}

function SelectedDigest({ date }: { date: string }) {
  const { data, error, loading, retry } = useGeneratedData<DailyDigestData>(
    `/generated/digests/${date}.json`,
  );
  if (!data)
    return (
      <GeneratedDataState error={error} loading={loading} onRetry={retry} />
    );

  return (
    <div className="space-y-8">
      {data.curationNote ? (
        <section>
          <CurationNoteView compact note={data.curationNote} />
        </section>
      ) : null}
      <section
        aria-label="Digest statistics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6"
      >
        <MetricCard
          label="Ecosystem changes"
          value={data.summary.observations}
        />
        <MetricCard label="GitHub releases" value={data.summary.releases} />
        <MetricCard label="Model updates" value={data.summary.modelRevisions} />
        <MetricCard label="Papers" value={data.summary.papers} />
        <MetricCard label="Announcements" value={data.summary.announcements} />
        <MetricCard label="Model releases" value={data.summary.modelReleases} />
      </section>

      {data.latestRun ? (
        <section className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-white">Collection run</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {data.latestRun.succeeded} succeeded · {data.latestRun.failed}{" "}
              failed · {data.latestRun.truncated} truncated
            </p>
          </div>
          <div className="flex items-center gap-3">
            <time
              className="text-xs text-slate-500"
              dateTime={data.latestRun.finishedAt}
              title={data.latestRun.finishedAt}
            >
              {formatDateTime(data.latestRun.finishedAt)}
            </time>
            <StatusBadge
              label={data.latestRun.status}
              tone={data.latestRun.status}
            />
          </div>
        </section>
      ) : null}

      {data.healthEvents.length > 0 ? (
        <section>
          <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-[var(--border)] pb-3">
            <h2 className="text-xl font-semibold text-white">
              API health transitions
            </h2>
            <span className="text-sm text-[var(--muted)]">
              {data.healthEvents.length} changes
            </span>
          </div>
          <div className="space-y-3">
            {data.healthEvents.map((event) => (
              <article
                className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between"
                key={`${event.monitorId}:${event.at}`}
              >
                <div>
                  <a
                    className="font-medium text-white hover:text-violet-200"
                    href={event.url || undefined}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {event.displayName}
                  </a>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {event.from} → {event.to}
                  </p>
                </div>
                <time className="text-xs text-slate-500" dateTime={event.at}>
                  {formatDateTime(event.at)}
                </time>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {data.researchItems.length > 0 ? (
        <section>
          <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-[var(--border)] pb-3">
            <h2 className="text-xl font-semibold text-white">
              Research and announcements
            </h2>
            <span className="text-sm text-[var(--muted)]">
              {data.researchItems.length} items
            </span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {data.researchItems.map((item) => (
              <ResearchCard compact item={item} key={item.id} />
            ))}
          </div>
        </section>
      ) : null}

      {data.modelEvents.length > 0 ? (
        <section>
          <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-[var(--border)] pb-3">
            <h2 className="text-xl font-semibold text-white">
              Model releases and updates
            </h2>
            <span className="text-sm text-[var(--muted)]">
              {data.modelEvents.length} events
            </span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {data.modelEvents.map((event) => (
              <article
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                key={event.id}
              >
                <p className="text-xs tracking-wider text-violet-300 uppercase">
                  {event.releaseKind}
                </p>
                <h3 className="mt-1 font-medium text-white">
                  {event.canonicalName}
                </h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {event.organization} · {event.categories.join(", ")}
                </p>
                <time className="mt-3 block text-xs text-slate-500">
                  {formatDateTime(event.occurredAt)}
                  {event.occurredAtInferred ? " · first observed" : ""}
                </time>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {data.categories.length === 0 &&
      data.healthEvents.length === 0 &&
      data.researchItems.length === 0 &&
      data.modelEvents.length === 0 ? (
        <EmptyState
          description={
            data.latestRun
              ? "Collection completed, but no new ecosystem observations were recorded for this UTC day."
              : "No observations or collection report were recorded for this UTC day."
          }
          title="A quiet day in the observatory"
        />
      ) : (
        <div className="space-y-10">
          {data.categories.map((category) => (
            <section key={category.id}>
              <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-[var(--border)] pb-3">
                <h2 className="text-xl font-semibold text-white">
                  {category.name}
                </h2>
                <span className="text-sm text-[var(--muted)]">
                  {category.observations} changes
                </span>
              </div>
              <div className="space-y-7">
                {category.sources.map((source) => (
                  <div key={source.id}>
                    <h3 className="mb-3 text-sm font-medium text-violet-300">
                      {source.displayName}
                    </h3>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {source.observations.map((observation) => (
                        <ObservationCard
                          key={observation.id}
                          observation={observation}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {data.summary.hidden > 0 ? (
        <p className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200">
          {data.summary.hidden} additional observations are omitted from this
          bounded dashboard artifact.
        </p>
      ) : null}
    </div>
  );
}
