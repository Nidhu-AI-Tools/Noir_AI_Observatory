"use client";

import { useEffect } from "react";

import { legacyTodayTarget } from "../lib/today-url";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function LegacyTodayRedirect() {
  const target = `${basePath.replace(/\/$/, "")}/`;
  useEffect(() => {
    const nextTarget = legacyTodayTarget(basePath, window.location.search);
    window.location.replace(nextTarget);
  }, []);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
      <h1 className="text-xl font-semibold text-white">Opening Today</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Daily digests and reviewed notes now live together on the homepage.
      </p>
      <a
        className="mt-5 inline-flex text-sm font-medium text-violet-300 hover:text-violet-200"
        href={target}
      >
        Continue to Today →
      </a>
    </div>
  );
}
