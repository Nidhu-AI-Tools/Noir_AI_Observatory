"use client";

import { useEffect } from "react";

import { legacyRadarTarget } from "../lib/radar-url";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function LegacyRadarRedirect() {
  const target = `${basePath.replace(/\/$/, "")}/radar/`;
  useEffect(() => {
    window.location.replace(
      legacyRadarTarget(basePath, window.location.search),
    );
  }, []);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
      <h1 className="text-xl font-semibold text-white">Opening Radar</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Source activity and configuration now live together in Radar.
      </p>
      <a
        className="mt-5 inline-flex text-sm font-medium text-violet-300 hover:text-violet-200"
        href={target}
      >
        Continue to Radar →
      </a>
    </div>
  );
}
