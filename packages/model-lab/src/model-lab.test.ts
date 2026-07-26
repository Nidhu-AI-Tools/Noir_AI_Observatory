import type { BenchmarkCase, ModelLabResponse, ModelProfile } from "@noir/core";
import { describe, expect, it } from "vitest";

import {
  AnthropicAdapter,
  GoogleAdapter,
  OpenAIAdapter,
  type ModelFetch,
  type ProviderExecution,
} from "./adapters";
import { sha256 } from "./hash";
import { calculateConsensus } from "./scoring";

const output = {
  contentType: "tool-release" as const,
  lifecycleEvent: "new-release" as const,
  domains: ["vector-search" as const],
  entities: [{ name: "NoirVector", type: "tool" as const }],
  evidence: [{ field: "domains" as const, quote: "vector search" }],
};
const profile: ModelProfile = {
  id: "test-model",
  provider: "openai",
  displayName: "Test",
  model: "test-1",
  timeoutMs: 5_000,
  maxOutputTokens: 256,
  enabled: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const fixture =
  (value: unknown): ModelFetch =>
  async () =>
    new Response(JSON.stringify(value), { status: 200 });

describe("provider normalization", () => {
  it("normalizes OpenAI Responses output", async () => {
    const result: ProviderExecution = await new OpenAIAdapter(
      fixture({
        id: "r1",
        model: "test-1",
        status: "completed",
        output: [
          { content: [{ type: "output_text", text: JSON.stringify(output) }] },
        ],
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      }),
    ).execute("prompt", profile, "secret");
    expect(result.status).toBe("success");
    expect(result.output).toEqual(output);
  });
  it("normalizes Anthropic Messages output", async () => {
    const result: ProviderExecution = await new AnthropicAdapter(
      fixture({
        id: "m1",
        model: "test-1",
        stop_reason: "end_turn",
        content: [{ type: "text", text: JSON.stringify(output) }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    ).execute("prompt", { ...profile, provider: "anthropic" }, "secret");
    expect(result.status).toBe("success");
    expect(result.usage?.totalTokens).toBe(15);
  });
  it("normalizes Google generateContent output", async () => {
    const result: ProviderExecution = await new GoogleAdapter(
      fixture({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: JSON.stringify(output) }] },
          },
        ],
        usageMetadata: { totalTokenCount: 15 },
      }),
    ).execute("prompt", { ...profile, provider: "google" }, "secret");
    expect(result.status).toBe("success");
    expect(result.output).toEqual(output);
  });
  it("rejects provider output outside the shared schema", async () => {
    const result: ProviderExecution = await new OpenAIAdapter(
      fixture({
        status: "completed",
        output: [{ content: [{ type: "output_text", text: "{}" }] }],
      }),
    ).execute("prompt", profile, "secret");
    expect(result.status).toBe("schema-invalid");
  });
});

describe("consensus scoring", () => {
  const item: BenchmarkCase = {
    id: "gold-case",
    suiteId: "ecosystem-classification",
    kind: "gold",
    title: "Release",
    inputText: "NoirVector adds vector search",
    expected: output,
  };
  const response = (id: string, value = output): ModelLabResponse => ({
    schemaVersion: 1,
    id,
    runId: "run-1",
    caseId: item.id,
    caseKind: item.kind,
    caseTitle: item.title,
    inputText: item.inputText,
    suiteId: item.suiteId,
    suiteVersion: 1,
    provider: "openai",
    modelProfileId: "test-model",
    requestedModel: "test-1",
    promptHash: "a".repeat(64),
    classificationSchemaHash: "d".repeat(64),
    inputHash: "b".repeat(64),
    modelConfigHash: "c".repeat(64),
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:00:01.000Z",
    latencyMs: 1_000,
    status: "success",
    output: value,
  });
  it("reports unanimous agreement and grounded evidence", () => {
    const result = calculateConsensus(item, [response("one"), response("two")]);
    expect(result.status).toBe("unanimous");
    expect(result.evidenceValidity).toBe(1);
    expect(result.goldScore?.exactCategorical).toBe(1);
  });
  it("hashes stable values independently of object key order", () => {
    expect(sha256({ a: 1, b: 2 })).toBe(sha256({ b: 2, a: 1 }));
  });
});
