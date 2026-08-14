export type RadarKind = "all" | "github_repo" | "huggingface_org";
export type RadarPeriod = "all" | "24h" | "7d" | "30d" | "none";
export type RadarConfigurationStatus = "all" | "enabled" | "disabled";

export interface RadarUrlState {
  query: string;
  kind: RadarKind;
  category: string;
  tag: string;
  period: RadarPeriod;
  status: RadarConfigurationStatus;
  sourceId: string;
}

export const defaultRadarUrlState: RadarUrlState = {
  query: "",
  kind: "all",
  category: "all",
  tag: "all",
  period: "all",
  status: "all",
  sourceId: "",
};

const radarKinds = new Set<RadarKind>([
  "all",
  "github_repo",
  "huggingface_org",
]);
const radarPeriods = new Set<RadarPeriod>(["all", "24h", "7d", "30d", "none"]);
const radarStatuses = new Set<RadarConfigurationStatus>([
  "all",
  "enabled",
  "disabled",
]);

function enumValue<T extends string>(
  value: string | null,
  values: Set<T>,
  fallback: T,
): T {
  return value && values.has(value as T) ? (value as T) : fallback;
}

export function parseRadarUrl(search: string): RadarUrlState {
  const parameters = new URLSearchParams(search);
  return {
    query: (parameters.get("q") ?? "").trim(),
    kind: enumValue(parameters.get("kind"), radarKinds, "all"),
    category: parameters.get("category") || "all",
    tag: parameters.get("tag") || "all",
    period: enumValue(parameters.get("period"), radarPeriods, "all"),
    status: enumValue(parameters.get("status"), radarStatuses, "all"),
    sourceId: parameters.get("source") ?? "",
  };
}

export function radarSearch(state: RadarUrlState): string {
  const parameters = new URLSearchParams();
  if (state.query.trim()) parameters.set("q", state.query.trim());
  if (state.kind !== "all") parameters.set("kind", state.kind);
  if (state.category !== "all") parameters.set("category", state.category);
  if (state.tag !== "all") parameters.set("tag", state.tag);
  if (state.period !== "all") parameters.set("period", state.period);
  if (state.status !== "all") parameters.set("status", state.status);
  if (state.sourceId) parameters.set("source", state.sourceId);
  return parameters.toString();
}

export function radarPath(state: RadarUrlState, pathname = "/radar/"): string {
  const search = radarSearch(state);
  return `${pathname}${search ? `?${search}` : ""}`;
}

export function legacyRadarTarget(basePath: string, search: string): string {
  const normalizedBase = basePath.replace(/\/$/, "");
  return radarPath(parseRadarUrl(search), `${normalizedBase}/radar/`);
}
