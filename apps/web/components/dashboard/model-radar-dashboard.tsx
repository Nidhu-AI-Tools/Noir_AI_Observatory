"use client";

import type {
  ModelCatalogEntry,
  ModelRadarDashboardData,
  PublicModelSignalKind,
} from "@noir/dashboard-data";
import { useMemo, useState } from "react";

import { useGeneratedData } from "../../hooks/use-generated-data";
import { formatDateTime } from "../../lib/dashboard-format";
import { deriveRunDisplayStatus } from "../../lib/run-status";
import { EmptyState } from "../empty-state";
import { FilterSelect } from "./filter-select";
import { GeneratedDataState } from "./generated-data-state";
import { MetricCard } from "./metric-card";
import { StatusBadge } from "./status-badge";

const repositoryUrl =
  process.env.NEXT_PUBLIC_REPOSITORY_URL ??
  "https://github.com/Nidhu-AI-Tools/Noir_AI_Observatory";

export function ModelRadarDashboard() {
  const { data, error, loading, retry } =
    useGeneratedData<ModelRadarDashboardData>("/generated/models/index.json");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [organization, setOrganization] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [lifecycle, setLifecycle] = useState("all");
  const models = useMemo(
    () =>
      data?.models.filter((model) => {
        const search = query.trim().toLowerCase();
        return (
          (!search ||
            [
              model.canonicalName,
              model.organization,
              model.externalModelId ?? "",
              ...model.tags,
            ].some((value) => value.toLowerCase().includes(search))) &&
          (category === "all" || model.categories.includes(category)) &&
          (organization === "all" || model.organization === organization) &&
          (availability === "all" ||
            model.availability.includes(
              availability as ModelCatalogEntry["availability"][number],
            )) &&
          (lifecycle === "all" || model.lifecycle === lifecycle)
        );
      }) ?? [],
    [availability, category, data, lifecycle, organization, query],
  );
  if (!data)
    return (
      <GeneratedDataState error={error} loading={loading} onRetry={retry} />
    );
  const latestRunStatus = data.latestRun
    ? deriveRunDisplayStatus(
        data.latestRun.status,
        data.latestRun.finishedAt,
        data.generatedAt,
      )
    : undefined;
  return (
    <div className="space-y-6">
      <aside className="rounded-xl border border-violet-300/25 bg-violet-300/10 p-4 text-sm text-violet-100">
        {data.definition}
      </aside>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Tracked models" value={data.summary.models} />
        <MetricCard label="Signals today" value={data.summary.signalsToday} />
        <MetricCard
          label="Signals · 7 days"
          value={data.summary.signals7Days}
        />
        <MetricCard
          label="First observed today"
          value={data.summary.firstObservedToday}
        />
        <MetricCard
          label="Confirmed releases"
          value={data.summary.confirmedReleasesToday}
        />
        <MetricCard
          label="Revisions today"
          value={data.summary.revisionsToday}
        />
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {data.latestRun ? (
          <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
            <StatusBadge
              label={latestRunStatus!.label}
              tone={latestRunStatus!.tone}
            />
            <span>{formatDateTime(data.latestRun.finishedAt)}</span>
          </div>
        ) : (
          <span className="text-sm text-[var(--muted)]">
            No model-intelligence run yet.
          </span>
        )}
        <a
          className="rounded-lg bg-violet-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-violet-200"
          href={`${repositoryUrl}/issues/new?template=add-model-release.yml`}
          target="_blank"
          rel="noreferrer"
        >
          Add model information
        </a>
      </div>
      <section>
        <div className="mb-4 border-b border-[var(--border)] pb-3">
          <h2 className="text-xl font-semibold text-white">
            Latest by category
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Newest tracked model signal in each category.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.latestByCategory.map((item) => {
            const model = item.modelId
              ? data.models.find((candidate) => candidate.id === item.modelId)
              : undefined;
            return (
              <article
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                key={item.id}
              >
                <p className="text-xs tracking-wider text-violet-300 uppercase">
                  {item.name}
                </p>
                {model ? (
                  <>
                    <h3 className="mt-2 font-semibold text-white">
                      {model.canonicalName}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {model.organization}
                    </p>
                    <time className="mt-3 block text-xs text-slate-500">
                      {formatDateTime(model.latestSignalAt)} ·{" "}
                      {signalLabel(model.latestSignalKind)}
                    </time>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    No model observed.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>
      <section className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-2 xl:grid-cols-5">
        <label>
          <span className="sr-only">Search models</span>
          <input
            className="w-full rounded-lg border border-[var(--border)] bg-[#0c1015] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search model or organization"
            type="search"
            value={query}
          />
        </label>
        <FilterSelect label="Category" onChange={setCategory} value={category}>
          <option value="all">All categories</option>
          {data.filters.categories.map((item) => (
            <option value={item.id} key={item.id}>
              {item.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Organization"
          onChange={setOrganization}
          value={organization}
        >
          <option value="all">All organizations</option>
          {data.filters.organizations.map((item) => (
            <option value={item} key={item}>
              {item}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Lifecycle"
          onChange={setLifecycle}
          value={lifecycle}
        >
          <option value="all">All lifecycle states</option>
          {data.filters.lifecycle.map((item) => (
            <option value={item} key={item}>
              {item}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Availability"
          onChange={setAvailability}
          value={availability}
        >
          <option value="all">All availability</option>
          {data.filters.availability.map((item) => (
            <option value={item} key={item}>
              {item}
            </option>
          ))}
        </FilterSelect>
      </section>
      {models.length === 0 ? (
        <EmptyState
          title={
            data.models.length ? "No models match" : "No models indexed yet"
          }
          description={
            data.models.length
              ? "Clear one or more filters."
              : "Run model intelligence after collecting Hugging Face observations, or add reviewed model information."
          }
        />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {models.map((model) => (
            <ModelCard model={model} key={model.id} />
          ))}
        </section>
      )}
    </div>
  );
}
function ModelCard({ model }: { model: ModelCatalogEntry }) {
  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-wider text-violet-300 uppercase">
            {model.organization}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">
            {model.canonicalName}
          </h2>
          {model.externalModelId ? (
            <p className="mt-1 font-mono text-xs text-slate-500">
              {model.externalModelId}
            </p>
          ) : null}
        </div>
        <StatusBadge
          label={model.lifecycle}
          tone={model.lifecycle === "active" ? "success" : "partial"}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {model.categoryNames.map((item) => (
          <span
            className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-xs text-violet-200"
            key={item}
          >
            {item}
          </span>
        ))}
        {model.availability.map((item) => (
          <span
            className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)]"
            key={item}
          >
            {item}
          </span>
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-slate-500">Latest signal</dt>
          <dd className="mt-1 text-white">
            {formatDateTime(model.latestSignalAt)} ·{" "}
            {signalLabel(model.latestSignalKind)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Tracked signals</dt>
          <dd className="mt-1 text-white">{model.signalCount}</dd>
        </div>
        {model.license ? (
          <div>
            <dt className="text-slate-500">Published license</dt>
            <dd className="mt-1 text-white">{model.license}</dd>
          </div>
        ) : null}
        {model.currentVersion ? (
          <div>
            <dt className="text-slate-500">Version</dt>
            <dd className="mt-1 break-all text-white">
              {model.currentVersion}
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-4 flex flex-wrap gap-3">
        {model.links.map((link) => (
          <a
            className="text-sm text-violet-300 hover:text-violet-200"
            href={link.url}
            key={`${link.kind}:${link.url}`}
            target="_blank"
            rel="noreferrer"
          >
            {link.label ?? link.kind} ↗
          </a>
        ))}
      </div>
    </article>
  );
}

function signalLabel(kind: PublicModelSignalKind): string {
  const labels: Record<PublicModelSignalKind, string> = {
    "confirmed-release": "confirmed release",
    "first-observed": "first observed",
    revision: "revision",
    "lifecycle-change": "lifecycle change",
    "other-update": "update",
  };
  return labels[kind];
}
