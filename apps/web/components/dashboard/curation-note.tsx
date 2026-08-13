import type { CurationNote } from "@noir/core";

export function CurationNoteView({ note }: { note: CurationNote }) {
  return (
    <article className="rounded-xl border border-violet-300/25 bg-violet-300/8 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium tracking-[0.18em] text-violet-300 uppercase">
          Human-reviewed daily note · {note.date}
        </p>
        <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)]">
          Assisted by {note.assistedBy.provider} · {note.assistedBy.model}
        </span>
      </div>
      <h2 className="mt-3 text-xl font-semibold text-white">{note.headline}</h2>
      <p className="mt-3 leading-7 text-slate-300">{note.summary}</p>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {note.highlights.map((highlight) => (
          <section
            className="rounded-lg border border-[var(--border)] bg-black/15 p-4"
            key={highlight.sourceId}
          >
            <h3 className="font-medium text-white">{highlight.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {highlight.summary}
            </p>
            <p className="mt-3 text-sm leading-6 text-violet-100">
              <strong>Why it matters:</strong> {highlight.whyItMatters}
            </p>
            <a
              className="mt-3 inline-block text-sm text-violet-300 hover:text-violet-200"
              href={highlight.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              Evidence ↗
            </a>
          </section>
        ))}
      </div>
      {note.caveats.length ? (
        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <p className="text-sm font-medium text-white">Caveats</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
            {note.caveats.map((caveat) => (
              <li key={caveat}>{caveat}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
