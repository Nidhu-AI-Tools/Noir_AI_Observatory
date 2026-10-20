"use client";

import type {
  ModelCardEntry,
  ModelCatalogEntry,
  ModelCatalogRecord,
  ModelRadarCatalogData,
  ModelRadarDashboardData,
  ModelRadarPageData,
  PublicModelSignalKind,
} from "@noir/dashboard-data";
import { useEffect, useMemo, useState } from "react";

import {
  generatedDataUrl,
  useGeneratedData,
} from "../../hooks/use-generated-data";
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

function catalogEntry(
  record: ModelCatalogRecord,
  tags: string[],
): Pick<
  ModelCatalogEntry,
  | "id"
  | "canonicalName"
  | "organization"
  | "externalModelId"
  | "categories"
  | "tags"
  | "availability"
  | "lifecycle"
  | "page"
> {
  return {
    id: record.i,
    canonicalName: record.n,
    organization: record.o,
    ...(record.x ? { externalModelId: record.x } : {}),
    categories: record.c,
    tags: record.t
      .map((index) => tags[index])
      .filter((tag): tag is string => Boolean(tag)),
    availability: record.a,
    lifecycle: record.l,
    page: record.p,
  };
}

function useModelPages(pages: number[]) {
  const key = pages.join(",");
  const pageNumbers = useMemo(
    () => (key ? key.split(",").map(Number) : []),
    [key],
  );
  const [result, setResult] = useState<{
    key: string;
    models: Map<string, ModelCardEntry>;
    error: string | null;
  }>({ key: "", models: new Map(), error: null });
  useEffect(() => {
    const controller = new AbortController();
    if (!pageNumbers.length) return () => controller.abort();
    Promise.all(
      pageNumbers.map(async (page) => {
        const response = await fetch(
          generatedDataUrl(
            `/generated/models/pages/${String(page).padStart(4, "0")}.json`,
          ),
          { signal: controller.signal },
        );
        if (!response.ok)
          throw new Error(`Model page returned ${response.status}.`);
        return (await response.json()) as ModelRadarPageData;
      }),
    )
      .then((values) => {
        if (controller.signal.aborted) return;
        setResult({
          key,
          models: new Map(
            values
              .flatMap((value) => value.models)
              .map((model) => [model.id, model]),
          ),
          error: null,
        });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setResult({
          key,
          models: new Map(),
          error:
            reason instanceof Error
              ? reason.message
              : "Model data could not be loaded.",
        });
      });
    return () => controller.abort();
  }, [key, pageNumbers]);
  return {
    models:
      result.key === key ? result.models : new Map<string, ModelCardEntry>(),
    error: result.key === key ? result.error : null,
    loading: pages.length > 0 && result.key !== key,
  };
}

export function ModelRadarDashboard() {
  const index = useGeneratedData<ModelRadarDashboardData>(
    "/generated/models/index.json",
  );
  const catalog = useGeneratedData<ModelRadarCatalogData>(
    "/generated/models/catalog.json",
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [organization, setOrganization] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [lifecycle, setLifecycle] = useState("all");
  const [page, setPage] = useState(1);
  const catalogModels = useMemo(
    () =>
      catalog.data?.models.map((record) =>
        catalogEntry(record, catalog.data?.tags ?? []),
      ) ?? [],
    [catalog.data],
  );
  const filtered = useMemo(
    () =>
      catalogModels.filter((model) => {
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
    [availability, catalogModels, category, lifecycle, organization, query],
  );
  const pageSize = index.data?.pagination.pageSize ?? 24;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleCatalog = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const sourcePages = useMemo(
    () =>
      [...new Set(visibleCatalog.map((model) => model.page))].sort(
        (a, b) => a - b,
      ),
    [visibleCatalog],
  );
  const pageData = useModelPages(sourcePages);
  const visibleModels = visibleCatalog
    .map((model) => pageData.models.get(model.id))
    .filter((model): model is ModelCardEntry => Boolean(model));
  const resetPage = () => setPage(1);

  if (!index.data || !catalog.data)
    return (
      <GeneratedDataState
        error={index.error ?? catalog.error}
        loading={index.loading || catalog.loading}
        onRetry={() => {
          index.retry();
          catalog.retry();
        }}
      />
    );
  const latestRunStatus = index.data.latestRun
    ? deriveRunDisplayStatus(
        index.data.latestRun.status,
        index.data.latestRun.finishedAt,
        index.data.generatedAt,
      )
    : undefined;
  return (
    <div className="space-y-6">
      <aside className="rounded-xl border border-violet-300/25 bg-violet-300/10 p-4 text-sm text-violet-100">
        {index.data.definition}
      </aside>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Tracked models" value={index.data.summary.models} />
        <MetricCard
          label="Signals today"
          value={index.data.summary.signalsToday}
        />
        <MetricCard
          label="Signals · 7 days"
          value={index.data.summary.signals7Days}
        />
        <MetricCard
          label="First observed today"
          value={index.data.summary.firstObservedToday}
        />
        <MetricCard
          label="Confirmed releases"
          value={index.data.summary.confirmedReleasesToday}
        />
        <MetricCard
          label="Revisions today"
          value={index.data.summary.revisionsToday}
        />
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {index.data.latestRun ? (
          <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
            <StatusBadge
              label={latestRunStatus!.label}
              tone={latestRunStatus!.tone}
            />
            <span>{formatDateTime(index.data.latestRun.finishedAt)}</span>
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
          {index.data.latestByCategory.map((item) => (
            <article
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
              key={item.id}
            >
              <p className="text-xs tracking-wider text-violet-300 uppercase">
                {item.name}
              </p>
              {item.model ? (
                <>
                  <h3 className="mt-2 font-semibold text-white">
                    {item.model.canonicalName}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {item.model.organization}
                  </p>
                  <time className="mt-3 block text-xs text-slate-500">
                    {formatDateTime(item.model.latestSignalAt)} ·{" "}
                    {signalLabel(item.model.latestSignalKind)}
                  </time>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  No model observed.
                </p>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-2 xl:grid-cols-5">
        <label>
          <span className="sr-only">Search models</span>
          <input
            className="w-full rounded-lg border border-[var(--border)] bg-[#0c1015] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400"
            onChange={(event) => {
              setQuery(event.target.value);
              resetPage();
            }}
            placeholder="Search model or organization"
            type="search"
            value={query}
          />
        </label>
        <FilterSelect
          label="Category"
          onChange={(value) => {
            setCategory(value);
            resetPage();
          }}
          value={category}
        >
          <option value="all">All categories</option>
          {index.data.filters.categories.map((item) => (
            <option value={item.id} key={item.id}>
              {item.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Organization"
          onChange={(value) => {
            setOrganization(value);
            resetPage();
          }}
          value={organization}
        >
          <option value="all">All organizations</option>
          {index.data.filters.organizations.map((item) => (
            <option value={item} key={item}>
              {item}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Lifecycle"
          onChange={(value) => {
            setLifecycle(value);
            resetPage();
          }}
          value={lifecycle}
        >
          <option value="all">All lifecycle states</option>
          {index.data.filters.lifecycle.map((item) => (
            <option value={item} key={item}>
              {item}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Availability"
          onChange={(value) => {
            setAvailability(value);
            resetPage();
          }}
          value={availability}
        >
          <option value="all">All availability</option>
          {index.data.filters.availability.map((item) => (
            <option value={item} key={item}>
              {item}
            </option>
          ))}
        </FilterSelect>
      </section>
      {filtered.length === 0 ? (
        <EmptyState
          title={
            catalogModels.length ? "No models match" : "No models indexed yet"
          }
          description={
            catalogModels.length
              ? "Clear one or more filters."
              : "Run model intelligence after collecting Hugging Face observations, or add reviewed model information."
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 text-sm text-[var(--muted)]">
            <span>
              Showing {(safePage - 1) * pageSize + 1}–
              {Math.min(safePage * pageSize, filtered.length)} of{" "}
              {filtered.length} models
            </span>
            <div className="flex gap-2">
              <button
                className="rounded-lg border border-[var(--border)] px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={safePage === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                type="button"
              >
                Previous
              </button>
              <button
                className="rounded-lg border border-[var(--border)] px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={safePage === pageCount}
                onClick={() =>
                  setPage((value) => Math.min(pageCount, value + 1))
                }
                type="button"
              >
                Next
              </button>
            </div>
          </div>
          {pageData.error ? (
            <EmptyState
              title="Model details could not be loaded"
              description={pageData.error}
            />
          ) : pageData.loading ? (
            <p className="text-sm text-[var(--muted)]">
              Loading model details…
            </p>
          ) : (
            <section className="grid gap-4 lg:grid-cols-2">
              {visibleModels.map((model) => (
                <ModelCard model={model} key={model.id} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ModelCard({ model }: { model: ModelCardEntry }) {
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
