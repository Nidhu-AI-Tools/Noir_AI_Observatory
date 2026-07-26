import type { SourceKind } from "@noir/core";

import { FetchHttpClient, type HttpClient } from "../http-client";
import { GitHubRepositoryAdapter } from "./github-repository-adapter";
import { HuggingFaceOrganizationAdapter } from "./huggingface-organization-adapter";
import type { SourceAdapter } from "./source-adapter";

export class SourceAdapterRegistry {
  private readonly adapters: Map<SourceKind, SourceAdapter>;

  constructor(httpClient: HttpClient = new FetchHttpClient()) {
    const adapters: SourceAdapter[] = [
      new GitHubRepositoryAdapter(httpClient),
      new HuggingFaceOrganizationAdapter(httpClient),
    ];
    this.adapters = new Map(adapters.map((adapter) => [adapter.kind, adapter]));
  }

  get(kind: SourceKind): SourceAdapter {
    const adapter = this.adapters.get(kind);
    if (!adapter) {
      throw new Error(`No source adapter registered for ${kind}`);
    }
    return adapter;
  }
}
