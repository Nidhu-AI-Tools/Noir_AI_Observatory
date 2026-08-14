import { describe, expect, it } from "vitest";

import { legacyTodayTarget, resolveTodayDate, todayPath } from "./today-url";

describe("Today URLs", () => {
  const dates = ["2026-08-14", "2026-08-13", "2026-08-12"];

  it("uses a requested available date or falls back to the newest edition", () => {
    expect(resolveTodayDate(dates, "2026-08-13")).toBe("2026-08-13");
    expect(resolveTodayDate(dates, "2020-01-01")).toBe("2026-08-14");
    expect(resolveTodayDate([], "2026-08-13")).toBe("");
  });

  it("builds shareable encoded date paths", () => {
    expect(todayPath("2026-08-13")).toBe("/?date=2026-08-13");
    expect(todayPath("", "/observatory/")).toBe("/observatory/");
  });

  it("preserves legacy dates and a GitHub Pages base path", () => {
    expect(
      legacyTodayTarget(
        "/Noir_AI_Observatory",
        "?date=2026-08-13&ignored=true",
      ),
    ).toBe("/Noir_AI_Observatory/?date=2026-08-13");
    expect(legacyTodayTarget("", "")).toBe("/");
  });
});
