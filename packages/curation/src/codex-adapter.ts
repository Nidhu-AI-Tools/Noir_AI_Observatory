import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  curationModelOutputSchema,
  type CurationConfig,
  type CurationContext,
} from "@noir/core";

import { buildCurationPrompt } from "./prompt";
import { CURATION_OUTPUT_JSON_SCHEMA, type CurationProvider } from "./provider";

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (
  command: string,
  args: string[],
  options?: { cwd?: string; stdin?: string; timeoutMs?: number },
) => Promise<CommandResult>;

export const runCommand: CommandRunner = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(
        new Error(
          `Command timed out after ${options.timeoutMs ?? 300_000} ms.`,
        ),
      );
    }, options.timeoutMs ?? 300_000);
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ code: code ?? 1, stdout, stderr });
    });
    child.stdin.end(options.stdin ?? "");
  });

export class CodexCurationProvider implements CurationProvider {
  readonly kind = "codex" as const;

  constructor(
    private readonly root: string,
    readonly model = "configured-default",
    private readonly runner: CommandRunner = runCommand,
  ) {}

  async check() {
    try {
      const result = await this.runner("codex", ["--version"], {
        cwd: this.root,
        timeoutMs: 10_000,
      });
      return {
        ok: result.code === 0,
        provider: this.kind,
        detail:
          result.code === 0
            ? `Codex is ready: ${result.stdout.trim() || "version detected"}.`
            : `Codex check failed: ${result.stderr.trim() || `exit ${result.code}`}`,
      };
    } catch (error) {
      return {
        ok: false,
        provider: this.kind,
        detail: `Codex is unavailable: ${error instanceof Error ? error.message : "unknown error"}`,
      };
    }
  }

  async generate(context: CurationContext, config: CurationConfig) {
    const directory = await mkdtemp(
      path.join(tmpdir(), "noir-curation-codex-"),
    );
    const schemaFile = path.join(directory, "output-schema.json");
    const outputFile = path.join(directory, "response.json");
    try {
      await writeFile(
        schemaFile,
        JSON.stringify(CURATION_OUTPUT_JSON_SCHEMA),
        "utf8",
      );
      const args = [
        "exec",
        "--ephemeral",
        "--sandbox",
        "read-only",
        "--output-schema",
        schemaFile,
        "--output-last-message",
        outputFile,
        "--cd",
        this.root,
      ];
      if (this.model !== "configured-default") args.push("--model", this.model);
      args.push("-");
      const result = await this.runner("codex", args, {
        cwd: this.root,
        stdin: buildCurationPrompt(context, config),
        timeoutMs: 600_000,
      });
      if (result.code !== 0)
        throw new Error(
          `Codex generation failed: ${(result.stderr || result.stdout).trim().slice(0, 1_000)}`,
        );
      return curationModelOutputSchema.parse(
        JSON.parse(await readFile(outputFile, "utf8")),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
