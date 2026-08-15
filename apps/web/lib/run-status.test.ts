import { describe, expect, it } from "vitest";

import { deriveRunDisplayStatus } from "./run-status";

describe("run display status", () => {
  const now = "2026-08-15T12:00:00.000Z";

  it("treats recent success and no-op runs as current", () => {
    expect(
      deriveRunDisplayStatus("success", "2026-08-15T06:00:00.000Z", now),
    ).toEqual({ label: "Current", tone: "success" });
    expect(
      deriveRunDisplayStatus("no-op", "2026-08-14T12:00:00.000Z", now),
    ).toEqual({ label: "Current", tone: "success" });
  });

  it("distinguishes partial, failed, stale, and invalid reports", () => {
    expect(
      deriveRunDisplayStatus("partial", "2026-08-15T06:00:00.000Z", now),
    ).toEqual({ label: "Partial", tone: "partial" });
    expect(
      deriveRunDisplayStatus("failure", "2026-08-15T06:00:00.000Z", now),
    ).toEqual({ label: "Needs attention", tone: "failure" });
    expect(
      deriveRunDisplayStatus("success", "2026-08-13T12:00:00.000Z", now),
    ).toEqual({ label: "Delayed", tone: "partial" });
    expect(deriveRunDisplayStatus("success", "invalid", now)).toEqual({
      label: "Delayed",
      tone: "partial",
    });
  });
});
