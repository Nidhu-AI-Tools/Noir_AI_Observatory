import type { DashboardObservation } from "@noir/dashboard-data";

import {
  formatDateTime,
  formatNumber,
  sourceKindLabel,
} from "../../lib/dashboard-format";
import { StatusBadge } from "./status-badge";

export function ObservationCard({
  observation,
  compact = false,
}: {
  observation: DashboardObservation;
  compact?: boolean;
}) {
  const typeLabel =
    observation.type === "github_release" ? "Release" : "Model update";
  return (
    <article
      className={`rounded-xl border border-[var(--border)] bg-[var(--surface)] ${compact ? "p-4" : "p-5"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={typeLabel} tone="active" />
        <span className="text-xs text-[var(--muted)]">
          {observation.category.name}
        </span>
        <time
          className="ml-auto text-xs text-slate-500"
          dateTime={observation.occurredAt}
          title={observation.occurredAt}
        >
          {formatDateTime(observation.occurredAt)}
        </time>
      </div>
      <h3 className="mt-3 font-semibold text-white">
        <a
          className="transition hover:text-violet-200"
          href={observation.url}
          rel="noreferrer"
          target="_blank"
        >
          {observation.title}
        </a>
      </h3>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {sourceKindLabel(observation.source.kind)} ·{" "}
        {observation.source.displayName}
      </p>
      {!compact && observation.summary ? (
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--muted)]">
          {observation.summary}
        </p>
      ) : null}
      {!compact && observation.model ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
          {observation.model.pipelineTag ? (
            <span>{observation.model.pipelineTag}</span>
          ) : null}
          {observation.model.libraryName ? (
            <span>{observation.model.libraryName}</span>
          ) : null}
          {observation.model.downloads === undefined ? null : (
            <span>{formatNumber(observation.model.downloads)} downloads</span>
          )}
          {observation.model.likes === undefined ? null : (
            <span>{formatNumber(observation.model.likes)} likes</span>
          )}
        </div>
      ) : null}
      {!compact && observation.tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {observation.tags.slice(0, 5).map((tag) => (
            <span
              className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-slate-400"
              key={tag}
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
