import { createHash } from "node:crypto";

function stableJson(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map((entry) => stableJson(entry)).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export const contextHash = (value: unknown) =>
  createHash("sha256").update(stableJson(value)).digest("hex");
