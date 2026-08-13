import type { TodayIndexEntry } from "@noir/dashboard-data";

import { formatDigestDate } from "../../lib/dashboard-format";

export function TodayDateNavigation({
  editions,
  selectedDate,
  onSelect,
}: {
  editions: TodayIndexEntry[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const index = editions.findIndex((edition) => edition.date === selectedDate);
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-medium tracking-[0.18em] text-violet-300 uppercase">
          {index === 0 ? "Latest edition" : "Archive edition"} · UTC
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {formatDigestDate(selectedDate)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
          disabled={index < 0 || index >= editions.length - 1}
          onClick={() => onSelect(editions[index + 1]?.date ?? selectedDate)}
          type="button"
        >
          Older
        </button>
        <label>
          <span className="sr-only">Daily edition date</span>
          <select
            aria-label="Daily edition date"
            className="rounded-lg border border-[var(--border)] bg-[#0c1015] px-3 py-2 text-sm text-white"
            onChange={(event) => onSelect(event.target.value)}
            value={selectedDate}
          >
            {editions.map((edition) => (
              <option key={edition.date} value={edition.date}>
                {edition.date} · {edition.counts.totalSignals} signals
                {edition.curated ? " · reviewed" : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
          disabled={index <= 0}
          onClick={() => onSelect(editions[index - 1]?.date ?? selectedDate)}
          type="button"
        >
          Newer
        </button>
      </div>
    </section>
  );
}
