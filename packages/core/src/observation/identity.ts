import { createHash } from "node:crypto";

import type { Observation } from "./schema";

export function createObservationId(
  type: Observation["type"],
  sourceId: string,
  externalId: string,
  externalRevision?: string,
): string {
  const canonical = [type, sourceId, externalId, externalRevision]
    .filter((value) => value !== undefined)
    .join(":");
  return `obs_${createHash("sha256").update(canonical).digest("hex")}`;
}
