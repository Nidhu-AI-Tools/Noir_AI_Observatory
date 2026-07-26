import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import type { MonitorCandidate } from "../packages/core/src/index";
import {
  MonitorRegistryService,
  probeMonitor,
} from "../packages/monitoring/src/index";
import {
  YamlMonitorRegistryStore,
  YamlRegistryStore,
} from "../packages/storage/src/index";

const argv = process.argv.slice(2);
const command = argv[0] ?? "help";
const positionals = argv
  .slice(1)
  .filter(
    (value, index, values) =>
      !value.startsWith("--") && !values[index - 1]?.startsWith("--"),
  );
function option(name: string): string | undefined {
  const index = argv.indexOf(`--${name}`);
  const value = argv[index + 1];
  return index >= 0 && value && !value.startsWith("--") ? value : undefined;
}
async function ask(label: string, fallback = ""): Promise<string> {
  const terminal = createInterface({ input: stdin, output: stdout });
  const answer = (
    await terminal.question(`${label}${fallback ? ` [${fallback}]` : ""}: `)
  ).trim();
  terminal.close();
  return answer || fallback;
}
function list(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
function numbers(value: string): number[] {
  return list(value).map(Number);
}
function boolean(value: string): boolean {
  return ["true", "yes", "1", "enabled"].includes(value.toLowerCase());
}

async function main() {
  const root = process.cwd();
  const store = new YamlMonitorRegistryStore(root);
  const service = new MonitorRegistryService(
    store,
    new YamlRegistryStore(root),
  );
  if (command === "monitor:validate") {
    const result = await service.validate();
    console.log(
      `Monitor registry is valid: ${result.registry.monitors.length} monitors.`,
    );
    return;
  }
  if (command === "monitor:list") {
    const { registry } = await service.validate();
    console.table(
      registry.monitors.map((item) => ({
        id: item.id,
        method: item.method,
        url: item.url,
        category: item.categoryId,
        enabled: item.enabled,
      })),
    );
    return;
  }
  if (command === "monitor:add") {
    const description = option("description");
    const linkedSourceId = option("linked-source");
    const candidate: MonitorCandidate = {
      displayName: option("display-name") ?? (await ask("Display name")),
      url: option("url") ?? (await ask("Public HTTPS URL")),
      method: (option("method") ?? "GET").toUpperCase() as "GET" | "HEAD",
      expectedStatuses: numbers(option("expected-statuses") ?? "200"),
      timeoutMs: Number(option("timeout-ms") ?? "10000"),
      degradedAfterMs: Number(option("degraded-after-ms") ?? "1500"),
      categoryId: option("category") ?? (await ask("Category ID")),
      tags: list(option("tags") ?? (await ask("Tags, comma-separated"))),
      ...(description ? { description } : {}),
      ...(linkedSourceId ? { linkedSourceId } : {}),
    };
    const monitor = await service.add(candidate);
    console.log(`Added ${monitor.id}.`);
    return;
  }
  if (["monitor:enable", "monitor:disable"].includes(command)) {
    const id = positionals[0] ?? (await ask("Monitor ID"));
    const monitor = await service.setEnabled(id, command === "monitor:enable");
    console.log(
      `${monitor.id} is now ${monitor.enabled ? "enabled" : "disabled"}.`,
    );
    return;
  }
  if (command === "monitor:edit") {
    const id = positionals[0] ?? (await ask("Monitor ID"));
    const registry = (await service.validate()).registry;
    const current = registry.monitors.find((item) => item.id === id);
    if (!current) throw new Error(`Unknown monitor: ${id}`);
    const displayName = option("display-name");
    const description = option("description");
    const categoryId = option("category");
    const linkedSourceId = option("linked-source");
    const updated = await service.update(id, {
      ...(displayName ? { displayName } : {}),
      ...(description ? { description } : {}),
      ...(option("expected-statuses")
        ? { expectedStatuses: numbers(option("expected-statuses") ?? "") }
        : {}),
      ...(option("timeout-ms")
        ? { timeoutMs: Number(option("timeout-ms")) }
        : {}),
      ...(option("degraded-after-ms")
        ? { degradedAfterMs: Number(option("degraded-after-ms")) }
        : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(option("tags") ? { tags: list(option("tags") ?? "") } : {}),
      ...(linkedSourceId ? { linkedSourceId } : {}),
      ...(option("enabled")
        ? { enabled: boolean(option("enabled") ?? "") }
        : {}),
    });
    console.log(`Updated ${updated.id}.`);
    return;
  }
  if (command === "monitor:check") {
    const id = positionals[0] ?? (await ask("Monitor ID"));
    const monitor = (await service.validate()).registry.monitors.find(
      (item) => item.id === id,
    );
    if (!monitor) throw new Error(`Unknown monitor: ${id}`);
    const result = await probeMonitor(monitor, `dry-run-${Date.now()}`);
    console.log(
      `${result.status}: ${result.statusCode ?? result.errorCode} in ${result.latencyMs}ms`,
    );
    return;
  }
  console.log(
    "Commands: monitor:add, monitor:edit ID, monitor:list, monitor:check ID, monitor:enable ID, monitor:disable ID, monitor:validate",
  );
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Monitor command failed.",
  );
  process.exitCode = 1;
});
