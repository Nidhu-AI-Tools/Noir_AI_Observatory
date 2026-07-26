import { XMLParser } from "fast-xml-parser";

export const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  processEntities: false,
  trimValues: true,
});

export function array<T>(value: T | T[] | undefined): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

export function scalar(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value).trim();
  if (value && typeof value === "object" && "#text" in value)
    return scalar((value as { "#text": unknown })["#text"]);
  return "";
}

export function cleanText(value: unknown, max = 2_000): string {
  return scalar(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function timestamp(value: unknown): string | undefined {
  const date = new Date(scalar(value));
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

export function canonicalUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()])
    if (/^(?:utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i.test(key))
      url.searchParams.delete(key);
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/$/, "");
  return url.toString();
}
