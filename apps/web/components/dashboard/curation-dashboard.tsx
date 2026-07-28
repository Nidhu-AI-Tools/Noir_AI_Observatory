"use client";

import type { CurationDashboardData } from "@noir/dashboard-data";
import { useState } from "react";

import { useGeneratedData } from "../../hooks/use-generated-data";
import { EmptyState } from "../empty-state";
import { CurationNoteView } from "./curation-note";
import { GeneratedDataState } from "./generated-data-state";
import { MetricCard } from "./metric-card";

export function CurationDashboard() {
  const { data, error, loading, retry } =
    useGeneratedData<CurationDashboardData>("/generated/curation/index.json");
  const [selectedDate, setSelectedDate] = useState("");
  if (!data)
    return (
      <GeneratedDataState error={error} loading={loading} onRetry={retry} />
    );
  if (!data.latest)
    return (
      <EmptyState
        title="No reviewed daily note yet"
        description="Run corepack pnpm curation:daily locally, review the draft, and publish it before committing. Drafts never appear here."
      />
    );
  const note =
    data.notes.find((item) => item.date === selectedDate) ?? data.latest;
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Published notes"
          value={data.summary.publishedNotes}
        />
        <MetricCard
          label="Notes · 30 days"
          value={data.summary.published30Days}
        />
        <MetricCard
          label="Reviewed highlights"
          value={data.summary.totalHighlights}
        />
      </section>
      <div className="flex justify-end">
        <label className="text-sm text-[var(--muted)]">
          Note date
          <select
            className="ml-3 rounded-lg border border-[var(--border)] bg-[#0c1015] px-3 py-2 text-white"
            onChange={(event) => setSelectedDate(event.target.value)}
            value={note.date}
          >
            {data.notes.map((item) => (
              <option key={item.date} value={item.date}>
                {item.date}
              </option>
            ))}
          </select>
        </label>
      </div>
      <CurationNoteView note={note} />
    </div>
  );
}
