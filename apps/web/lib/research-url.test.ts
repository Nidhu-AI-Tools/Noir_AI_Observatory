import { describe, expect, it } from "vitest";

import {
  defaultResearchUrlState,
  parseResearchUrl,
  researchPath,
  resetResearchPage,
} from "./research-url";

describe("Research URL state", () => {
  it("round trips combined discovery state", () => {
    const state = parseResearchUrl(
      "?q=robot+learning&organization=meta-ai&venue=neurips&topic=robotics&type=research_paper&source=arxiv-ai&tag=research&arxiv=cs.RO&window=30d&sort=relevance&page=3",
    );
    expect(researchPath(state)).toBe(
      "/research/?q=robot+learning&organization=meta-ai&venue=neurips&topic=robotics&type=research_paper&source=arxiv-ai&tag=research&arxiv=cs.RO&window=30d&sort=relevance&page=3",
    );
  });

  it("normalizes invalid enums and page values", () => {
    expect(
      parseResearchUrl("?type=blog&window=forever&sort=popular&page=-2"),
    ).toEqual(defaultResearchUrlState);
  });

  it("resets pagination when discovery state changes", () => {
    expect(
      resetResearchPage(
        { ...defaultResearchUrlState, page: 9 },
        { topic: "robotics" },
      ),
    ).toMatchObject({ topic: "robotics", page: 1 });
  });
});
