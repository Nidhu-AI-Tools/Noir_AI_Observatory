import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import type {
  ResearchSourceCandidate,
  ResearchSourceUpdate,
} from "../packages/core/src/index";
import {
  ResearchAdapterRegistry,
  ResearchRegistryService,
} from "../packages/research/src/index";
import { YamlResearchRegistryStore } from "../packages/storage/src/index";

const argv = process.argv.slice(2);
const command = argv[0] ?? "help";
const positionals = argv
  .slice(1)
  .filter(
    (value, index, values) =>
      !value.startsWith("--") && !values[index - 1]?.startsWith("--"),
  );
function option(name: string) {
  const index = argv.indexOf(`--${name}`);
  const value = argv[index + 1];
  return index >= 0 && value && !value.startsWith("--") ? value : undefined;
}
async function ask(label: string, fallback = "") {
  const terminal = createInterface({ input: stdin, output: stdout });
  const answer = (
    await terminal.question(`${label}${fallback ? ` [${fallback}]` : ""}: `)
  ).trim();
  terminal.close();
  return answer || fallback;
}
function list(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
function boolean(value: string) {
  return ["true", "yes", "1", "enabled"].includes(value.toLowerCase());
}

async function main() {
  const service = new ResearchRegistryService(
    new YamlResearchRegistryStore(process.cwd()),
  );
  if (command === "research-source:validate") {
    const registry = await service.validate();
    console.log(
      `Research registry is valid: ${registry.sources.length} sources.`,
    );
    return;
  }
  if (command === "research-source:list") {
    const registry = await service.validate();
    console.table(
      registry.sources.map((source) => ({
        id: source.id,
        kind: source.kind,
        locator: source.kind === "arxiv_query" ? source.query : source.url,
        category: source.category,
        weight: source.weight,
        enabled: source.enabled,
      })),
    );
    return;
  }
  if (command === "research-source:add") {
    const kind = (option("kind") ??
      (await ask(
        "Kind (arxiv_query or rss_feed)",
      ))) as ResearchSourceCandidate["kind"];
    const common = {
      displayName: option("display-name") ?? (await ask("Display name")),
      category: option("category") ?? (await ask("Category")),
      tags: list(option("tags") ?? (await ask("Tags, comma-separated"))),
      weight: Number(option("weight") ?? "3"),
    };
    const candidate: ResearchSourceCandidate =
      kind === "arxiv_query"
        ? {
            kind,
            ...common,
            query: option("query") ?? (await ask("arXiv query")),
          }
        : {
            kind: "rss_feed",
            ...common,
            url: option("url") ?? (await ask("Public HTTPS feed URL")),
            publisher: option("publisher") ?? (await ask("Publisher")),
          };
    const added = await service.add(candidate);
    console.log(`Added ${added.id}.`);
    return;
  }
  if (["research-source:enable", "research-source:disable"].includes(command)) {
    const id = positionals[0] ?? (await ask("Research source ID"));
    const updated = await service.setEnabled(id, command.endsWith(":enable"));
    console.log(
      `${updated.id} is now ${updated.enabled ? "enabled" : "disabled"}.`,
    );
    return;
  }
  if (command === "research-source:edit") {
    const id = positionals[0] ?? (await ask("Research source ID"));
    const update: ResearchSourceUpdate = {
      ...(option("display-name")
        ? { displayName: option("display-name")! }
        : {}),
      ...(option("query") ? { query: option("query")! } : {}),
      ...(option("url") ? { url: option("url")! } : {}),
      ...(option("publisher") ? { publisher: option("publisher")! } : {}),
      ...(option("category") ? { category: option("category")! } : {}),
      ...(option("tags") ? { tags: list(option("tags") ?? "") } : {}),
      ...(option("weight") ? { weight: Number(option("weight")) } : {}),
      ...(option("enabled")
        ? { enabled: boolean(option("enabled") ?? "") }
        : {}),
    };
    const updated = await service.update(id, update);
    console.log(`Updated ${updated.id}.`);
    return;
  }
  if (command === "research-source:check") {
    const id = positionals[0] ?? (await ask("Research source ID"));
    const source = (await service.validate()).sources.find(
      (item) => item.id === id,
    );
    if (!source) throw new Error(`Unknown research source: ${id}`);
    const now = new Date();
    const items = await new ResearchAdapterRegistry()
      .get(source.kind)
      .collect(source, {
        since: new Date(now.valueOf() - 7 * 86_400_000),
        now,
        maxItems: 5,
      });
    console.log(`Source check succeeded: ${items.length} recent items parsed.`);
    return;
  }
  console.log(
    "Commands: research-source:add, research-source:edit ID, research-source:list, research-source:check ID, research-source:enable ID, research-source:disable ID, research-source:validate",
  );
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Research source command failed.",
  );
  process.exitCode = 1;
});
