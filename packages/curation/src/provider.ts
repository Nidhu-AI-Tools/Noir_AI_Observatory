import type {
  CurationConfig,
  CurationContext,
  CurationModelOutput,
  CurationProviderKind,
} from "@noir/core";

export interface ProviderStatus {
  ok: boolean;
  provider: CurationProviderKind;
  detail: string;
  models?: string[];
}

export interface CurationProvider {
  readonly kind: CurationProviderKind;
  readonly model: string;
  check(): Promise<ProviderStatus>;
  generate(
    context: CurationContext,
    config: CurationConfig,
  ): Promise<CurationModelOutput>;
}

export const CURATION_OUTPUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "summary", "highlights", "caveats"],
  properties: {
    headline: { type: "string", minLength: 1, maxLength: 180 },
    summary: { type: "string", minLength: 1, maxLength: 1000 },
    highlights: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sourceId", "title", "summary", "whyItMatters", "sourceUrl"],
        properties: {
          sourceId: { type: "string", minLength: 1, maxLength: 300 },
          title: { type: "string", minLength: 1, maxLength: 300 },
          summary: { type: "string", minLength: 1, maxLength: 800 },
          whyItMatters: { type: "string", minLength: 1, maxLength: 800 },
          sourceUrl: { type: "string" },
        },
      },
    },
    caveats: {
      type: "array",
      maxItems: 8,
      items: { type: "string", minLength: 1, maxLength: 500 },
    },
  },
} as const;
