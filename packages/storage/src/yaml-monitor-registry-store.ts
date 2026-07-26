import { readFile } from "node:fs/promises";
import path from "node:path";

import { monitorRegistrySchema, type MonitorRegistry } from "@noir/core";
import { parse, stringify } from "yaml";

import { atomicWrite } from "./generated/atomic-write";
import type { MonitorRegistryStore } from "./health-store";

export class YamlMonitorRegistryStore implements MonitorRegistryStore {
  private readonly filePath: string;
  constructor(rootDirectory: string) {
    this.filePath = path.join(rootDirectory, "config", "monitors.yaml");
  }
  async read(): Promise<MonitorRegistry> {
    return monitorRegistrySchema.parse(
      parse(await readFile(this.filePath, "utf8")),
    );
  }
  async write(registry: MonitorRegistry): Promise<void> {
    const validated = monitorRegistrySchema.parse({
      ...registry,
      monitors: [...registry.monitors].sort((a, b) => a.id.localeCompare(b.id)),
    });
    await atomicWrite(
      this.filePath,
      stringify(validated, { indent: 2, lineWidth: 0, sortMapEntries: false }),
    );
  }
}
