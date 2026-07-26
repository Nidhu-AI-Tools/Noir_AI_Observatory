import type { ResolvedSource, SourceKind } from "@noir/core";

export interface ResolveContext {
  githubToken?: string;
  huggingFaceToken?: string;
}

export interface SourceAdapter {
  readonly kind: SourceKind;
  resolve(locator: string, context?: ResolveContext): Promise<ResolvedSource>;
}
