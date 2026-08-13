import { describe, expect, it } from "vitest";

import { resolveHuggingFaceProviderIds } from "./huggingface-identity-resolver";

describe("Hugging Face identity resolver", () => {
  it("maps opaque provider IDs to canonical names without guessing", async () => {
    const result = await resolveHuggingFaceProviderIds(
      [
        { owner: "qwen", providerId: "provider-1" },
        { owner: "qwen", providerId: "renamed", revision: "revision-2" },
        { owner: "qwen", providerId: "missing" },
      ],
      {
        list: async function* () {
          yield { id: "provider-1", name: "Qwen/model-one" };
          yield {
            id: "new-provider-id",
            name: "Qwen/renamed-model",
            sha: "revision-2",
          };
          yield { id: "unrelated", name: "Qwen/model-two" };
        },
      },
    );

    expect(result.mappings).toEqual([
      {
        owner: "qwen",
        providerId: "provider-1",
        canonicalName: "Qwen/model-one",
      },
      {
        owner: "qwen",
        providerId: "renamed",
        canonicalName: "Qwen/renamed-model",
      },
    ]);
    expect(result.unresolved).toEqual([
      { owner: "qwen", providerId: "missing" },
    ]);
  });
});
