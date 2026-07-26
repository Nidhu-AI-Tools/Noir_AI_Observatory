import { PROJECT_NAME } from "@noir/core";

import { EmptyState } from "../components/empty-state";
import { PageHeading } from "../components/page-heading";

const metrics = [
  ["Models", "—", "Add publishers from Sources"],
  ["Releases", "—", "Awaiting first collection"],
  ["Papers", "—", "Research arrives in Phase 5"],
  ["APIs", "—", "Monitoring arrives in Phase 4"],
] as const;

export default function OverviewPage() {
  return (
    <div className="space-y-8">
      <PageHeading
        description="A continuously updated view of AI models, developer tools, research, releases, and the APIs that power them."
        eyebrow="AI ecosystem intelligence"
        title={PROJECT_NAME}
        action={
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-200">
            <span className="size-1.5 rounded-full bg-emerald-300" />
            Registry ready
          </span>
        }
      />

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
          description="Tracked releases, model publications, papers, and announcements will appear here after the collection pipeline is introduced."
          title="No ecosystem observations yet"
        />
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-xs font-semibold tracking-[0.18em] text-violet-300 uppercase">
            System status
          </p>
          <dl className="mt-5 space-y-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--muted)]">Current phase</dt>
              <dd className="font-medium text-white">Source registry</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--muted)]">Collection</dt>
              <dd className="font-medium text-amber-200">
                Planned for Phase 2
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--muted)]">Dashboard mode</dt>
              <dd className="font-medium text-white">Static export</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}
