import { normalizeLocator, type ResolvedSource } from "@noir/core";
import { z } from "zod";

import { SourceResolutionError, type HttpClient } from "../http-client";
import type { ResolveContext, SourceAdapter } from "./source-adapter";

const organizationSchema = z
  .object({
    name: z.string().optional(),
    fullname: z.string().optional(),
    avatarUrl: z.string().optional(),
    description: z.string().nullable().optional(),
    numModels: z.number().optional(),
  })
  .passthrough();

export class HuggingFaceOrganizationAdapter implements SourceAdapter {
  readonly kind = "huggingface_org" as const;

  constructor(private readonly httpClient: HttpClient) {}

  async resolve(
    locator: string,
    context: ResolveContext = {},
  ): Promise<ResolvedSource> {
    const normalized = normalizeLocator(this.kind, locator);
    if (!/^[a-z0-9_.-]+$/.test(normalized)) {
      throw new SourceResolutionError(
        "Hugging Face organizations must use an organization identifier.",
        "invalid_locator",
      );
    }

    const headers: Record<string, string> = {
      "User-Agent": "Noir-AI-Observatory",
    };
    if (context.huggingFaceToken) {
      headers.Authorization = `Bearer ${context.huggingFaceToken}`;
    }

    let response;
    try {
      response = await this.httpClient.get(
        `https://huggingface.co/api/organizations/${normalized}/overview`,
        { headers },
      );
    } catch {
      throw new SourceResolutionError(
        "Hugging Face could not be reached.",
        "network_error",
      );
    }

    if (response.status === 404) {
      throw new SourceResolutionError(
        `Hugging Face organization not found: ${normalized}`,
        "not_found",
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new SourceResolutionError(
        "Hugging Face organization is inaccessible.",
        "unauthorized",
      );
    }
    if (response.status === 429) {
      throw new SourceResolutionError(
        "Hugging Face API rate limit exceeded.",
        "rate_limited",
      );
    }
    if (response.status !== 200) {
      throw new SourceResolutionError(
        `Hugging Face returned unexpected status ${response.status}.`,
        "invalid_response",
      );
    }

    const parsed = organizationSchema.safeParse(response.data);
    if (!parsed.success) {
      throw new SourceResolutionError(
        "Hugging Face returned an invalid organization response.",
        "invalid_response",
      );
    }

    const organization = parsed.data;
    const displayName =
      organization.fullname || organization.name || normalized;
    const modelCount = organization.numModels;
    return {
      kind: this.kind,
      locator: normalized,
      displayName,
      ...(organization.description
        ? { description: organization.description }
        : {}),
      externalUrl: `https://huggingface.co/${normalized}`,
      warnings:
        modelCount === 0
          ? ["This organization currently has no visible models."]
          : [],
      metadata: {
        ...(modelCount === undefined ? {} : { modelCount }),
        ...(organization.avatarUrl
          ? { avatarUrl: organization.avatarUrl }
          : {}),
      },
    };
  }
}
