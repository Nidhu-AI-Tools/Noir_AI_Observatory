import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { removeObsoleteDashboardArtifacts } from "./generate-dashboard";

const temporaryDirectories: string[] = [];

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

describe("dashboard artifact cleanup", () => {
  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  it("removes obsolete output without touching supported artifacts", async () => {
    const output = await mkdtemp(path.join(tmpdir(), "noir-generated-"));
    temporaryDirectories.push(output);
    const obsolete = [
      "activity.json",
      "feed.json",
      "sources.json",
      "digests/index.json",
      "curation/index.json",
      "model-lab/index.json",
      "research/days/2026-08-15.json",
    ];
    await Promise.all(
      obsolete.map(async (relative) => {
        const filePath = path.join(output, relative);
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, "{}\n", "utf8");
      }),
    );
    const supported = path.join(output, "radar.json");
    await writeFile(supported, "{}\n", "utf8");

    await removeObsoleteDashboardArtifacts(output);

    expect(
      await Promise.all(
        obsolete.map((file) => exists(path.join(output, file))),
      ),
    ).toEqual(obsolete.map(() => false));
    expect(await exists(supported)).toBe(true);
  });
});
