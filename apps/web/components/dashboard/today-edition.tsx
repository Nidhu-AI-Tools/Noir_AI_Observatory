import type { ModelReleaseEvent } from "@noir/core";
import type {
  TodayEditionData,
  TodayHealthTransition,
} from "@noir/dashboard-data";
import Link from "next/link";
import type { ReactNode } from "react";

import { formatDateTime } from "../../lib/dashboard-format";
import { EmptyState } from "../empty-state";
import { CurationNoteView } from "./curation-note";
import { MetricCard } from "./metric-card";
import { ObservationCard } from "./observation-card";
import { ResearchCard } from "./research-dashboard";
import { StatusBadge } from "./status-badge";

export function TodayEdition({ edition }: { edition: TodayEditionData }) {
  const quiet = edition.counts.totalSignals === 0;
  return (
    <div className="space-y-8">
      {edition.curationNote ? (
        <CurationNoteView note={edition.curationNote} />
      ) : null}

      <section
        aria-label="Daily signal statistics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
      >
        <MetricCard label="Total signals" value={edition.counts.totalSignals} />
        <MetricCard label="Ecosystem" value={edition.counts.ecosystem} />
        <MetricCard label="Models" value={edition.counts.models} />
        <MetricCard
          label="Research"
          value={edition.counts.papers + edition.counts.announcements}
          detail={`${edition.counts.papers} papers · ${edition.counts.announcements} announcements`}
        />
        <MetricCard
          label="API transitions"
          value={edition.counts.healthTransitions}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-medium text-white">Ecosystem collection</p>
            {edition.collectionRun ? (
              <StatusBadge
                label={edition.collectionRun.status}
                tone={edition.collectionRun.status}
              />
            ) : (
              <StatusBadge label="No report" tone="neutral" />
            )}
          </div>
          {edition.collectionRun ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              {edition.collectionRun.succeeded} succeeded ·{" "}
              {edition.collectionRun.failed} failed ·{" "}
              {edition.collectionRun.truncated} truncated
            </p>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No ecosystem collection report was recorded for this UTC date.
            </p>
          )}
          {edition.collectionRun ? (
            <time
              className="mt-3 block text-xs text-slate-500"
              dateTime={edition.collectionRun.finishedAt}
            >
              Completed {formatDateTime(edition.collectionRun.finishedAt)}
            </time>
          ) : null}
        </article>
        <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="font-medium text-white">Edition freshness</p>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Latest contributing data or review
          </p>
          <time
            className="mt-3 block text-xs text-slate-500"
            dateTime={edition.lastUpdatedAt}
            title={edition.lastUpdatedAt}
          >
            {formatDateTime(edition.lastUpdatedAt)}
          </time>
          {edition.researchRun ? (
            <p className="mt-3 text-xs text-slate-500">
              Research run {edition.researchRun.status} ·{" "}
              {edition.researchRun.added} added · {edition.researchRun.failed}{" "}
              failed
            </p>
          ) : null}
        </article>
      </section>

      {quiet ? (
        <EmptyState
          title="A quiet day in the Observatory"
          description={
            edition.collectionRun
              ? edition.collectionRun.status === "success"
                ? "Collection completed successfully, but no new tracked changes were recorded for this UTC date."
                : "Collection ran, but no new tracked changes were recorded for this UTC date. Review the run status above."
              : "No tracked activity or collection report is available for this UTC date."
          }
        />
      ) : null}

      <TodaySection
        href="/radar/"
        items={edition.sections.ecosystem.items}
        linkLabel="Explore Radar"
        title="Recent ecosystem releases"
        total={edition.sections.ecosystem.total}
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {edition.sections.ecosystem.items.map((observation) => (
            <ObservationCard
              compact
              key={observation.id}
              observation={observation}
            />
          ))}
        </div>
      </TodaySection>

      <TodaySection
        href="/models/"
        items={edition.sections.models.items}
        linkLabel="Explore Models"
        title="Model releases and updates"
        total={edition.sections.models.total}
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {edition.sections.models.items.map((event) => (
            <ModelEventCard event={event} key={event.id} />
          ))}
        </div>
      </TodaySection>

      <TodaySection
        href="/research/"
        items={edition.sections.research.items}
        linkLabel="Explore Research"
        title="Research highlights"
        total={edition.sections.research.total}
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {edition.sections.research.items.map((item) => (
            <ResearchCard compact item={item} key={item.id} />
          ))}
        </div>
      </TodaySection>

      <TodaySection
        href="/health/"
        items={edition.sections.health.items}
        linkLabel="Open API Health"
        title="API health transitions"
        total={edition.sections.health.total}
      >
        <div className="space-y-3">
          {edition.sections.health.items.map((transition) => (
            <HealthTransitionCard key={transition.id} transition={transition} />
          ))}
        </div>
      </TodaySection>
    </div>
  );
}

function TodaySection<T>({
  children,
  href,
  items,
  linkLabel,
  title,
  total,
}: {
  children: ReactNode;
  href: string;
  items: T[];
  linkLabel: string;
  title: string;
  total: number;
}) {
  if (!items.length) return null;
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {total} {total === 1 ? "signal" : "signals"} in this edition
          </p>
        </div>
        <Link
          className="text-sm font-medium text-violet-300 hover:text-violet-200"
          href={href}
        >
          {linkLabel} →
        </Link>
      </div>
      {children}
      {total > items.length ? (
        <p className="mt-3 text-xs text-slate-500">
          Additional signals are available in the domain view or featured in the
          reviewed note above.
        </p>
      ) : null}
    </section>
  );
}

function ModelEventCard({ event }: { event: ModelReleaseEvent }) {
  const sourceUrl = event.links[0]?.url ?? event.provenance[0]!.url;
  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-xs tracking-wider text-violet-300 uppercase">
        {event.releaseKind}
      </p>
      <h3 className="mt-2 font-semibold text-white">
        <a
          className="hover:text-violet-200"
          href={sourceUrl}
          rel="noreferrer"
          target="_blank"
        >
          {event.canonicalName}
        </a>
      </h3>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {event.organization} · {event.categories.join(", ")}
      </p>
      <time
        className="mt-3 block text-xs text-slate-500"
        dateTime={event.occurredAt}
      >
        {formatDateTime(event.occurredAt)}
        {event.occurredAtInferred ? " · first observed" : ""}
      </time>
    </article>
  );
}

function HealthTransitionCard({
  transition,
}: {
  transition: TodayHealthTransition;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Link
          className="font-medium text-white hover:text-violet-200"
          href={`/health/?monitor=${encodeURIComponent(transition.monitorId)}`}
        >
          {transition.displayName}
        </Link>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {transition.from} → {transition.to}
        </p>
      </div>
      <time className="text-xs text-slate-500" dateTime={transition.at}>
        {formatDateTime(transition.at)}
      </time>
    </article>
  );
}
