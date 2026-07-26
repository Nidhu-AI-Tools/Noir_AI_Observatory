import {
  consensusResultSchema,
  type BenchmarkCase,
  type ConsensusResult,
  type EcosystemClassification,
  type ModelLabResponse,
} from "@noir/core";

type Agreement = "unanimous" | "majority" | "split" | "insufficient-responses";
function vote<T extends string>(
  values: T[],
): { status: Agreement; majority?: T } {
  if (values.length < 2) return { status: "insufficient-responses" };
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const ranked = [...counts].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const first = ranked[0];
  if (!first) return { status: "insufficient-responses" };
  if (first[1] === values.length)
    return { status: "unanimous", majority: first[0] };
  if (first[1] > values.length / 2)
    return { status: "majority", majority: first[0] };
  return { status: "split" };
}
function jaccard(left: string[], right: string[]) {
  const a = new Set(left.map((value) => value.toLowerCase()));
  const b = new Set(right.map((value) => value.toLowerCase()));
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 1;
  return [...a].filter((value) => b.has(value)).length / union.size;
}
function averagePairwise(values: string[][]): number | null {
  if (values.length < 2) return null;
  const scores: number[] = [];
  for (let left = 0; left < values.length; left += 1)
    for (let right = left + 1; right < values.length; right += 1)
      scores.push(jaccard(values[left] ?? [], values[right] ?? []));
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}
function f1(actual: string[], expected: string[]) {
  const a = new Set(actual.map((value) => value.toLowerCase()));
  const e = new Set(expected.map((value) => value.toLowerCase()));
  if (a.size === 0 && e.size === 0) return 1;
  const matches = [...a].filter((value) => e.has(value)).length;
  const precision = a.size ? matches / a.size : 0;
  const recall = e.size ? matches / e.size : 0;
  return precision + recall
    ? (2 * precision * recall) / (precision + recall)
    : 0;
}
function entityKeys(output: EcosystemClassification) {
  return output.entities.map(
    (entity) => `${entity.name.toLowerCase()}:${entity.type}`,
  );
}

export function calculateConsensus(
  item: BenchmarkCase,
  responses: ModelLabResponse[],
): ConsensusResult {
  const outputs = responses
    .filter((response) => response.status === "success" && response.output)
    .map((response) => response.output!);
  const contentType = vote(outputs.map((output) => output.contentType));
  const lifecycleEvent = vote(outputs.map((output) => output.lifecycleEvent));
  const evidence = outputs.flatMap((output) => output.evidence);
  const evidenceValidity = evidence.length
    ? evidence.filter((entry) => item.inputText.includes(entry.quote)).length /
      evidence.length
    : null;
  const categorical: Agreement[] = [contentType.status, lifecycleEvent.status];
  const status: Agreement =
    outputs.length < 2
      ? "insufficient-responses"
      : categorical.every((value) => value === "unanimous")
        ? "unanimous"
        : categorical.every(
              (value) => value === "unanimous" || value === "majority",
            )
          ? "majority"
          : "split";
  const gold =
    item.expected && outputs.length
      ? {
          exactCategorical:
            outputs.reduce(
              (sum, output) =>
                sum +
                Number(
                  output.contentType === item.expected!.contentType &&
                    output.lifecycleEvent === item.expected!.lifecycleEvent,
                ),
              0,
            ) / outputs.length,
          domainF1:
            outputs.reduce(
              (sum, output) => sum + f1(output.domains, item.expected!.domains),
              0,
            ) / outputs.length,
          entityF1:
            outputs.reduce(
              (sum, output) =>
                sum + f1(entityKeys(output), entityKeys(item.expected!)),
              0,
            ) / outputs.length,
        }
      : undefined;
  return consensusResultSchema.parse({
    caseId: item.id,
    successfulResponses: outputs.length,
    status,
    fields: {
      contentType,
      lifecycleEvent,
      domainJaccard: averagePairwise(outputs.map((output) => output.domains)),
      entityJaccard: averagePairwise(outputs.map(entityKeys)),
    },
    evidenceValidity,
    ...(gold ? { goldScore: gold } : {}),
  });
}
