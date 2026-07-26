"use client";

import type { ModelLabDashboardData } from "@noir/dashboard-data";
import { useMemo, useState } from "react";

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
const percent = (value: number | null) =>
  value === null ? "—" : `${Math.round(value * 100)}%`;

export function ModelLabDashboard() {
  const { data, error, loading, retry } =
    useGeneratedData<ModelLabDashboardData>("/generated/model-lab/index.json");
  const [kind, setKind] = useState("all");
  const [agreement, setAgreement] = useState("all");
  const cases = useMemo(
    () =>
      data?.cases.filter(
        (item) =>
          (kind === "all" || item.kind === kind) &&
          (agreement === "all" || item.consensus?.status === agreement),
      ) ?? [],
    [agreement, data, kind],
  );
  if (!data)
    return (
      <GeneratedDataState error={error} loading={loading} onRetry={retry} />
    );
  return (
    <div className="space-y-6">
      <aside className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
        {data.notice}
      </aside>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active models" value={data.summary.activeModels} />
        <MetricCard
          label="Successful responses"
          value={`${data.summary.successfulResponses}/${data.summary.totalResponses}`}
        />
        <MetricCard
          label="Success rate"
          value={percent(data.summary.successRate)}
        />
        <MetricCard
          label="Grounded evidence"
          value={percent(data.summary.evidenceValidity)}
        />
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {data.latestRun ? (
          <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
            <StatusBadge
              label={`Latest run: ${data.latestRun.status}`}
              tone={
                data.latestRun.status === "no-op"
                  ? "partial"
                  : data.latestRun.status
              }
            />
            <span>{formatDateTime(data.latestRun.finishedAt)}</span>
          </div>
        ) : (
          <span className="text-sm text-[var(--muted)]">
            No benchmark run recorded yet.
          </span>
        )}
        <a
          className="rounded-lg bg-violet-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-violet-200"
          href={`${repositoryUrl}/issues/new?template=add-model-profile.yml`}
          target="_blank"
          rel="noreferrer"
        >
          Add model profile
        </a>
      </div>
      <section className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2">
        <FilterSelect label="Case kind" onChange={setKind} value={kind}>
          <option value="all">All cases</option>
          <option value="gold">Gold cases</option>
          <option value="live">Live ecosystem cases</option>
        </FilterSelect>
        <FilterSelect
          label="Agreement"
          onChange={setAgreement}
          value={agreement}
        >
          <option value="all">All agreement states</option>
          <option value="unanimous">Unanimous</option>
          <option value="majority">Majority</option>
          <option value="split">Split</option>
          <option value="insufficient-responses">Insufficient responses</option>
        </FilterSelect>
      </section>
      {cases.length === 0 ? (
        <EmptyState
          title={
            data.cases.length ? "No cases match" : "No Model Lab results yet"
          }
          description={
            data.cases.length
              ? "Clear a filter to see more cases."
              : "Add at least two model profiles, configure secrets, and run a gold case to begin."
          }
        />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {cases.map((item) => (
            <article
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
              key={item.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs tracking-wider text-violet-300 uppercase">
                    {item.kind} case
                  </p>
                  <h2 className="mt-1 font-semibold text-white">
                    {item.title}
                  </h2>
                </div>
                {item.consensus ? (
                  <StatusBadge
                    label={item.consensus.status}
                    tone={
                      item.consensus.status === "unanimous"
                        ? "success"
                        : item.consensus.status === "split"
                          ? "failure"
                          : "partial"
                    }
                  />
                ) : null}
              </div>
              <p className="mt-3 line-clamp-4 text-sm whitespace-pre-wrap text-[var(--muted)]">
                {item.inputText}
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="pb-2">Model</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2">Classification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.responses.map((response) => (
                      <tr
                        className="border-t border-[var(--border)]"
                        key={response.id}
                      >
                        <td className="py-2 text-white">
                          {response.modelProfileId}
                        </td>
                        <td className="py-2 text-[var(--muted)]">
                          {response.status}
                        </td>
                        <td className="py-2 text-[var(--muted)]">
                          {response.output
                            ? `${response.output.contentType} · ${response.output.lifecycleEvent}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {item.sourceUrl ? (
                <a
                  className="mt-3 inline-block text-sm text-violet-300 hover:text-violet-200"
                  href={item.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open source ↗
                </a>
              ) : null}
            </article>
          ))}
        </section>
      )}
      <section>
        <div className="mb-4 border-b border-[var(--border)] pb-3">
          <h2 className="text-xl font-semibold text-white">Model profiles</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Configuration only. API keys remain in repository secrets.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {data.models.map((model) => (
            <article
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
              key={model.id}
            >
              <div className="flex justify-between gap-2">
                <h3 className="font-semibold text-white">
                  {model.displayName}
                </h3>
                <StatusBadge
                  label={model.enabled ? "enabled" : "disabled"}
                  tone={model.enabled ? "success" : "partial"}
                />
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {model.provider} · {model.model}
              </p>
              <p className="mt-3 text-xs text-slate-500">
                {model.successful}/{model.responses} successful ·{" "}
                {model.averageLatencyMs === null
                  ? "no latency data"
                  : `${model.averageLatencyMs} ms average`}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
