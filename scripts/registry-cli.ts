import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import {
  SOURCE_KINDS,
  type SourceCandidate,
  type SourceKind,
} from "../packages/core/src/index";
import { SourceAdapterRegistry } from "../packages/collectors/src/index";
import {
  RegistryService,
  YamlRegistryStore,
} from "../packages/storage/src/index";

interface ParsedArguments {
  command: string;
  positionals: string[];
  options: Map<string, string>;
}

function parseArguments(argv: string[]): ParsedArguments {
  const [command = "help", ...rest] = argv;
  const positionals: string[] = [];
  const options = new Map<string, string>();
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (value?.startsWith("--")) {
      const optionValue = rest[index + 1];
      if (!optionValue || optionValue.startsWith("--")) {
        options.set(value.slice(2), "true");
      } else {
        options.set(value.slice(2), optionValue);
        index += 1;
      }
    } else if (value) {
      positionals.push(value);
    }
  }
  return { command, positionals, options };
}

async function ask(prompt: string, fallback?: string): Promise<string> {
  const terminal = createInterface({ input, output });
  const suffix = fallback ? ` [${fallback}]` : "";
  const answer = (await terminal.question(`${prompt}${suffix}: `)).trim();
  terminal.close();
  return answer || fallback || "";
}

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseBoolean(value: string): boolean {
  return ["1", "true", "yes", "enabled"].includes(value.trim().toLowerCase());
}

function credentials() {
  return {
    ...(process.env.GITHUB_TOKEN
      ? { githubToken: process.env.GITHUB_TOKEN }
      : {}),
    ...(process.env.HF_TOKEN ? { huggingFaceToken: process.env.HF_TOKEN } : {}),
  };
}

async function main(): Promise<void> {
  const parsed = parseArguments(process.argv.slice(2));
  const service = new RegistryService(new YamlRegistryStore(process.cwd()));
  const adapters = new SourceAdapterRegistry();

  switch (parsed.command) {
    case "registry:validate": {
      const snapshot = await service.validate();
      console.log(
        `Registry is valid: ${snapshot.registry.sources.length} sources, ${snapshot.taxonomy.categories.length} categories.`,
      );
      return;
    }
    case "source:list": {
      const snapshot = await service.snapshot();
      if (snapshot.registry.sources.length === 0) {
        console.log("No sources are configured.");
        return;
      }
      console.table(
        snapshot.registry.sources.map((source) => ({
          id: source.id,
          type: source.kind,
          locator: source.locator,
          category: source.categoryId,
          tags: source.tags.join(", "),
          enabled: source.enabled,
        })),
      );
      return;
    }
    case "source:add": {
      const kindInput =
        parsed.options.get("kind") ??
        (await ask(`Source kind (${SOURCE_KINDS.join(" | ")})`, "github_repo"));
      if (!SOURCE_KINDS.includes(kindInput as SourceKind)) {
        throw new Error(`Unknown source kind: ${kindInput}`);
      }
      const kind = kindInput as SourceKind;
      const locator =
        parsed.options.get("locator") ??
        (await ask("Repository or organization"));
      const snapshot = await service.snapshot();
      console.log(
        `Categories: ${snapshot.taxonomy.categories.map((category) => category.id).join(", ")}`,
      );
      const categoryId =
        parsed.options.get("category") ?? (await ask("Category ID"));
      const tags = parseTags(
        parsed.options.get("tags") ?? (await ask("Tags, comma-separated")),
      );
      const resolved = await adapters.get(kind).resolve(locator, credentials());
      console.log(
        `Resolved: ${resolved.displayName} (${resolved.externalUrl})`,
      );
      resolved.warnings.forEach((warning) =>
        console.warn(`Warning: ${warning}`),
      );
      const displayName = parsed.options.get("display-name");
      const description = parsed.options.get("description");
      const candidate: SourceCandidate = {
        kind,
        locator,
        categoryId,
        tags,
        ...(displayName ? { displayName } : {}),
        ...(description ? { description } : {}),
      };
      const source = await service.addSource(candidate, resolved);
      console.log(`Added ${source.id}.`);
      return;
    }
    case "source:edit": {
      const id = parsed.positionals[0] ?? (await ask("Source ID"));
      const snapshot = await service.snapshot();
      const source = snapshot.registry.sources.find(
        (candidate) => candidate.id === id,
      );
      if (!source) throw new Error(`Unknown source: ${id}`);
      const interactive = parsed.options.size === 0;
      const displayName = interactive
        ? await ask("Display name", source.displayName)
        : parsed.options.get("display-name");
      const categoryId = interactive
        ? await ask("Category ID", source.categoryId)
        : parsed.options.get("category");
      const tagText = interactive
        ? await ask("Tags, comma-separated", source.tags.join(", "))
        : parsed.options.get("tags");
      const description = interactive
        ? await ask("Description", source.description ?? "")
        : parsed.options.get("description");
      const enabledText = interactive
        ? await ask("Enabled (yes/no)", source.enabled ? "yes" : "no")
        : parsed.options.get("enabled");
      const updated = await service.updateSource(id, {
        ...(displayName === undefined ? {} : { displayName }),
        ...(categoryId === undefined ? {} : { categoryId }),
        ...(tagText === undefined ? {} : { tags: parseTags(tagText) }),
        ...(description === undefined
          ? {}
          : { description: description || null }),
        ...(enabledText === undefined
          ? {}
          : { enabled: parseBoolean(enabledText) }),
      });
      console.log(`Updated ${updated.id}.`);
      return;
    }
    case "source:check": {
      const id = parsed.positionals[0] ?? (await ask("Source ID"));
      const source = (await service.snapshot()).registry.sources.find(
        (candidate) => candidate.id === id,
      );
      if (!source) throw new Error(`Unknown source: ${id}`);
      const resolved = await adapters
        .get(source.kind)
        .resolve(source.locator, credentials());
      console.log(`Valid: ${resolved.displayName} (${resolved.externalUrl})`);
      resolved.warnings.forEach((warning) =>
        console.warn(`Warning: ${warning}`),
      );
      return;
    }
    case "source:disable":
    case "source:enable": {
      const id = parsed.positionals[0] ?? (await ask("Source ID"));
      const source = await service.setSourceEnabled(
        id,
        parsed.command === "source:enable",
      );
      console.log(
        `${source.id} is now ${source.enabled ? "enabled" : "disabled"}.`,
      );
      return;
    }
    case "category:add": {
      const name = parsed.options.get("name") ?? (await ask("Category name"));
      const description =
        parsed.options.get("description") ??
        (await ask("Description (optional)"));
      const category = await service.addCategory({
        name,
        ...(description ? { description } : {}),
      });
      console.log(`Added category ${category.id}.`);
      return;
    }
    case "category:edit": {
      const id = parsed.positionals[0] ?? (await ask("Category ID"));
      const snapshot = await service.snapshot();
      const category = snapshot.taxonomy.categories.find(
        (candidate) => candidate.id === id,
      );
      if (!category) throw new Error(`Unknown category: ${id}`);
      const name =
        parsed.options.get("name") ??
        (await ask("Category name", category.name));
      const description =
        parsed.options.get("description") ??
        (await ask("Description", category.description ?? ""));
      const updated = await service.updateCategory(id, {
        name,
        description: description || null,
      });
      console.log(`Updated category ${updated.id}.`);
      return;
    }
    default:
      console.log(`Noir AI Observatory registry commands:
  source:add [--kind KIND --locator LOCATOR --category ID --tags TAGS]
  source:edit [ID] [--display-name NAME --category ID --tags TAGS --enabled BOOL]
  source:list
  source:check [ID]
  source:enable [ID]
  source:disable [ID]
  category:add [--name NAME --description TEXT]
  category:edit [ID] [--name NAME --description TEXT]
  registry:validate`);
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Unexpected registry error.",
  );
  process.exitCode = 1;
});
