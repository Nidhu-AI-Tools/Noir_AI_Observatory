export function resolveTodayDate(
  availableDates: string[],
  requestedDate: string,
): string {
  return availableDates.includes(requestedDate)
    ? requestedDate
    : (availableDates[0] ?? "");
}

export function todayPath(date: string, pathname = "/"): string {
  const parameters = new URLSearchParams();
  if (date) parameters.set("date", date);
  return `${pathname}${parameters.size ? `?${parameters.toString()}` : ""}`;
}

export function legacyTodayTarget(basePath: string, search: string): string {
  const normalizedBase = basePath.replace(/\/$/, "");
  const requestedDate = new URLSearchParams(search).get("date") ?? "";
  return todayPath(requestedDate, `${normalizedBase}/`);
}
