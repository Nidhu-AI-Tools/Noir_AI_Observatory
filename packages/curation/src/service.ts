import {
  curationContextSchema,
  curationNoteSchema,
  type CurationConfig,
  type CurationContext,
  type CurationNote,
} from "@noir/core";

import { contextHash } from "./identity";
import type { CurationProvider } from "./provider";
import { deduplicateHighlightSources, validateModelOutput } from "./validation";

export class CurationService {
  constructor(private readonly clock: () => Date = () => new Date()) {}

  private async generateValidatedOutput(
    context: CurationContext,
    config: CurationConfig,
    provider: CurationProvider,
  ) {
    const attempts = provider.kind === "ollama" ? 2 : 1;
    let finalGenerated:
      Awaited<ReturnType<CurationProvider["generate"]>> | undefined;
    let finalError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const generated = await provider.generate(context, config);
      try {
        return validateModelOutput(generated, context, config);
      } catch (error) {
        finalGenerated = generated;
        finalError = error;
      }
    }

    // The second Ollama response is still required to be source-bound. If it
    // only repeats an otherwise valid source, preserve its first occurrence
    // rather than skip the entire day. Other validation errors fail closed.
    if (
      provider.kind === "ollama" &&
      finalGenerated &&
      finalError instanceof Error &&
      finalError.message.startsWith("Model repeated source ")
    )
      return validateModelOutput(
        deduplicateHighlightSources(finalGenerated),
        context,
        config,
      );

    throw finalError;
  }

  async draft(
    contextValue: CurationContext,
    config: CurationConfig,
    provider: CurationProvider,
  ): Promise<CurationNote> {
    const context = curationContextSchema.parse(contextValue);
    if (context.candidates.length === 0)
      throw new Error("No suitable curation candidates were found.");
    const output = await this.generateValidatedOutput(
      context,
      config,
      provider,
    );
    return curationNoteSchema.parse({
      schemaVersion: 1,
      date: context.date,
      status: "draft",
      createdAt: this.clock().toISOString(),
      assistedBy: { provider: provider.kind, model: provider.model },
      contextHash: contextHash(context),
      sourceIds: output.highlights.map((highlight) => highlight.sourceId),
      ...output,
    });
  }

  publish(note: CurationNote) {
    if (note.status === "published") return curationNoteSchema.parse(note);
    return curationNoteSchema.parse({
      ...note,
      status: "published",
      reviewedAt: this.clock().toISOString(),
    });
  }
}
