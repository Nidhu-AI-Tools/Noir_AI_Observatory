import {
  MonitorRegistryService,
  probeMonitor,
} from "../packages/monitoring/src/index";
import {
  YamlMonitorRegistryStore,
  YamlRegistryStore,
} from "../packages/storage/src/index";
import { parseIssueFormBody, requireIssueField } from "./issue-form";

function list(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
function numbers(value: string) {
  return list(value).map(Number);
}
async function main() {
  const title = process.env.ISSUE_TITLE ?? "";
  const body = process.env.ISSUE_BODY ?? "";
  if (!body) throw new Error("ISSUE_BODY is required.");
  const fields = parseIssueFormBody(body);
  const service = new MonitorRegistryService(
    new YamlMonitorRegistryStore(process.cwd()),
    new YamlRegistryStore(process.cwd()),
  );
  if (title.startsWith("[Monitor Add]")) {
    const linkedSourceId = fields.get("linked source id");
    const description = fields.get("description");
    const monitor = await service.add({
      displayName: requireIssueField(fields, "Display name"),
      url: requireIssueField(fields, "Public HTTPS URL"),
      method: requireIssueField(fields, "HTTP method") as "GET" | "HEAD",
      expectedStatuses: numbers(requireIssueField(fields, "Expected statuses")),
      categoryId: requireIssueField(fields, "Category ID"),
      tags: list(requireIssueField(fields, "Tags")),
      degradedAfterMs: Number(
        requireIssueField(fields, "Degraded after milliseconds"),
      ),
      timeoutMs: Number(requireIssueField(fields, "Timeout milliseconds")),
      ...(linkedSourceId ? { linkedSourceId } : {}),
      ...(description ? { description } : {}),
    });
    const check = await probeMonitor(monitor, `request-${Date.now()}`);
    console.log(
      `Prepared ${monitor.id}; dry check: ${check.status} in ${check.latencyMs}ms.`,
    );
    return;
  }
  if (title.startsWith("[Monitor Edit]")) {
    const status = requireIssueField(fields, "Status").toLowerCase();
    const displayName = fields.get("display name");
    const categoryId = fields.get("category id");
    const linkedSourceId = fields.get("linked source id");
    const description = fields.get("description");
    const updated = await service.update(
      requireIssueField(fields, "Monitor ID"),
      {
        ...(displayName ? { displayName } : {}),
        ...(fields.get("expected statuses")
          ? { expectedStatuses: numbers(fields.get("expected statuses") ?? "") }
          : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(fields.get("tags") ? { tags: list(fields.get("tags") ?? "") } : {}),
        ...(linkedSourceId ? { linkedSourceId } : {}),
        ...(fields.get("degraded after milliseconds")
          ? {
              degradedAfterMs: Number(
                fields.get("degraded after milliseconds"),
              ),
            }
          : {}),
        ...(fields.get("timeout milliseconds")
          ? { timeoutMs: Number(fields.get("timeout milliseconds")) }
          : {}),
        ...(description ? { description } : {}),
        ...(status === "unchanged" ? {} : { enabled: status === "enabled" }),
      },
    );
    console.log(`Prepared monitor edit: ${updated.id}`);
    return;
  }
  throw new Error(
    "Issue title must begin with [Monitor Add] or [Monitor Edit].",
  );
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Monitor request failed.",
  );
  process.exitCode = 1;
});
