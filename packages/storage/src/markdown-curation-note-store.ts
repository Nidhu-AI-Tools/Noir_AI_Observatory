import { readFile } from "node:fs/promises";
import path from "node:path";

import { curationNoteSchema, type CurationNote } from "@noir/core";
import { parse, stringify } from "yaml";

import type { CurationNoteStore } from "./curation-store";
import { atomicWrite } from "./generated/atomic-write";
import { findFiles } from "./generated/file-discovery";

const marker = "---";

function renderBody(note: CurationNote) {
  const highlights = note.highlights
    .map(
      (highlight) =>
        `## ${highlight.title}\n\n${highlight.summary}\n\n**Why it matters:** ${highlight.whyItMatters}\n\n[Source](${highlight.sourceUrl})`,
    )
    .join("\n\n");
  const caveats = note.caveats.length
    ? `\n\n## Caveats\n\n${note.caveats.map((item) => `- ${item}`).join("\n")}`
    : "";
  return `# ${note.headline}\n\n${note.summary}\n\n${highlights}${caveats}\n`;
}

export function renderCurationNote(note: CurationNote) {
  const validated = curationNoteSchema.parse(note);
  const frontmatter = stringify(validated, {
    indent: 2,
    lineWidth: 0,
    sortMapEntries: false,
  }).trimEnd();
  return `${marker}\n${frontmatter}\n${marker}\n\n${renderBody(validated)}`;
}

export function parseCurationFrontmatter(
  value: string,
  file = "curation note",
) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(value);
  if (!match?.[1]) throw new Error(`${file} is missing YAML frontmatter.`);
  return curationNoteSchema.parse(parse(match[1]));
}

export function parseCurationNote(value: string, file = "curation note") {
  const note = parseCurationFrontmatter(value, file);
  if (renderCurationNote(note) !== value.replaceAll("\r\n", "\n"))
    throw new Error(`${file} does not match its structured frontmatter.`);
  return note;
}

function fileFor(root: string, date: string) {
  const [year, month, day] = date.split("-");
  return path.join(
    root,
    "data",
    "curation",
    year ?? "unknown",
    month ?? "unknown",
    `${day ?? "unknown"}.md`,
  );
}

export class MarkdownCurationNoteStore implements CurationNoteStore {
  private readonly directory: string;

  constructor(private readonly root: string) {
    this.directory = path.join(root, "data", "curation");
  }

  async read(date: string) {
    try {
      const file = fileFor(this.root, date);
      return parseCurationNote(await readFile(file, "utf8"), file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async readAll() {
    const values = await Promise.all(
      (await findFiles(this.directory, ".md")).map(async (file) =>
        parseCurationNote(await readFile(file, "utf8"), file),
      ),
    );
    return values.sort((left, right) => right.date.localeCompare(left.date));
  }

  async write(note: CurationNote, options: { overwrite?: boolean } = {}) {
    const validated = curationNoteSchema.parse(note);
    const current = await this.read(validated.date);
    if (current?.status === "published")
      throw new Error(
        `Published curation note ${validated.date} is immutable.`,
      );
    if (current && !options.overwrite)
      throw new Error(
        `Curation note ${validated.date} already exists. Pass --overwrite to replace its draft.`,
      );
    await atomicWrite(
      fileFor(this.root, validated.date),
      renderCurationNote(validated),
    );
  }

  async rerender(date: string) {
    const file = fileFor(this.root, date);
    const note = parseCurationFrontmatter(await readFile(file, "utf8"), file);
    if (note.status === "published")
      throw new Error(`Published curation note ${date} is immutable.`);
    await atomicWrite(file, renderCurationNote(note));
    return note;
  }
}
