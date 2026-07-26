import { describe, expect, it } from "vitest";

import type { HttpClient, HttpResponse } from "../http-client";
import { GitHubRepositoryAdapter } from "./github-repository-adapter";
import { HuggingFaceOrganizationAdapter } from "./huggingface-organization-adapter";

class FixtureHttpClient implements HttpClient {
  constructor(private readonly response: HttpResponse) {}

  async get<T>(): Promise<HttpResponse<T>> {
    return this.response as HttpResponse<T>;
  }
}

function response(
  status: number,
  data: unknown,
  headers: Record<string, string> = {},
): HttpResponse {
  return { status, data, headers: new Headers(headers) };
}

describe("GitHubRepositoryAdapter", () => {
  it("resolves and normalizes a public repository", async () => {
    const adapter = new GitHubRepositoryAdapter(
      new FixtureHttpClient(
        response(200, {
          full_name: "qdrant/qdrant",
          name: "qdrant",
          html_url: "https://github.com/qdrant/qdrant",
          description: "Vector database",
          archived: false,
          private: false,
          default_branch: "master",
          stargazers_count: 26000,
        }),
      ),
    );

    const result = await adapter.resolve(
      "https://github.com/Qdrant/Qdrant.git",
    );
    expect(result.locator).toBe("qdrant/qdrant");
    expect(result.metadata.stars).toBe(26000);
  });

  it("reports a rate limit distinctly", async () => {
    const adapter = new GitHubRepositoryAdapter(
      new FixtureHttpClient(
        response(403, {}, { "x-ratelimit-remaining": "0" }),
      ),
    );
    await expect(adapter.resolve("qdrant/qdrant")).rejects.toMatchObject({
      code: "rate_limited",
    });
  });
});

describe("HuggingFaceOrganizationAdapter", () => {
  it("resolves an organization and warns when no models are visible", async () => {
    const adapter = new HuggingFaceOrganizationAdapter(
      new FixtureHttpClient(
        response(200, {
          name: "meta-llama",
          fullname: "Meta Llama",
          description: "Open model publisher",
          numModels: 0,
        }),
      ),
    );

    const result = await adapter.resolve("meta-llama");
    expect(result.displayName).toBe("Meta Llama");
    expect(result.warnings).toHaveLength(1);
  });

  it("rejects an unknown organization", async () => {
    const adapter = new HuggingFaceOrganizationAdapter(
      new FixtureHttpClient(response(404, {})),
    );
    await expect(adapter.resolve("missing-org")).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
