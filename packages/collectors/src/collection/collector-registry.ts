import type { SourceKind } from "@noir/core";

import { FetchHttpClient, type HttpClient } from "../http-client";
import { GitHubReleaseCollector } from "./github-release-collector";
import {
  HuggingFaceModelCollector,
  type HuggingFaceModelClient,
} from "./huggingface-model-collector";
import type { ObservationCollector } from "./observation-collector";

export class ObservationCollectorRegistry {
  private readonly collectors: Map<SourceKind, ObservationCollector>;

  constructor(
    httpClient: HttpClient = new FetchHttpClient(15_000),
    huggingFaceClient?: HuggingFaceModelClient,
  ) {
    const collectors: ObservationCollector[] = [
      new GitHubReleaseCollector(httpClient),
      new HuggingFaceModelCollector(huggingFaceClient),
    ];
    this.collectors = new Map(
      collectors.map((collector) => [collector.kind, collector]),
    );
  }

  get(kind: SourceKind): ObservationCollector {
    const collector = this.collectors.get(kind);
    if (!collector) throw new Error(`No observation collector for ${kind}`);
    return collector;
  }
}
