export const SOURCE_KINDS = ["github_repo", "huggingface_org"] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number];

export interface SourceCandidate {
  kind: SourceKind;
  locator: string;
  displayName?: string;
  description?: string;
  categoryId: string;
  tags: string[];
  enabled?: boolean;
}

export interface SourceUpdate {
  displayName?: string;
  description?: string | null;
  categoryId?: string;
  tags?: string[];
  enabled?: boolean;
}

export interface ResolvedSource {
  kind: SourceKind;
  locator: string;
  displayName: string;
  description?: string;
  externalUrl: string;
  warnings: string[];
  metadata: Record<string, unknown>;
}
