import { SOURCE_KINDS, type SourceKind } from "../packages/core/src/index";
import { SourceAdapterRegistry } from "../packages/collectors/src/index";
import {
  RegistryService,
  YamlRegistryStore,
} from "../packages/storage/src/index";
import { parseIssueFormBody, requireIssueField } from "./issue-form";

function tags(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function main(): Promise<void> {
  const title = process.env.ISSUE_TITLE ?? "";
  const body = process.env.ISSUE_BODY ?? "";
  if (!body) throw new Error("ISSUE_BODY is required.");

  const fields = parseIssueFormBody(body);
  const service = new RegistryService(new YamlRegistryStore(process.cwd()));

  if (title.startsWith("[Source Add]")) {
    const kindInput = requireIssueField(fields, "Source type");
    if (!SOURCE_KINDS.includes(kindInput as SourceKind)) {
      throw new Error(`Unknown source type: ${kindInput}`);
    }
    const kind = kindInput as SourceKind;
    const locator = requireIssueField(fields, "Locator");
    const resolved = await new SourceAdapterRegistry()
      .get(kind)
      .resolve(locator, {
        ...(process.env.GITHUB_TOKEN
          ? { githubToken: process.env.GITHUB_TOKEN }
          : {}),
        ...(process.env.HF_TOKEN
          ? { huggingFaceToken: process.env.HF_TOKEN }
          : {}),
      });
    const displayName = fields.get("display name override");
    const description = fields.get("description override");
    const source = await service.addSource(
      {
        kind,
        locator,
        categoryId: requireIssueField(fields, "Category ID"),
        tags: tags(requireIssueField(fields, "Tags")),
        ...(displayName ? { displayName } : {}),
        ...(description ? { description } : {}),
      },
      resolved,
    );
    console.log(`Prepared source addition: ${source.id}`);
    return;
  }

  if (title.startsWith("[Source Edit]")) {
    const sourceId = requireIssueField(fields, "Source ID");
    const status = requireIssueField(fields, "Status").toLowerCase();
    const displayName = fields.get("display name");
    const categoryId = fields.get("category id");
    const tagList = fields.get("tags");
    const description = fields.get("description");
    const updated = await service.updateSource(sourceId, {
      ...(displayName ? { displayName } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(tagList ? { tags: tags(tagList) } : {}),
      ...(description ? { description } : {}),
      ...(status === "unchanged" ? {} : { enabled: status === "enabled" }),
    });
    console.log(`Prepared source edit: ${updated.id}`);
    return;
  }

  throw new Error("Issue title must begin with [Source Add] or [Source Edit].");
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Unexpected source request error.",
  );
  process.exitCode = 1;
});
