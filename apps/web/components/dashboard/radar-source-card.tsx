import type {
  DashboardHealthStatus,
  RadarActivityStatus,
  RadarSource,
} from "@noir/dashboard-data";
import Link from "next/link";

import { formatDateTime, sourceKindLabel } from "../../lib/dashboard-format";
import { StatusBadge } from "./status-badge";

const repositoryUrl =
  process.env.NEXT_PUBLIC_REPOSITORY_URL ??
  "https://github.com/Nidhu-AI-Tools/Noir_AI_Observatory";

const statusLabels: Record<RadarActivityStatus, string> = {
  today: "Active today",
  "this-week": "Active this week",
  "this-month": "Active this month",
  earlier: "Earlier activity",
  none: "No activity yet",
  disabled: "Disabled",
};

const healthTones: Record<
  DashboardHealthStatus,
  "success" | "partial" | "failure" | "neutral"
> = {
  healthy: "success",
  degraded: "partial",
  down: "failure",
  stale: "partial",
  unknown: "neutral",
  disabled: "neutral",
};

export function RadarSourceCard({
  focused,
  onSelectTag,
  source,
}: {
  focused: boolean;
  onSelectTag: (tag: string) => void;
  source: RadarSource;
}) {
  return (
    <article
      className={`rounded-xl border bg-[var(--surface)] p-6 ${
        focused
          ? "border-violet-400/60 ring-1 ring-violet-400/20"
          : "border-[var(--border)]"
      }`}
      id={`source-${source.id}`}
    >
      {source.linkedMonitor ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-black/15 px-3 py-2 text-xs">
          <span className="text-[var(--muted)]">Linked API</span>
          <div className="flex items-center gap-2">
            <StatusBadge
              label={source.linkedMonitor.status}
              tone={healthTones[source.linkedMonitor.status]}
            />
            <Link
              className="font-medium text-violet-300 hover:text-violet-200"
              href={`/health/?monitor=${source.linkedMonitor.id}`}
            >
              {source.linkedMonitor.displayName}
            </Link>
          </div>
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
          <p className="mt-1 text-sm text-[var(--muted)]">{source.locator}</p>
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
        {source.tags.map((tag) => (
          <button
            className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-slate-400 hover:border-violet-400/40 hover:text-violet-200"
            key={tag}
            onClick={() => onSelectTag(tag)}
            type="button"
          >
            {tag}
          </button>
        ))}
      </div>

      <details
        className="mt-5 border-t border-[var(--border)] pt-4"
        open={focused || undefined}
      >
        <summary className="cursor-pointer text-sm font-medium text-violet-300 hover:text-violet-200">
          Source details and settings
        </summary>
        <dl className="mt-4 grid gap-3 rounded-lg border border-[var(--border)] bg-black/15 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Immutable source ID</dt>
            <dd className="mt-1 font-mono text-xs break-all text-slate-300">
              {source.id}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Status</dt>
            <dd className="mt-1 text-slate-300">
              {source.enabled ? "Enabled" : "Disabled"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Immutable type</dt>
            <dd className="mt-1 text-slate-300">
              {sourceKindLabel(source.kind)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Immutable locator</dt>
            <dd className="mt-1 break-all text-slate-300">{source.locator}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Category</dt>
            <dd className="mt-1 text-slate-300">{source.category.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Tags</dt>
            <dd className="mt-1 text-slate-300">
              {source.tags.join(", ") || "None"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Created</dt>
            <dd className="mt-1 text-slate-300">
              {formatDateTime(source.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Configuration updated</dt>
            <dd className="mt-1 text-slate-300">
              {formatDateTime(source.updatedAt)}
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <a
            className="text-sm text-slate-400 hover:text-violet-200"
            href={source.externalUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open provider page ↗
          </a>
          <a
            className="text-sm font-medium text-violet-300 hover:text-violet-200"
            href={`${repositoryUrl}/issues/new?template=edit-source.yml&title=${encodeURIComponent(`[Source Edit] ${source.id}`)}`}
            rel="noreferrer"
            target="_blank"
          >
            Request edit
          </a>
        </div>
      </details>
    </article>
  );
}
