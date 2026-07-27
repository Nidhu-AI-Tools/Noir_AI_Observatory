import type { HuggingFaceModelObservation } from "@noir/core";

const tagCategory: Record<string, string> = {
  agent: "agents",
  agents: "agents",
  code: "coding",
  coding: "coding",
  reasoning: "reasoning",
  reranker: "reranking",
  reranking: "reranking",
  safety: "safety",
  guardrail: "safety",
  moderation: "safety",
  embedding: "embeddings",
  embeddings: "embeddings",
};
const pipelineCategory: Record<string, string> = {
  "text-generation": "language-models",
  "text2text-generation": "language-models",
  "feature-extraction": "embeddings",
  "sentence-similarity": "embeddings",
  "text-classification": "language-models",
  "image-text-to-text": "multimodal",
  "visual-question-answering": "multimodal",
  "image-to-text": "multimodal",
  "text-to-image": "image-generation",
  "image-to-image": "image-generation",
  "text-to-video": "video-generation",
  "automatic-speech-recognition": "speech-audio",
  "text-to-speech": "speech-audio",
  "audio-classification": "speech-audio",
  "image-classification": "computer-vision",
  "object-detection": "computer-vision",
  "image-segmentation": "computer-vision",
};
export function classifyObservation(item: HuggingFaceModelObservation) {
  const tags = [...new Set([...item.sourceTags, ...item.details.tags])]
    .map((value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-"))
    .filter(Boolean)
    .slice(0, 30);
  const categories = new Set<string>();
  if (item.details.pipelineTag) {
    const mapped = pipelineCategory[item.details.pipelineTag.toLowerCase()];
    if (mapped) categories.add(mapped);
  }
  for (const tag of tags) {
    const mapped = tagCategory[tag];
    if (mapped) categories.add(mapped);
  }
  if (categories.size === 0) categories.add("language-models");
  const modalities = new Set<string>();
  for (const tag of tags)
    if (["text", "image", "video", "audio", "speech"].includes(tag))
      modalities.add(tag);
  if (modalities.size === 0) modalities.add("text");
  const availability = item.details.gated
    ? (["gated"] as const)
    : tags.includes("open-weights") || tags.includes("open-weight")
      ? (["open-weights", "downloadable"] as const)
      : (["downloadable"] as const);
  return {
    categories: [...categories].sort(),
    tags,
    modalities: [...modalities].sort(),
    availability: [...availability],
  };
}
