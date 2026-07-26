import {
  createObservationId,
  githubReleaseObservationSchema,
  type GitHubReleaseObservation,
  type SourceCollectionState,
  type SourceConfig,
} from "@noir/core";
import { z } from "zod";

import type { HttpClient } from "../http-client";
import {
  CollectionError,
  collectionCutoff,
  isAfterCursor,
  nextCursor,
  type CollectionBatch,
  type CollectionContext,
  type ObservationCollector,
} from "./observation-collector";
import { withRetry } from "./retry";

const releaseSchema = z
  .object({
    id: z.number().int().nonnegative(),
    html_url: z.url(),
    tag_name: z.string().min(1),
    name: z.string().nullable(),
    body: z.string().nullable(),
    draft: z.boolean(),
    prerelease: z.boolean(),
    created_at: z.iso.datetime({ offset: true }),
    published_at: z.iso.datetime({ offset: true }).nullable(),
    author: z.object({ login: z.string() }).nullable(),
    assets: z.array(z.unknown()),
  })
  .passthrough();

const releasesSchema = z.array(releaseSchema);

function excerpt(body: string | null): string | undefined {
  const normalized = body?.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  return normalized.slice(0, 1_000);
}

export class GitHubReleaseCollector implements ObservationCollector {
  readonly kind = "github_repo" as const;

  constructor(private readonly httpClient: HttpClient) {}

  async collect(
    source: SourceConfig,
    state: SourceCollectionState | undefined,
    context: CollectionContext,
  ): Promise<CollectionBatch> {
    const cursor = collectionCutoff(state, context);
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10",
      "User-Agent": "Noir-AI-Observatory",
    };
    if (context.githubToken) {
      headers.Authorization = `Bearer ${context.githubToken}`;
    }
    if (state?.etag) headers["If-None-Match"] = state.etag;

    const response = await withRetry(
      async () => {
        let result;
        try {
          result = await this.httpClient.get(
            `https://api.github.com/repos/${source.locator}/releases?per_page=100&page=1`,
            { headers },
          );
        } catch {
          throw new CollectionError(
            "GitHub could not be reached.",
            "network_error",
            true,
          );
        }
        if (result.status === 429 || result.status >= 500) {
          throw new CollectionError(
            `GitHub returned temporary status ${result.status}.`,
            result.status === 429 ? "rate_limited" : "network_error",
            true,
          );
        }
        return result;
      },
      {
        shouldRetry: (error) =>
          error instanceof CollectionError && error.retryable,
      },
    );

    if (response.status === 304) {
      return {
        observations: [],
        cursor,
        ...(state?.etag ? { etag: state.etag } : {}),
        truncated: false,
        warnings: [],
      };
    }
    if (response.status === 404) {
      throw new CollectionError(
        `GitHub repository not found: ${source.locator}`,
        "not_found",
      );
    }
    if (response.status === 401 || response.status === 403) {
      const rateLimited = response.headers.get("x-ratelimit-remaining") === "0";
      throw new CollectionError(
        rateLimited
          ? "GitHub API rate limit exceeded."
          : "GitHub repository is inaccessible.",
        rateLimited ? "rate_limited" : "unauthorized",
        rateLimited,
      );
    }
    if (response.status !== 200) {
      throw new CollectionError(
        `GitHub returned unexpected status ${response.status}.`,
        "invalid_response",
      );
    }

    const parsed = releasesSchema.safeParse(response.data);
    if (!parsed.success) {
      throw new CollectionError(
        "GitHub returned an invalid releases response.",
        "invalid_response",
      );
    }

    const eligible = parsed.data
      .filter(
        (release) =>
          !release.draft &&
          release.published_at &&
          isAfterCursor(release.published_at, String(release.id), cursor),
      )
      .sort((left, right) =>
        (left.published_at ?? "").localeCompare(right.published_at ?? ""),
      );
    const limited = eligible.slice(0, context.maxObservationsPerSource);
    const observations = limited.map((release): GitHubReleaseObservation => {
      const publishedAt = release.published_at;
      if (!publishedAt) throw new Error("Published release lacks a timestamp.");
      return githubReleaseObservationSchema.parse({
        schemaVersion: 1,
        id: createObservationId(
          "github_release",
          source.id,
          String(release.id),
        ),
        type: "github_release",
        provider: "github",
        sourceId: source.id,
        externalId: String(release.id),
        title: release.name?.trim() || release.tag_name,
        url: release.html_url,
        occurredAt: publishedAt,
        collectedAt: context.collectedAt.toISOString(),
        categoryId: source.categoryId,
        sourceTags: source.tags,
        details: {
          releaseId: String(release.id),
          tagName: release.tag_name,
          ...(release.author?.login ? { author: release.author.login } : {}),
          createdAt: release.created_at,
          publishedAt,
          prerelease: release.prerelease,
          ...(excerpt(release.body)
            ? { releaseNotesExcerpt: excerpt(release.body) }
            : {}),
          assetCount: release.assets.length,
        },
      });
    });
    const truncated = eligible.length >= context.maxObservationsPerSource;
    const etag = response.headers.get("etag");
    return {
      observations,
      cursor: nextCursor(cursor, observations),
      ...(etag ? { etag } : {}),
      truncated,
      warnings: truncated
        ? ["GitHub results reached the per-source safety limit."]
        : [],
    };
  }
}
