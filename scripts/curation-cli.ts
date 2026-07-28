import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { promisify } from "node:util";

import type { CurationProviderKind } from "../packages/core/src/index";
import {
  buildCurationContext,
  CodexCurationProvider,
  CurationService,
  OllamaCurationProvider,
  type CurationProvider,
} from "../packages/curation/src/index";
import {
  JsonlHealthCheckStore,
  JsonlModelReleaseEventStore,
  JsonlObservationStore,
  JsonlResearchItemStore,
  MarkdownCurationNoteStore,
  YamlCurationConfigStore,
  YamlMonitorRegistryStore,
} from "../packages/storage/src/index";

const argv = process.argv.slice(2);
const command = argv[0] ?? "help";

function option(name: string) {
  const index = argv.indexOf(`--${name}`);
  const value = argv[index + 1];
  return index >= 0 && value && !value.startsWith("--") ? value : undefined;
}
const flag = (name: string) => argv.includes(`--${name}`);
const execFileAsync = promisify(execFile);

async function printGitIdentity(root: string) {
  try {
    const [name, email] = await Promise.all([
      execFileAsync("git", ["config", "user.name"], { cwd: root }),
      execFileAsync("git", ["config", "user.email"], { cwd: root }),
    ]);
    console.log(`Git author: ${name.stdout.trim()} <${email.stdout.trim()}>`);
    console.log(
      "Confirm this email is connected to your GitHub account before publishing.",
    );
  } catch {
    console.log(
      "Git author is incomplete. Configure user.name and a GitHub-linked user.email before committing.",
    );
  }
}

async function contextFor(root: string, requestedDate?: string) {
  const config = await new YamlCurationConfigStore(root).read();
  const [observations, researchItems, modelEvents, healthChecks, monitors] =
    await Promise.all([
      new JsonlObservationStore(root).readAll(),
      new JsonlResearchItemStore(root).readAll(),
      new JsonlModelReleaseEventStore(root).readAll(),
      new JsonlHealthCheckStore(root).readAll(),
      new YamlMonitorRegistryStore(root).read(),
    ]);
  return {
    config,
    context: buildCurationContext(
      { observations, researchItems, modelEvents, healthChecks, monitors },
      config,
      new Date(),
      requestedDate,
    ),
  };
}

async function writeContext(root: string, date: string, value: unknown) {
  const directory = path.join(root, ".noir", "curation");
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, `${date}-context.json`);
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return file;
}

function providerFor(
  root: string,
  kind: CurationProviderKind,
  model: string | undefined,
  config: Awaited<ReturnType<YamlCurationConfigStore["read"]>>,
): CurationProvider {
  if (kind === "codex")
    return new CodexCurationProvider(root, model ?? "configured-default");
  return new OllamaCurationProvider(
    model ?? process.env.OLLAMA_MODEL ?? config.ollama.defaultModel,
    config.ollama.baseUrl,
    config.ollama.timeoutMs,
  );
}

async function confirmPublication(date: string) {
  if (flag("yes")) return;
  if (!stdin.isTTY)
    throw new Error(
      "Interactive review requires a terminal. Pass --yes only after manual review.",
    );
  const terminal = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await terminal.question(
      `Type "publish ${date}" to confirm that you checked the facts, interpretations, and source links: `,
    );
    if (answer.trim() !== `publish ${date}`)
      throw new Error("Publication was not confirmed.");
  } finally {
    terminal.close();
  }
}

async function main() {
  const root = process.cwd();
  const notes = new MarkdownCurationNoteStore(root);
  const requestedDate = option("date");

  if (command === "curation:prepare") {
    const { context } = await contextFor(root, requestedDate);
    const file = await writeContext(root, context.date, context);
    console.log(
      `Prepared ${context.candidates.length} candidates in ${path.relative(root, file)}.`,
    );
    return;
  }

  if (command === "curation:doctor") {
    const config = await new YamlCurationConfigStore(root).read();
    const kind = (option("provider") ??
      config.provider.default) as CurationProviderKind;
    if (!(["ollama", "codex"] as string[]).includes(kind))
      throw new Error(`Unsupported curation provider: ${kind}`);
    const status = await providerFor(
      root,
      kind,
      option("model"),
      config,
    ).check();
    console.log(status.detail);
    if (status.models?.length)
      console.log(`Installed Ollama models: ${status.models.join(", ")}`);
    await printGitIdentity(root);
    if (!status.ok) process.exitCode = 1;
    return;
  }

  if (command === "curation:daily") {
    const { config, context } = await contextFor(root, requestedDate);
    const current = await notes.read(context.date);
    if (current?.status === "published")
      throw new Error(
        `Published curation note ${context.date} already exists.`,
      );
    if (current && !flag("overwrite"))
      throw new Error(
        `Draft ${context.date} already exists. Pass --overwrite to deliberately replace it.`,
      );
    const contextFile = await writeContext(root, context.date, context);
    if (context.candidates.length === 0) {
      console.log(
        `No suitable candidates were found. Context written to ${path.relative(root, contextFile)}.`,
      );
      return;
    }
    const kind = (option("provider") ??
      config.provider.default) as CurationProviderKind;
    if (!(["ollama", "codex"] as string[]).includes(kind))
      throw new Error(`Unsupported curation provider: ${kind}`);
    const provider = providerFor(root, kind, option("model"), config);
    const note = await new CurationService().draft(context, config, provider);
    await notes.write(note, { overwrite: flag("overwrite") });
    console.log(
      `Created ${kind} draft with ${note.highlights.length} highlights: data/curation/${context.date.replaceAll("-", "/")}.md`,
    );
    console.log(
      `Review it, then run: corepack pnpm curation:publish -- --date ${context.date}`,
    );
    return;
  }

  if (command === "curation:validate") {
    const values = await notes.readAll();
    console.log(
      `Curation data is valid: ${values.length} notes, ${values.filter((note) => note.status === "published").length} published.`,
    );
    return;
  }

  if (command === "curation:status") {
    const date = requestedDate ?? new Date().toISOString().slice(0, 10);
    const note = await notes.read(date);
    console.log(note ? `${date}: ${note.status}` : `${date}: no note`);
    return;
  }

  if (command === "curation:render") {
    const date = requestedDate ?? new Date().toISOString().slice(0, 10);
    const note = await notes.rerender(date);
    console.log(
      `Rendered ${date} from validated frontmatter with ${note.highlights.length} highlights.`,
    );
    return;
  }

  if (command === "curation:publish") {
    const date = requestedDate ?? new Date().toISOString().slice(0, 10);
    const note = await notes.read(date);
    if (!note) throw new Error(`No curation draft exists for ${date}.`);
    if (note.status === "published") {
      console.log(`${date} is already published.`);
      return;
    }
    await confirmPublication(date);
    const published = new CurationService().publish(note);
    await notes.write(published, { overwrite: true });
    console.log(
      `Published ${date} locally after validating ${published.highlights.length} evidence links.`,
    );
    console.log(
      "Review git diff, then commit data/curation with your GitHub-linked identity.",
    );
    return;
  }

  console.log(
    "Commands: curation:doctor, curation:prepare, curation:daily, curation:render, curation:status, curation:validate, curation:publish",
  );
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Curation command failed.",
  );
  process.exitCode = 1;
});
