export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDigestDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00.000Z`));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: "compact" }).format(
    value,
  );
}

export function sourceKindLabel(
  kind: "github_repo" | "huggingface_org",
): string {
  return kind === "github_repo" ? "GitHub" : "Hugging Face";
}
