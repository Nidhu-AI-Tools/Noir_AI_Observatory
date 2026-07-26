import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import type {
  ModelProfileCandidate,
  ModelProfileUpdate,
} from "../packages/model-lab/src/index";
import { ModelLabRegistryService } from "../packages/model-lab/src/index";
import {
  YamlBenchmarkCaseStore,
  YamlBenchmarkSuiteStore,
  YamlModelLabConfigStore,
} from "../packages/storage/src/index";

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
function boolean(value: string) {
  return ["true", "yes", "1", "enabled"].includes(value.toLowerCase());
}

async function main() {
  const root = process.cwd();
  const service = new ModelLabRegistryService(
    new YamlModelLabConfigStore(root),
    new YamlBenchmarkSuiteStore(root),
    new YamlBenchmarkCaseStore(root),
  );
  if (["model:validate", "benchmark:validate"].includes(command)) {
    const value = await service.validate();
    console.log(
      `Model Lab configuration is valid: ${value.config.models.length} models, ${value.suites.length} suites, ${value.cases.length} gold cases.`,
    );
    return;
  }
  if (command === "model:list") {
    const { config } = await service.validate();
    console.table(
      config.models.map(({ id, provider, displayName, model, enabled }) => ({
        id,
        provider,
        displayName,
        model,
        enabled,
      })),
    );
    return;
  }
  if (command === "benchmark:list") {
    const value = await service.validate();
    console.table(
      value.cases.map(({ id, suiteId, kind, title }) => ({
        id,
        suiteId,
        kind,
        title,
      })),
    );
    return;
  }
  if (command === "model:add") {
    const candidate: ModelProfileCandidate = {
      provider: (option("provider") ??
        (await ask(
          "Provider (openai, anthropic, or google)",
        ))) as ModelProfileCandidate["provider"],
      displayName: option("display-name") ?? (await ask("Display name")),
      model: option("model") ?? (await ask("Provider model ID")),
      timeoutMs: Number(option("timeout-ms") ?? "60000"),
      maxOutputTokens: Number(option("max-output-tokens") ?? "800"),
      enabled: boolean(option("enabled") ?? "true"),
    };
    console.log(`Added ${(await service.add(candidate)).id}.`);
    return;
  }
  if (["model:enable", "model:disable"].includes(command)) {
    const id = positionals[0] ?? (await ask("Model profile ID"));
    const profile = await service.setEnabled(id, command === "model:enable");
    console.log(
      `${profile.id} is now ${profile.enabled ? "enabled" : "disabled"}.`,
    );
    return;
  }
  if (command === "model:edit") {
    const id = positionals[0] ?? (await ask("Model profile ID"));
    const update: ModelProfileUpdate = {
      ...(option("display-name")
        ? { displayName: option("display-name")! }
        : {}),
      ...(option("model") ? { model: option("model")! } : {}),
      ...(option("timeout-ms")
        ? { timeoutMs: Number(option("timeout-ms")) }
        : {}),
      ...(option("max-output-tokens")
        ? { maxOutputTokens: Number(option("max-output-tokens")) }
        : {}),
      ...(option("enabled") ? { enabled: boolean(option("enabled")!) } : {}),
    };
    console.log(`Updated ${(await service.update(id, update)).id}.`);
    return;
  }
  console.log(
    "Commands: model:add, model:edit ID, model:list, model:enable ID, model:disable ID, model:validate, benchmark:list, benchmark:validate",
  );
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Model Lab command failed.",
  );
  process.exitCode = 1;
});
