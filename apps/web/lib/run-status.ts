export type PublicRunStatus = "success" | "partial" | "failure" | "no-op";

export interface RunDisplayStatus {
  label: string;
  tone: "success" | "partial" | "failure" | "neutral";
}

export function deriveRunDisplayStatus(
  status: PublicRunStatus,
  finishedAt: string,
  now: string,
  freshnessHours = 36,
): RunDisplayStatus {
  if (status === "failure")
    return { label: "Needs attention", tone: "failure" };
  const age = new Date(now).valueOf() - new Date(finishedAt).valueOf();
  if (!Number.isFinite(age) || age > freshnessHours * 3_600_000)
    return { label: "Delayed", tone: "partial" };
  if (status === "partial") return { label: "Partial", tone: "partial" };
  return { label: "Current", tone: "success" };
}
