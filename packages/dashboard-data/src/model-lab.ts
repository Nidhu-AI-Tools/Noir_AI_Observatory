import type {
  BenchmarkCaseRegistry,
  BenchmarkSuiteRegistry,
  ConsensusResult,
  ModelLabConfig,
  ModelLabResponse,
  ModelLabRunReport,
} from "@noir/core";

export interface ModelLabDashboardData {
  schemaVersion: 1;
  generatedAt: string;
  notice: string;
  summary: {
    activeModels: number;
    totalResponses: number;
    successfulResponses: number;
    successRate: number | null;
    evidenceValidity: number | null;
    tokens7Days: number;
    agreement: Record<ConsensusResult["status"], number>;
  };
  latestRun?: ModelLabRunReport;
  models: (ModelLabConfig["models"][number] & {
    responses: number;
    successful: number;
    averageLatencyMs: number | null;
  })[];
  suites: BenchmarkSuiteRegistry["suites"];
  cases: {
    id: string;
    kind: "gold" | "live";
    title: string;
    inputText: string;
    sourceUrl?: string;
    responses: ModelLabResponse[];
    consensus?: ConsensusResult;
  }[];
}

export function buildModelLabDashboardData(
  config: ModelLabConfig,
  suites: BenchmarkSuiteRegistry,
  goldCases: BenchmarkCaseRegistry,
  responses: ModelLabResponse[],
  reports: ModelLabRunReport[],
  generatedAt = new Date(),
): ModelLabDashboardData {
  const latestReports = [...reports].sort((a, b) =>
    b.finishedAt.localeCompare(a.finishedAt),
  );
  const latestRun = latestReports[0];
  const successful = responses.filter((item) => item.status === "success");
  const consensusByCase = new Map<string, ConsensusResult>();
  for (const report of latestReports)
    for (const result of report.consensus)
      if (!consensusByCase.has(result.caseId))
        consensusByCase.set(result.caseId, result);
  const snapshots = new Map(
    responses.map((item) => [
      item.caseId,
      {
        id: item.caseId,
        kind: item.caseKind,
        title: item.caseTitle,
        inputText: item.inputText,
        ...(item.sourceUrl ? { sourceUrl: item.sourceUrl } : {}),
      },
    ]),
  );
  for (const item of goldCases.cases)
    if (!snapshots.has(item.id))
      snapshots.set(item.id, {
        id: item.id,
        kind: item.kind,
        title: item.title,
        inputText: item.inputText,
        ...(item.sourceUrl ? { sourceUrl: item.sourceUrl } : {}),
      });
  const evidence = successful.flatMap((item) =>
    (item.output?.evidence ?? []).map((entry) =>
      item.inputText.includes(entry.quote),
    ),
  );
  const sevenDaysAgo = generatedAt.valueOf() - 7 * 86_400_000;
  const agreement: ModelLabDashboardData["summary"]["agreement"] = {
    unanimous: 0,
    majority: 0,
    split: 0,
    "insufficient-responses": 0,
  };
  for (const result of consensusByCase.values()) agreement[result.status] += 1;
  return {
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
    notice:
      "Consensus measures agreement between models; it is not proof that an answer is correct.",
    summary: {
      activeModels: config.models.filter((item) => item.enabled).length,
      totalResponses: responses.length,
      successfulResponses: successful.length,
      successRate: responses.length
        ? successful.length / responses.length
        : null,
      evidenceValidity: evidence.length
        ? evidence.filter(Boolean).length / evidence.length
        : null,
      tokens7Days: responses
        .filter((item) => new Date(item.startedAt).valueOf() >= sevenDaysAgo)
        .reduce((sum, item) => sum + (item.usage?.totalTokens ?? 0), 0),
      agreement,
    },
    ...(latestRun ? { latestRun } : {}),
    models: config.models.map((profile) => {
      const own = responses.filter(
        (item) => item.modelProfileId === profile.id,
      );
      const completed = own.filter((item) => item.status === "success");
      return {
        ...profile,
        responses: own.length,
        successful: completed.length,
        averageLatencyMs: completed.length
          ? Math.round(
              completed.reduce((sum, item) => sum + item.latencyMs, 0) /
                completed.length,
            )
          : null,
      };
    }),
    suites: suites.suites,
    cases: [...snapshots.values()]
      .map((item) => {
        const consensus = consensusByCase.get(item.id);
        return {
          ...item,
          responses: responses
            .filter((response) => response.caseId === item.id)
            .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)),
          ...(consensus ? { consensus } : {}),
        };
      })
      .sort(
        (a, b) =>
          b.responses.length - a.responses.length ||
          a.title.localeCompare(b.title),
      ),
  };
}
