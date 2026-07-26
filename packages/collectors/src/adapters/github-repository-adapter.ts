import { normalizeLocator, type ResolvedSource } from "@noir/core";
import { z } from "zod";

import { SourceResolutionError, type HttpClient } from "../http-client";
import type { ResolveContext, SourceAdapter } from "./source-adapter";

const githubRepositorySchema = z.object({
  full_name: z.string(),
  name: z.string(),
  html_url: z.url(),
  description: z.string().nullable(),
  archived: z.boolean(),
  private: z.boolean(),
  default_branch: z.string(),
  stargazers_count: z.number(),
});

export class GitHubRepositoryAdapter implements SourceAdapter {
  readonly kind = "github_repo" as const;

  constructor(private readonly httpClient: HttpClient) {}

  async resolve(
    locator: string,
    context: ResolveContext = {},
  ): Promise<ResolvedSource> {
    const normalized = normalizeLocator(this.kind, locator);
    if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(normalized)) {
      throw new SourceResolutionError(
        "GitHub repositories must use owner/repository.",
        "invalid_locator",
      );
    }

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10",
      "User-Agent": "Noir-AI-Observatory",
    };
    if (context.githubToken) {
      headers.Authorization = `Bearer ${context.githubToken}`;
    }

    let response;
    try {
      response = await this.httpClient.get(
        `https://api.github.com/repos/${normalized}`,
        {
          headers,
        },
      );
    } catch {
      throw new SourceResolutionError(
        "GitHub could not be reached.",
        "network_error",
      );
    }

    if (response.status === 404) {
      throw new SourceResolutionError(
        `GitHub repository not found: ${normalized}`,
        "not_found",
      );
    }
    if (response.status === 401 || response.status === 403) {
      const remaining = response.headers.get("x-ratelimit-remaining");
      throw new SourceResolutionError(
        remaining === "0"
          ? "GitHub API rate limit exceeded."
          : "GitHub repository is inaccessible.",
        remaining === "0" ? "rate_limited" : "unauthorized",
      );
    }
    if (response.status !== 200) {
      throw new SourceResolutionError(
        `GitHub returned unexpected status ${response.status}.`,
        "invalid_response",
      );
    }

    const parsed = githubRepositorySchema.safeParse(response.data);
    if (!parsed.success) {
      throw new SourceResolutionError(
        "GitHub returned an invalid repository response.",
        "invalid_response",
      );
    }

    const repository = parsed.data;
    return {
      kind: this.kind,
      locator: repository.full_name.toLowerCase(),
      displayName: repository.name,
      ...(repository.description
        ? { description: repository.description }
        : {}),
      externalUrl: repository.html_url,
      warnings: repository.archived ? ["This repository is archived."] : [],
      metadata: {
        archived: repository.archived,
        private: repository.private,
        defaultBranch: repository.default_branch,
        stars: repository.stargazers_count,
      },
    };
  }
}
