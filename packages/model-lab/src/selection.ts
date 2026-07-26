import {
  benchmarkCaseSchema,
  type BenchmarkCase,
  type BenchmarkSuite,
  type ModelLabConfig,
  type ModelLabResponse,
  type Observation,
  type ResearchItem,
} from "@noir/core";

import { sha256 } from "./hash";

function liveCase(
  item: Observation | ResearchItem,
  suiteId: string,
  maxCharacters: number,
): BenchmarkCase | undefined {
  let inputText = "";
  let publishedAt: string;
  if ("occurredAt" in item) {
    publishedAt = item.occurredAt;
    inputText =
      item.type === "github_release"
        ? (item.details.releaseNotesExcerpt ??
          `Release ${item.details.tagName} was published.`)
        : `Model ${item.details.modelId} was updated. Pipeline: ${item.details.pipelineTag ?? "unknown"}. Tags: ${item.details.tags.slice(0, 12).join(", ")}.`;
  } else {
    publishedAt = item.publishedAt;
    inputText =
      item.summaryExcerpt ??
      (item.type === "research_paper" ? item.abstractExcerpt : "");
  }
  if (!inputText.trim()) return undefined;
  return benchmarkCaseSchema.parse({
    id: `live-${sha256(item.id).slice(0, 24)}`,
    suiteId,
    kind: "live",
    title: item.title,
    inputText: inputText.slice(0, maxCharacters),
    sourceItemId: item.id,
    sourceUrl: item.url,
    publishedAt,
  });
}

export function selectBenchmarkCases(options: {
  config: ModelLabConfig;
  suites: BenchmarkSuite[];
  goldCases: BenchmarkCase[];
  observations: Observation[];
  researchItems: ResearchItem[];
  existingResponses: ModelLabResponse[];
  now: Date;
  caseId?: string;
}): BenchmarkCase[] {
  const enabledSuites = options.suites.filter((suite) => suite.enabled);
  const known = new Set(
    options.existingResponses.map((response) => response.caseId),
  );
  const allGold = options.goldCases.filter((item) =>
    enabledSuites.some((suite) => suite.id === item.suiteId),
  );
  if (options.caseId) {
    const configured = allGold.find((item) => item.id === options.caseId);
    if (configured) return [configured];
    const live = enabledSuites.flatMap((suite) =>
      [...options.observations, ...options.researchItems].flatMap((item) => {
        const candidate = liveCase(
          item,
          suite.id,
          options.config.policy.maxInputCharacters,
        );
        return candidate?.id === options.caseId ? [candidate] : [];
      }),
    );
    if (live[0]) return [live[0]];
    throw new Error(`Unknown benchmark case: ${options.caseId}`);
  }
  const cutoff = options.now.valueOf() - 30 * 86_400_000;
  const live = enabledSuites
    .flatMap((suite) =>
      [...options.observations, ...options.researchItems]
        .filter((item) => suite.inputKinds.includes(item.type))
        .flatMap((item) => {
          const candidate = liveCase(
            item,
            suite.id,
            options.config.policy.maxInputCharacters,
          );
          return candidate &&
            !known.has(candidate.id) &&
            new Date(candidate.publishedAt ?? 0).valueOf() >= cutoff
            ? [candidate]
            : [];
        }),
    )
    .sort(
      (a, b) =>
        (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") ||
        a.id.localeCompare(b.id),
    )
    .slice(0, options.config.policy.liveCasesPerRun);
  const wantGold = options.now.getUTCDay() === 0 || live.length === 0;
  const gold = wantGold
    ? allGold
        .filter((item) => !known.has(item.id))
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, options.config.policy.weeklyGoldCases)
    : [];
  return [...live, ...gold];
}
