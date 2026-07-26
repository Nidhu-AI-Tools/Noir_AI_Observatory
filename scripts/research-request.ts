import type {
  ResearchSourceCandidate,
  ResearchSourceUpdate,
} from "../packages/core/src/index";
import {
  ResearchAdapterRegistry,
  ResearchRegistryService,
} from "../packages/research/src/index";
import { YamlResearchRegistryStore } from "../packages/storage/src/index";
import { parseIssueFormBody, requireIssueField } from "./issue-form";

function list(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
async function main() {
  const title = process.env.ISSUE_TITLE ?? "";
  const body = process.env.ISSUE_BODY ?? "";
  if (!body) throw new Error("ISSUE_BODY is required.");
  const fields = parseIssueFormBody(body);
  const service = new ResearchRegistryService(
    new YamlResearchRegistryStore(process.cwd()),
  );
  if (title.startsWith("[Research Add]")) {
    const kind = requireIssueField(
      fields,
      "Source type",
    ) as ResearchSourceCandidate["kind"];
    const common = {
      displayName: requireIssueField(fields, "Display name"),
      category: requireIssueField(fields, "Category"),
      tags: list(requireIssueField(fields, "Tags")),
      weight: Number(requireIssueField(fields, "Source weight")),
    };
    const candidate: ResearchSourceCandidate =
      kind === "arxiv_query"
        ? { kind, ...common, query: requireIssueField(fields, "arXiv query") }
        : {
            kind: "rss_feed",
            ...common,
            url: requireIssueField(fields, "Public HTTPS feed URL"),
            publisher: requireIssueField(fields, "Publisher"),
          };
    const source = await service.add(candidate);
    const now = new Date();
    const items = await new ResearchAdapterRegistry()
      .get(source.kind)
      .collect(source, {
        since: new Date(now.valueOf() - 7 * 86_400_000),
        now,
        maxItems: 5,
      });
    console.log(
      `Prepared ${source.id}; dry check parsed ${items.length} recent items.`,
    );
    return;
  }
  if (title.startsWith("[Research Edit]")) {
    const status = requireIssueField(fields, "Status").toLowerCase();
    const update: ResearchSourceUpdate = {
      ...(fields.get("display name")
        ? { displayName: fields.get("display name")! }
        : {}),
      ...(fields.get("arxiv query")
        ? { query: fields.get("arxiv query")! }
        : {}),
      ...(fields.get("public https feed url")
        ? { url: fields.get("public https feed url")! }
        : {}),
      ...(fields.get("publisher")
        ? { publisher: fields.get("publisher")! }
        : {}),
      ...(fields.get("category") ? { category: fields.get("category")! } : {}),
      ...(fields.get("tags") ? { tags: list(fields.get("tags") ?? "") } : {}),
      ...(fields.get("source weight") &&
      fields.get("source weight") !== "unchanged"
        ? { weight: Number(fields.get("source weight")) }
        : {}),
      ...(status === "unchanged" ? {} : { enabled: status === "enabled" }),
    };
    const updated = await service.update(
      requireIssueField(fields, "Research source ID"),
      update,
    );
    console.log(`Prepared research source edit: ${updated.id}`);
    return;
  }
  throw new Error(
    "Issue title must begin with [Research Add] or [Research Edit].",
  );
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Research request failed.",
  );
  process.exitCode = 1;
});
