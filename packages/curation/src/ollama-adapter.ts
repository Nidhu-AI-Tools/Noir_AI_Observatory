import {
  curationModelOutputSchema,
  type CurationConfig,
  type CurationContext,
} from "@noir/core";

import { buildCurationPrompt } from "./prompt";
import {
  buildCurationOutputJsonSchema,
  type CurationProvider,
} from "./provider";

type Fetcher = typeof fetch;

function validateLoopbackBaseUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== "/"
  )
    throw new Error(
      "Ollama base URL must be an uncredentialed loopback HTTP origin.",
    );
  return url;
}

async function responseMessage(response: Response) {
  const body = await response.text();
  if (!response.ok)
    throw new Error(
      `Ollama request failed with HTTP ${response.status}: ${body.slice(0, 500)}`,
    );
  return JSON.parse(body) as unknown;
}

export class OllamaCurationProvider implements CurationProvider {
  readonly kind = "ollama" as const;
  private readonly baseUrl: URL;

  constructor(
    readonly model: string,
    baseUrl: string,
    private readonly timeoutMs: number,
    private readonly fetcher: Fetcher = fetch,
  ) {
    this.baseUrl = validateLoopbackBaseUrl(baseUrl);
  }

  async check() {
    try {
      const response = await this.fetcher(new URL("api/tags", this.baseUrl), {
        signal: AbortSignal.timeout(Math.min(this.timeoutMs, 10_000)),
      });
      const value = (await responseMessage(response)) as {
        models?: { name?: string; model?: string }[];
      };
      const models = (value.models ?? [])
        .map((item) => item.name ?? item.model)
        .filter((item): item is string => Boolean(item));
      const installed = models.includes(this.model);
      return {
        ok: installed,
        provider: this.kind,
        detail: installed
          ? `Ollama is ready with ${this.model}.`
          : `Ollama is reachable, but ${this.model} is not installed.`,
        models,
      };
    } catch (error) {
      return {
        ok: false,
        provider: this.kind,
        detail: `Ollama is unavailable: ${error instanceof Error ? error.message : "unknown error"}`,
      };
    }
  }

  async generate(context: CurationContext, config: CurationConfig) {
    const status = await this.check();
    if (!status.ok) throw new Error(status.detail);
    const response = await this.fetcher(new URL("api/chat", this.baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(this.timeoutMs),
      body: JSON.stringify({
        model: this.model,
        stream: false,
        format: buildCurationOutputJsonSchema(context, config),
        messages: [
          {
            role: "user",
            content: buildCurationPrompt(context, config),
          },
        ],
        options: {
          temperature: config.ollama.temperature,
          num_ctx: config.ollama.contextTokens,
          num_predict: config.ollama.maxOutputTokens,
        },
      }),
    });
    const value = (await responseMessage(response)) as {
      message?: { content?: string };
    };
    if (!value.message?.content)
      throw new Error("Ollama response omitted message content.");
    return curationModelOutputSchema.parse(JSON.parse(value.message.content));
  }
}
