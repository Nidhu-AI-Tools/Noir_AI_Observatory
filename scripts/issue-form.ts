export type IssueFields = Map<string, string>;

function normalizeHeading(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeResponse(value: string): string {
  const trimmed = value.trim();
  return trimmed === "_No response_" ? "" : trimmed;
}

export function parseIssueFormBody(body: string): IssueFields {
  const headings = [...body.matchAll(/^###\s+(.+)$/gm)];
  const fields = new Map<string, string>();

  headings.forEach((heading, index) => {
    const name = heading[1];
    if (!name || heading.index === undefined) return;
    const valueStart = heading.index + heading[0].length;
    const valueEnd = headings[index + 1]?.index ?? body.length;
    fields.set(
      normalizeHeading(name),
      normalizeResponse(body.slice(valueStart, valueEnd)),
    );
  });
  return fields;
}

export function requireIssueField(fields: IssueFields, name: string): string {
  const value = fields.get(normalizeHeading(name));
  if (!value) {
    throw new Error(`Issue form is missing required field: ${name}`);
  }
  return value;
}
