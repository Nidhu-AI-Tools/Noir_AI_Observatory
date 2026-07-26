import type { SourceKind } from "./types";

export function toStableId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeTag(value: string): string {
  return toStableId(value);
}

export function normalizeTags(values: readonly string[]): string[] {
  return [...new Set(values.map(normalizeTag).filter(Boolean))].sort();
}

export function normalizeLocator(kind: SourceKind, value: string): string {
  const locator = value.trim().replace(/^\/+|\/+$/g, "");

  if (kind === "github_repo") {
    return locator
      .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
      .replace(/\.git$/i, "")
      .toLowerCase();
  }

  return locator
    .replace(/^https?:\/\/(www\.)?huggingface\.co\//i, "")
    .toLowerCase();
}

export function createSourceId(kind: SourceKind, locator: string): string {
  const provider = kind === "github_repo" ? "github" : "huggingface";
  return `${provider}-${toStableId(normalizeLocator(kind, locator))}`;
}
