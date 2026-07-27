import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import type { ModelAvailability } from "../packages/core/src/index";
import {
  ModelIntelligenceRegistryService,
  type ModelUpdate,
} from "../packages/model-intelligence/src/index";
import {
  YamlModelCategoryStore,
  YamlModelOverrideStore,
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
const list = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
const bool = (value: string) =>
  ["true", "yes", "1", "enabled"].includes(value.toLowerCase());

async function main() {
  const service = new ModelIntelligenceRegistryService(
    new YamlModelCategoryStore(process.cwd()),
    new YamlModelOverrideStore(process.cwd()),
  );
  if (command === "model:validate") {
    const result = await service.validate();
    console.log(
      `Model configuration is valid: ${result.categories.categories.length} categories, ${result.models.models.length} reviewed models.`,
    );
    return;
  }
  if (command === "model:list") {
    const { models } = await service.validate();
    console.table(
      models.models.map(
        ({
          id,
          canonicalName,
          organization,
          categories,
          lifecycle,
          enabled,
        }) => ({
          id,
          canonicalName,
          organization,
          categories: categories.join(","),
          lifecycle,
          enabled,
        }),
      ),
    );
    return;
  }
  if (command === "model-category:list") {
    const { categories } = await service.validate();
    console.table(categories.categories);
    return;
  }
  if (command === "model-category:add") {
    const id = option("id") ?? (await ask("Category ID"));
    const name = option("name") ?? (await ask("Category name"));
    const description = option("description") ?? (await ask("Description"));
    console.log(
      `Added category ${(await service.addCategory(id, name, description)).id}.`,
    );
    return;
  }
  if (command === "model:add") {
    const sourceUrl =
      option("source-url") ?? (await ask("Official source URL"));
    const externalModelId = option("external-id");
    const currentVersion = option("version");
    const releasedAt = option("released-at");
    const license = option("license");
    const notes = option("notes");
    const sourceKind = option("source-kind") ?? "announcement";
    if (
      ![
        "model-card",
        "repository",
        "announcement",
        "paper",
        "api-docs",
        "homepage",
      ].includes(sourceKind)
    )
      throw new Error(`Unsupported source kind: ${sourceKind}`);
    const model = await service.add({
      canonicalName: option("name") ?? (await ask("Canonical model name")),
      organization: option("organization") ?? (await ask("Organization")),
      categories: list(
        option("categories") ?? (await ask("Categories, comma-separated")),
      ),
      tags: list(option("tags") ?? ""),
      modalities: list(option("modalities") ?? ""),
      availability: list(
        option("availability") ??
          (await ask("Availability, comma-separated", "unknown")),
      ) as ModelAvailability[],
      ...(externalModelId ? { externalModelId } : {}),
      ...(currentVersion ? { currentVersion } : {}),
      ...(releasedAt ? { releasedAt } : {}),
      ...(license ? { license } : {}),
      links: [
        {
          kind: sourceKind as
            | "model-card"
            | "repository"
            | "announcement"
            | "paper"
            | "api-docs"
            | "homepage",
          url: sourceUrl,
        },
      ],
      ...(notes ? { notes } : {}),
    });
    console.log(`Added ${model.id}.`);
    return;
  }
  if (command === "model:edit") {
    const id = positionals[0] ?? (await ask("Model ID"));
    const update: ModelUpdate = {
      ...(option("name") ? { canonicalName: option("name")! } : {}),
      ...(option("organization")
        ? { organization: option("organization")! }
        : {}),
      ...(option("categories")
        ? { categories: list(option("categories")!) }
        : {}),
      ...(option("tags") ? { tags: list(option("tags")!) } : {}),
      ...(option("modalities")
        ? { modalities: list(option("modalities")!) }
        : {}),
      ...(option("availability")
        ? { availability: list(option("availability")!) as ModelAvailability[] }
        : {}),
      ...(option("version") ? { currentVersion: option("version")! } : {}),
      ...(option("released-at") ? { releasedAt: option("released-at")! } : {}),
      ...(option("license") ? { license: option("license")! } : {}),
      ...(option("lifecycle")
        ? {
            lifecycle: option("lifecycle") as
              "active" | "deprecated" | "retired",
          }
        : {}),
      ...(option("enabled") ? { enabled: bool(option("enabled")!) } : {}),
      ...(option("notes") ? { notes: option("notes")! } : {}),
    };
    console.log(`Updated ${(await service.update(id, update)).id}.`);
    return;
  }
  console.log(
    "Commands: model:add, model:edit ID, model:list, model:validate, model-category:list, model-category:add",
  );
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Model command failed.",
  );
  process.exitCode = 1;
});
