import {
  curationModelOutputSchema,
  type CurationConfig,
  type CurationContext,
  type CurationHighlight,
  type CurationModelOutput,
} from "@noir/core";

export type ValidatedCurationOutput = Omit<
  CurationModelOutput,
  "highlights"
> & { highlights: CurationHighlight[] };

/**
 * Retains the first model-written highlight for each source. This is used as
 * a bounded last-resort recovery when a local model repeats a source after a
 * normal regeneration attempt. It never creates evidence or rewrites links.
 */
export function deduplicateHighlightSources(
  value: CurationModelOutput,
): CurationModelOutput {
  const used = new Set<string>();
  return {
    ...value,
    highlights: value.highlights.filter((highlight) => {
      if (used.has(highlight.sourceId)) return false;
      used.add(highlight.sourceId);
      return true;
    }),
  };
}

export function validateModelOutput(
  value: unknown,
  context: CurationContext,
  config: CurationConfig,
): ValidatedCurationOutput {
  const output = curationModelOutputSchema.parse(value);
  if (output.highlights.length > config.output.maxHighlights)
    throw new Error(
      `Model returned ${output.highlights.length} highlights; maximum is ${config.output.maxHighlights}.`,
    );
  if (output.summary.length > config.output.maxSummaryCharacters)
    throw new Error("Model summary exceeds the configured character limit.");
  const evidence = new Map(
    context.candidates.map((candidate) => [candidate.id, candidate]),
  );
  const used = new Set<string>();
  const highlights = output.highlights.map((highlight) => {
    const candidate = evidence.get(highlight.sourceId);
    if (!candidate)
      throw new Error(`Model referenced unknown source ${highlight.sourceId}.`);
    if (used.has(highlight.sourceId))
      throw new Error(`Model repeated source ${highlight.sourceId}.`);
    if (highlight.whyItMatters.length > config.output.maxSignificanceCharacters)
      throw new Error(
        `Why-it-matters text for ${highlight.sourceId} exceeds the configured limit.`,
      );
    used.add(highlight.sourceId);
    return { ...highlight, sourceUrl: candidate.url };
  });
  return { ...output, highlights };
}
