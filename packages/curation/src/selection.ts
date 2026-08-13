import {
  curationContextSchema,
  type CurationCandidate,
  type CurationConfig,
  type CurationContext,
  type HealthCheck,
  type ModelReleaseEvent,
  type MonitorRegistry,
  type Observation,
  type ResearchItem,
} from "@noir/core";

export interface CurationInputs {
  observations: Observation[];
  researchItems: ResearchItem[];
  modelEvents: ModelReleaseEvent[];
  healthChecks: HealthCheck[];
  monitors: MonitorRegistry;
}

const bounded = (value: string, limit = 2_000) =>
  value.trim().replace(/\s+/g, " ").slice(0, limit);

function recencyScore(occurredAt: string, now: Date) {
  const hours = Math.max(
    0,
    (now.valueOf() - new Date(occurredAt).valueOf()) / 3_600_000,
  );
  return Math.max(0, 24 - Math.floor(hours / 2));
}

function observationCandidates(
  observations: Observation[],
  now: Date,
  promotedObservationIds: Set<string>,
): CurationCandidate[] {
  return observations
    .filter((item) => !promotedObservationIds.has(item.id))
    .map((item) => {
      if (item.type === "github_release")
        return {
          id: item.id,
          kind: "github-release",
          title: item.title,
          url: item.url,
          occurredAt: item.occurredAt,
          category: item.categoryId,
          tags: item.sourceTags,
          evidence: bounded(
            [
              `Release ${item.details.tagName}.`,
              item.details.prerelease
                ? "Marked as prerelease."
                : "Stable release.",
              item.details.releaseNotesExcerpt ??
                "No release excerpt supplied.",
            ].join(" "),
          ),
          score: 65 + recencyScore(item.occurredAt, now),
          reasons: ["Tracked GitHub release", "Recent ecosystem change"],
        } satisfies CurationCandidate;
      return {
        id: item.id,
        kind: "model-revision",
        title: item.title,
        url: item.url,
        occurredAt: item.occurredAt,
        category: item.categoryId,
        tags: [...new Set([...item.sourceTags, ...item.details.tags])].slice(
          0,
          30,
        ),
        evidence: bounded(
          [
            `Hugging Face model ${item.details.modelId}.`,
            item.details.pipelineTag
              ? `Pipeline ${item.details.pipelineTag}.`
              : "",
            item.details.libraryName
              ? `Library ${item.details.libraryName}.`
              : "",
            `Gated: ${String(item.details.gated)}.`,
          ].join(" "),
        ),
        score: 50 + recencyScore(item.occurredAt, now),
        reasons: ["Tracked model revision", "Recent ecosystem change"],
      } satisfies CurationCandidate;
    });
}

function researchCandidates(
  items: ResearchItem[],
  now: Date,
): CurationCandidate[] {
  return items.map((item) => ({
    id: item.id,
    kind: item.type === "research_paper" ? "research-paper" : "announcement",
    title: item.title,
    url: item.url,
    occurredAt: item.publishedAt,
    category: item.category,
    tags: item.tags,
    evidence: bounded(
      item.type === "research_paper"
        ? `${item.abstractExcerpt} Authors: ${item.authors.join(", ")}. Primary category: ${item.primaryCategory}.`
        : `${item.summaryExcerpt ?? "No summary excerpt supplied."} Publisher: ${item.publisher}.`,
    ),
    score:
      (item.type === "research_paper" ? 72 : 62) +
      recencyScore(item.publishedAt, now),
    reasons: [
      item.type === "research_paper"
        ? "Tracked research paper"
        : "Official announcement",
      "Recent publication",
    ],
  }));
}

function modelCandidates(
  events: ModelReleaseEvent[],
  now: Date,
): CurationCandidate[] {
  return events.map((event) => ({
    id: event.id,
    kind: "model-release",
    title: `${event.canonicalName} · ${event.releaseKind}`,
    url: event.links[0]?.url ?? event.provenance[0]!.url,
    occurredAt: event.occurredAt,
    category: event.categories[0] ?? "models",
    tags: event.tags,
    evidence: bounded(
      [
        `${event.organization} published ${event.canonicalName}.`,
        `Release kind: ${event.releaseKind}.`,
        event.version ? `Version: ${event.version}.` : "",
        `Availability: ${event.availability.join(", ")}.`,
        `Categories: ${event.categories.join(", ")}.`,
      ].join(" "),
    ),
    score:
      (event.releaseKind === "initial-release" ||
      event.releaseKind === "new-version"
        ? 90
        : 70) + recencyScore(event.occurredAt, now),
    reasons: [
      event.releaseKind === "initial-release"
        ? "Initial model release"
        : "Model lifecycle event",
      "Model Radar evidence available",
    ],
  }));
}

function healthCandidates(
  checks: HealthCheck[],
  registry: MonitorRegistry,
  now: Date,
): CurationCandidate[] {
  const monitorById = new Map(
    registry.monitors.map((monitor) => [monitor.id, monitor]),
  );
  const grouped = new Map<string, HealthCheck[]>();
  for (const check of checks)
    grouped.set(check.monitorId, [
      ...(grouped.get(check.monitorId) ?? []),
      check,
    ]);
  const candidates: CurationCandidate[] = [];
  for (const [monitorId, values] of grouped) {
    const chronological = [...values].sort((left, right) =>
      left.checkedAt.localeCompare(right.checkedAt),
    );
    for (let index = 1; index < chronological.length; index += 1) {
      const previous = chronological[index - 1];
      const current = chronological[index];
      if (!previous || !current || previous.status === current.status) continue;
      const monitor = monitorById.get(monitorId);
      if (!monitor) continue;
      candidates.push({
        id: `health:${monitorId}:${current.checkedAt}`,
        kind: "health-transition",
        title: `${monitor.displayName}: ${previous.status} → ${current.status}`,
        url: monitor.url,
        occurredAt: current.checkedAt,
        category: monitor.categoryId,
        tags: monitor.tags,
        evidence: bounded(
          `Observed API status changed from ${previous.status} to ${current.status}. Latency ${current.latencyMs} ms${current.statusCode ? `, HTTP ${current.statusCode}` : ""}. This is a sampled observation, not an SLA.`,
        ),
        score:
          (current.status === "down"
            ? 88
            : current.status === "healthy"
              ? 76
              : 82) + recencyScore(current.checkedAt, now),
        reasons: ["Observed API health transition"],
      });
    }
  }
  return candidates;
}

export function buildCurationContext(
  inputs: CurationInputs,
  config: CurationConfig,
  now = new Date(),
  requestedDate = now.toISOString().slice(0, 10),
): CurationContext {
  const finishedAt = now;
  const startedAt = new Date(
    finishedAt.valueOf() - config.selection.lookbackHours * 3_600_000,
  );
  const promotedObservationIds = new Set(
    inputs.modelEvents.flatMap((event) =>
      event.provenance.flatMap((item) =>
        item.observationId ? [item.observationId] : [],
      ),
    ),
  );
  const eligible = [
    ...observationCandidates(inputs.observations, now, promotedObservationIds),
    ...researchCandidates(inputs.researchItems, now),
    ...modelCandidates(inputs.modelEvents, now),
    ...healthCandidates(inputs.healthChecks, inputs.monitors, now),
  ].filter((item) => {
    const occurredAt = new Date(item.occurredAt).valueOf();
    return (
      occurredAt >= startedAt.valueOf() && occurredAt <= finishedAt.valueOf()
    );
  });
  const byUrl = new Map<string, CurationCandidate>();
  for (const candidate of eligible) {
    const current = byUrl.get(candidate.url);
    if (
      !current ||
      candidate.score > current.score ||
      (candidate.score === current.score && candidate.id < current.id)
    )
      byUrl.set(candidate.url, candidate);
  }
  const categoryCounts = new Map<string, number>();
  const selected: CurationCandidate[] = [];
  for (const candidate of [...byUrl.values()].sort(
    (left, right) =>
      right.score - left.score ||
      right.occurredAt.localeCompare(left.occurredAt) ||
      left.id.localeCompare(right.id),
  )) {
    const count = categoryCounts.get(candidate.category) ?? 0;
    if (count >= config.selection.maxPerCategory) continue;
    selected.push(candidate);
    categoryCounts.set(candidate.category, count + 1);
    if (selected.length >= config.selection.maxCandidates) break;
  }
  return curationContextSchema.parse({
    schemaVersion: 1,
    date: requestedDate,
    generatedAt: now.toISOString(),
    windowStartedAt: startedAt.toISOString(),
    windowFinishedAt: finishedAt.toISOString(),
    candidates: selected,
  });
}
