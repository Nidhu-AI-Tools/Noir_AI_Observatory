import type {
  ModelAvailability,
  ModelOverride,
} from "../packages/core/src/index";
import {
  ModelIntelligenceRegistryService,
  type ModelUpdate,
} from "../packages/model-intelligence/src/index";
import {
  YamlModelCategoryStore,
  YamlModelOverrideStore,
} from "../packages/storage/src/index";
import { parseIssueFormBody, requireIssueField } from "./issue-form";

const list = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
async function main() {
  const title = process.env.ISSUE_TITLE ?? "";
  const fields = parseIssueFormBody(process.env.ISSUE_BODY ?? "");
  const service = new ModelIntelligenceRegistryService(
    new YamlModelCategoryStore(process.cwd()),
    new YamlModelOverrideStore(process.cwd()),
  );
  if (title.startsWith("[Model Add]")) {
    const model = await service.add({
      canonicalName: requireIssueField(fields, "Canonical model name"),
      organization: requireIssueField(fields, "Organization"),
      categories: list(requireIssueField(fields, "Categories")),
      tags: list(fields.get("tags") ?? ""),
      modalities: list(fields.get("modalities") ?? ""),
      availability: list(
        requireIssueField(fields, "Availability"),
      ) as ModelAvailability[],
      ...(fields.get("provider model or repository id")
        ? { externalModelId: fields.get("provider model or repository id")! }
        : {}),
      ...(fields.get("version")
        ? { currentVersion: fields.get("version")! }
        : {}),
      ...(fields.get("release timestamp")
        ? { releasedAt: fields.get("release timestamp")! }
        : {}),
      ...(fields.get("published license")
        ? { license: fields.get("published license")! }
        : {}),
      links: [
        {
          kind: "announcement",
          url: requireIssueField(fields, "Official source URL"),
        },
      ],
      notes: requireIssueField(fields, "Why should this model be tracked?"),
    });
    console.log(`Prepared reviewed model ${model.id}.`);
    return;
  }
  if (title.startsWith("[Model Edit]")) {
    const update: ModelUpdate = {
      ...(fields.get("canonical model name")
        ? { canonicalName: fields.get("canonical model name")! }
        : {}),
      ...(fields.get("categories")
        ? { categories: list(fields.get("categories")!) }
        : {}),
      ...(fields.get("tags") ? { tags: list(fields.get("tags")!) } : {}),
      ...(fields.get("availability")
        ? {
            availability: list(
              fields.get("availability")!,
            ) as ModelAvailability[],
          }
        : {}),
      ...(fields.get("version")
        ? { currentVersion: fields.get("version")! }
        : {}),
      ...(fields.get("lifecycle") && fields.get("lifecycle") !== "unchanged"
        ? { lifecycle: fields.get("lifecycle") as ModelOverride["lifecycle"] }
        : {}),
    };
    console.log(
      `Prepared edit for ${(await service.update(requireIssueField(fields, "Model ID"), update)).id}.`,
    );
    return;
  }
  throw new Error("Issue title must begin with [Model Add] or [Model Edit].");
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Model request failed.",
  );
  process.exitCode = 1;
});
