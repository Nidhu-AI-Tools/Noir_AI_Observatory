/* eslint-disable @typescript-eslint/no-explicit-any -- provider payloads are validated after transport normalization */
import {
  ecosystemClassificationSchema,
  type EcosystemClassification,
  type ModelProfile,
  type ModelProvider,
} from "@noir/core";

import { classificationJsonSchema } from "./prompt";

export interface ProviderExecution {
  status:
    | "success"
    | "refusal"
    | "timeout"
    | "rate-limited"
    | "incomplete"
    | "schema-invalid"
    | "provider-error";
  returnedModel?: string;
  providerResponseId?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cachedInputTokens?: number;
    reasoningTokens?: number;
    totalTokens?: number;
  };
  output?: EcosystemClassification;
  rawOutput?: string;
  errorCode?: string;
  errorMessage?: string;
}

export type ModelFetch = (
  input: string,
  init: RequestInit,
) => Promise<Response>;
export interface ProviderAdapter {
  provider: ModelProvider;
  execute(
    prompt: string,
    profile: ModelProfile,
    apiKey: string,
  ): Promise<ProviderExecution>;
}

function safeError(value: unknown) {
  return (value instanceof Error ? value.message : "Provider request failed")
    .replace(
      /(Bearer|api[-_]?key|token)\s*[:=]?\s*[A-Za-z0-9._-]+/gi,
      "$1 [redacted]",
    )
    .slice(0, 500);
}
function parseOutput(
  raw: string,
): Pick<
  ProviderExecution,
  "status" | "output" | "rawOutput" | "errorCode" | "errorMessage"
> {
  try {
    const parsed = ecosystemClassificationSchema.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return {
        status: "schema-invalid",
        rawOutput: raw.slice(0, 20_000),
        errorCode: "schema-invalid",
        errorMessage: parsed.error.message.slice(0, 500),
      };
    return {
      status: "success",
      output: parsed.data,
      rawOutput: raw.slice(0, 20_000),
    };
  } catch (error) {
    return {
      status: "schema-invalid",
      rawOutput: raw.slice(0, 20_000),
      errorCode: "invalid-json",
      errorMessage: safeError(error),
    };
  }
}
async function request(
  fetcher: ModelFetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
) {
  try {
    return await fetcher(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const message = safeError(error);
    return {
      error: {
        status: message.toLowerCase().includes("timeout")
          ? ("timeout" as const)
          : ("provider-error" as const),
        errorCode: "network",
        errorMessage: message,
      },
    };
  }
}
async function bodyOrError(
  response: Response,
): Promise<{ json?: any; error?: ProviderExecution }> {
  const text = await response.text();
  if (!response.ok)
    return {
      error: {
        status: response.status === 429 ? "rate-limited" : "provider-error",
        errorCode: `http-${response.status}`,
        errorMessage: text.slice(0, 500),
      },
    };
  try {
    return { json: JSON.parse(text) };
  } catch {
    return {
      error: {
        status: "provider-error",
        errorCode: "invalid-provider-json",
        errorMessage: "Provider returned invalid JSON.",
      },
    };
  }
}

abstract class HttpAdapter implements ProviderAdapter {
  abstract provider: ModelProvider;
  constructor(protected readonly fetcher: ModelFetch = fetch) {}
  abstract execute(
    prompt: string,
    profile: ModelProfile,
    apiKey: string,
  ): Promise<ProviderExecution>;
}

export class OpenAIAdapter extends HttpAdapter {
  provider = "openai" as const;
  async execute(prompt: string, profile: ModelProfile, apiKey: string) {
    const result = await request(
      this.fetcher,
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: profile.model,
          input: prompt,
          store: false,
          max_output_tokens: profile.maxOutputTokens,
          text: {
            format: {
              type: "json_schema",
              name: "ecosystem_classification",
              strict: true,
              schema: classificationJsonSchema,
            },
          },
        }),
      },
      profile.timeoutMs,
    );
    if ("error" in result) return result.error;
    const body = await bodyOrError(result);
    if (body.error) return body.error;
    const json = body.json;
    const content = (json.output ?? []).flatMap(
      (item: any) => item.content ?? [],
    );
    const refusal = content.find((item: any) => item.type === "refusal");
    if (refusal)
      return {
        status: "refusal" as const,
        returnedModel: json.model,
        providerResponseId: json.id,
        errorMessage: String(refusal.refusal ?? "Model refused.").slice(0, 500),
      };
    if (json.status !== "completed")
      return {
        status: "incomplete" as const,
        returnedModel: json.model,
        providerResponseId: json.id,
        errorCode: json.status ?? "incomplete",
      };
    const raw = content
      .filter((item: any) => item.type === "output_text")
      .map((item: any) => item.text ?? "")
      .join("");
    return {
      ...parseOutput(raw),
      returnedModel: json.model,
      providerResponseId: json.id,
      usage: {
        inputTokens: json.usage?.input_tokens,
        outputTokens: json.usage?.output_tokens,
        cachedInputTokens: json.usage?.input_tokens_details?.cached_tokens,
        reasoningTokens: json.usage?.output_tokens_details?.reasoning_tokens,
        totalTokens: json.usage?.total_tokens,
      },
    };
  }
}

export class AnthropicAdapter extends HttpAdapter {
  provider = "anthropic" as const;
  async execute(prompt: string, profile: ModelProfile, apiKey: string) {
    const result = await request(
      this.fetcher,
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: profile.model,
          max_tokens: profile.maxOutputTokens,
          messages: [{ role: "user", content: prompt }],
          output_config: {
            format: { type: "json_schema", schema: classificationJsonSchema },
          },
        }),
      },
      profile.timeoutMs,
    );
    if ("error" in result) return result.error;
    const body = await bodyOrError(result);
    if (body.error) return body.error;
    const json = body.json;
    if (json.stop_reason === "refusal")
      return {
        status: "refusal" as const,
        returnedModel: json.model,
        providerResponseId: json.id,
        errorMessage: "Model refused.",
      };
    if (json.stop_reason === "max_tokens")
      return {
        status: "incomplete" as const,
        returnedModel: json.model,
        providerResponseId: json.id,
        errorCode: "max-tokens",
      };
    const raw = (json.content ?? [])
      .filter((item: any) => item.type === "text")
      .map((item: any) => item.text ?? "")
      .join("");
    return {
      ...parseOutput(raw),
      returnedModel: json.model,
      providerResponseId: json.id,
      usage: {
        inputTokens: json.usage?.input_tokens,
        outputTokens: json.usage?.output_tokens,
        cachedInputTokens: json.usage?.cache_read_input_tokens,
        totalTokens:
          (json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0),
      },
    };
  }
}

export class GoogleAdapter extends HttpAdapter {
  provider = "google" as const;
  async execute(prompt: string, profile: ModelProfile, apiKey: string) {
    const model = encodeURIComponent(profile.model);
    const result = await request(
      this.fetcher,
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: profile.maxOutputTokens,
            responseMimeType: "application/json",
            responseSchema: classificationJsonSchema,
          },
        }),
      },
      profile.timeoutMs,
    );
    if ("error" in result) return result.error;
    const body = await bodyOrError(result);
    if (body.error) return body.error;
    const json = body.json;
    const candidate = json.candidates?.[0];
    if (!candidate)
      return {
        status: "refusal" as const,
        returnedModel: profile.model,
        errorMessage:
          json.promptFeedback?.blockReason ?? "No candidate returned.",
      };
    if (
      ["MAX_TOKENS", "SAFETY", "RECITATION", "BLOCKLIST"].includes(
        candidate.finishReason,
      )
    )
      return {
        status:
          candidate.finishReason === "MAX_TOKENS"
            ? ("incomplete" as const)
            : ("refusal" as const),
        returnedModel: profile.model,
        errorCode: String(candidate.finishReason).toLowerCase(),
      };
    const raw = (candidate.content?.parts ?? [])
      .map((item: any) => item.text ?? "")
      .join("");
    const usage = json.usageMetadata;
    return {
      ...parseOutput(raw),
      returnedModel: profile.model,
      usage: {
        inputTokens: usage?.promptTokenCount,
        outputTokens: usage?.candidatesTokenCount,
        cachedInputTokens: usage?.cachedContentTokenCount,
        reasoningTokens: usage?.thoughtsTokenCount,
        totalTokens: usage?.totalTokenCount,
      },
    };
  }
}

export class ModelProviderRegistry {
  private readonly values = new Map<ModelProvider, ProviderAdapter>();
  constructor(
    adapters: ProviderAdapter[] = [
      new OpenAIAdapter(),
      new AnthropicAdapter(),
      new GoogleAdapter(),
    ],
  ) {
    for (const adapter of adapters) this.values.set(adapter.provider, adapter);
  }
  get(provider: ModelProvider) {
    const adapter = this.values.get(provider);
    if (!adapter) throw new Error(`No Model Lab adapter for ${provider}.`);
    return adapter;
  }
}

export const providerSecretNames: Record<ModelProvider, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GEMINI_API_KEY",
};
