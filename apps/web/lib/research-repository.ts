import type {
  ResearchIndexData,
  ResearchPageData,
  ResearchSearchIndexData,
} from "@noir/dashboard-data";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const pageCache = new Map<number, Promise<ResearchPageData>>();
let searchCache: Promise<ResearchSearchIndexData> | undefined;

async function generated<T>(path: string): Promise<T> {
  const response = await fetch(`${basePath}${path}`);
  if (!response.ok)
    throw new Error(`Research data returned ${response.status}.`);
  return (await response.json()) as T;
}

export function loadResearchPage(index: ResearchIndexData, page: number) {
  const entry = index.pages.find((candidate) => candidate.page === page);
  if (!entry) throw new Error(`Research page ${page} is unavailable.`);
  const existing = pageCache.get(page);
  if (existing) return existing;
  const request = generated<ResearchPageData>(entry.path);
  pageCache.set(page, request);
  return request;
}

export function loadResearchSearch(index: ResearchIndexData) {
  searchCache ??= generated<ResearchSearchIndexData>(index.searchIndexPath);
  return searchCache;
}
