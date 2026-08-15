export type ResearchSort = "newest" | "oldest" | "relevance";
export type ResearchType = "all" | "research_paper" | "official_announcement";
export type ResearchWindow = "all" | "7d" | "30d" | "90d" | "1y";

export interface ResearchUrlState {
  query: string;
  organization: string;
  venue: string;
  topic: string;
  type: ResearchType;
  source: string;
  tag: string;
  arxiv: string;
  window: ResearchWindow;
  from: string;
  to: string;
  sort: ResearchSort;
  page: number;
}

export const defaultResearchUrlState: ResearchUrlState = {
  query: "",
  organization: "all",
  venue: "all",
  topic: "all",
  type: "all",
  source: "all",
  tag: "all",
  arxiv: "all",
  window: "all",
  from: "",
  to: "",
  sort: "newest",
  page: 1,
};

const types = new Set<ResearchType>([
  "all",
  "research_paper",
  "official_announcement",
]);
const windows = new Set<ResearchWindow>(["all", "7d", "30d", "90d", "1y"]);
const sorts = new Set<ResearchSort>(["newest", "oldest", "relevance"]);

function selected<T extends string>(
  value: string | null,
  allowed: Set<T>,
  fallback: T,
) {
  return value && allowed.has(value as T) ? (value as T) : fallback;
}

function date(value: string | null): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

export function parseResearchUrl(search: string): ResearchUrlState {
  const parameters = new URLSearchParams(search);
  const page = Number(parameters.get("page") ?? "1");
  return {
    query: (parameters.get("q") ?? "").trim(),
    organization: parameters.get("organization") || "all",
    venue: parameters.get("venue") || "all",
    topic: parameters.get("topic") || "all",
    type: selected(parameters.get("type"), types, "all"),
    source: parameters.get("source") || "all",
    tag: parameters.get("tag") || "all",
    arxiv: parameters.get("arxiv") || "all",
    window: selected(parameters.get("window"), windows, "all"),
    from: date(parameters.get("from")),
    to: date(parameters.get("to")),
    sort: selected(parameters.get("sort"), sorts, "newest"),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function researchPath(
  state: ResearchUrlState,
  pathname = "/research/",
): string {
  const parameters = new URLSearchParams();
  if (state.query.trim()) parameters.set("q", state.query.trim());
  for (const [key, value] of [
    ["organization", state.organization],
    ["venue", state.venue],
    ["topic", state.topic],
    ["type", state.type],
    ["source", state.source],
    ["tag", state.tag],
    ["arxiv", state.arxiv],
    ["window", state.window],
  ] as const)
    if (value !== "all") parameters.set(key, value);
  if (state.from) parameters.set("from", state.from);
  if (state.to) parameters.set("to", state.to);
  if (state.sort !== "newest") parameters.set("sort", state.sort);
  if (state.page > 1) parameters.set("page", String(state.page));
  const search = parameters.toString();
  return `${pathname}${search ? `?${search}` : ""}`;
}

export function resetResearchPage(
  state: ResearchUrlState,
  update: Partial<Omit<ResearchUrlState, "page">>,
): ResearchUrlState {
  return { ...state, ...update, page: 1 };
}
