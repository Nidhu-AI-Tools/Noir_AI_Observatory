import { describe, expect, it } from "vitest";

import { parseIssueFormBody, requireIssueField } from "./issue-form";

describe("parseIssueFormBody", () => {
  it("parses structured headings and normalizes empty responses", () => {
    const fields = parseIssueFormBody(`### Source type

github_repo

### Locator

qdrant/qdrant

### Display name override

_No response_
`);
    expect(requireIssueField(fields, "Source type")).toBe("github_repo");
    expect(requireIssueField(fields, "Locator")).toBe("qdrant/qdrant");
    expect(fields.get("display name override")).toBe("");
  });

  it("does not execute or reinterpret field content", () => {
    const fields = parseIssueFormBody(
      "### Tags\n\n$(touch malicious), `command`",
    );
    expect(fields.get("tags")).toBe("$(touch malicious), `command`");
  });
});
