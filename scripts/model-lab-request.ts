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
import { parseIssueFormBody, requireIssueField } from "./issue-form";

function boolean(value: string) {
  return ["true", "yes", "enabled", "1"].includes(value.toLowerCase());
}
async function main() {
  const title = process.env.ISSUE_TITLE ?? "";
  const fields = parseIssueFormBody(process.env.ISSUE_BODY ?? "");
  const root = process.cwd();
  const service = new ModelLabRegistryService(
    new YamlModelLabConfigStore(root),
    new YamlBenchmarkSuiteStore(root),
    new YamlBenchmarkCaseStore(root),
  );
  if (title.startsWith("[Model Add]")) {
    const candidate: ModelProfileCandidate = {
      provider: requireIssueField(
        fields,
        "Provider",
      ) as ModelProfileCandidate["provider"],
      displayName: requireIssueField(fields, "Display name"),
      model: requireIssueField(fields, "Provider model ID"),
      timeoutMs: Number(requireIssueField(fields, "Timeout milliseconds")),
      maxOutputTokens: Number(
        requireIssueField(fields, "Maximum output tokens"),
      ),
      enabled: true,
    };
    console.log(
      `Prepared model profile ${(await service.add(candidate)).id}. No provider call was made.`,
    );
    return;
  }
  if (title.startsWith("[Model Edit]")) {
    const status = requireIssueField(fields, "Status").toLowerCase();
    const update: ModelProfileUpdate = {
      ...(fields.get("display name")
        ? { displayName: fields.get("display name")! }
        : {}),
      ...(fields.get("provider model id")
        ? { model: fields.get("provider model id")! }
        : {}),
      ...(fields.get("timeout milliseconds")
        ? { timeoutMs: Number(fields.get("timeout milliseconds")) }
        : {}),
      ...(fields.get("maximum output tokens")
        ? { maxOutputTokens: Number(fields.get("maximum output tokens")) }
        : {}),
      ...(status === "unchanged" ? {} : { enabled: boolean(status) }),
    };
    console.log(
      `Prepared model profile edit ${(await service.update(requireIssueField(fields, "Model profile ID"), update)).id}.`,
    );
    return;
  }
  throw new Error("Issue title must begin with [Model Add] or [Model Edit].");
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Model profile request failed.",
  );
  process.exitCode = 1;
});
