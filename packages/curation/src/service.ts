import {
  curationContextSchema,
  curationNoteSchema,
  type CurationConfig,
  type CurationContext,
  type CurationNote,
} from "@noir/core";

import { contextHash } from "./identity";
import type { CurationProvider } from "./provider";
import { validateModelOutput } from "./validation";

export class CurationService {
  constructor(private readonly clock: () => Date = () => new Date()) {}

  private async generateValidatedOutput(
    context: CurationContext,
    config: CurationConfig,
    provider: CurationProvider,
  ) {
    const attempts = provider.kind === "ollama" ? 2 : 1;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return validateModelOutput(
          await provider.generate(context, config),
          context,
          config,
        );
      } catch (error) {
        if (attempt === attempts) throw error;
      }
    }
    throw new Error("Curation generation exhausted its retry limit.");
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
