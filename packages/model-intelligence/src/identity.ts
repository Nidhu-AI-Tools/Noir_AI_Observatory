import { createHash } from "node:crypto";

export function stableHash(value: unknown) {
  const stableJson = (item: unknown): string => {
    if (Array.isArray(item))
      return `[${item.map((entry) => stableJson(entry)).join(",")}]`;
    if (item && typeof item === "object")
      return `{${Object.entries(item)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
        .join(",")}}`;
    return JSON.stringify(item);
  };
  return createHash("sha256").update(stableJson(value)).digest("hex");
}
export function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}
export function modelIdForExternalId(externalId: string) {
  const readable = slug(externalId);
  return `model-${readable.slice(0, 70)}-${stableHash(externalId).slice(0, 8)}`;
}
