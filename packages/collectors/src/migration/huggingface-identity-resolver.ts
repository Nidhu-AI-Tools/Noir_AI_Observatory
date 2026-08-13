import { listModels } from "@huggingface/hub";
import {
  assertHuggingFaceOwner,
  parseHuggingFaceModelIdentity,
} from "@noir/core";

export interface HuggingFaceIdentityRequest {
  owner: string;
  providerId: string;
  revision?: string;
  queryOwners?: string[];
}

export interface HuggingFaceIdentityMapping {
  owner: string;
  providerId: string;
  canonicalName: string;
}

export interface HuggingFaceIdentityResolution {
  mappings: HuggingFaceIdentityMapping[];
  unresolved: HuggingFaceIdentityRequest[];
}

export type HuggingFaceModelIdentityLister = (options: {
  owner: string;
  accessToken?: string;
}) => AsyncIterable<{ id: string; name: string; sha?: string }>;

const officialLister: HuggingFaceModelIdentityLister = (options) =>
  listModels({
    search: { owner: options.owner },
    sort: "lastModified",
    limit: 10_000,
    additionalFields: ["sha"],
    ...(options.accessToken ? { accessToken: options.accessToken } : {}),
  });

export async function resolveHuggingFaceProviderIds(
  requests: HuggingFaceIdentityRequest[],
  options: {
    accessToken?: string;
    list?: HuggingFaceModelIdentityLister;
  } = {},
): Promise<HuggingFaceIdentityResolution> {
  const unique = new Map(
    requests.map((request) => [
      `${request.owner.toLowerCase()}:${request.providerId}`,
      request,
    ]),
  );
  const byOwner = new Map<string, HuggingFaceIdentityRequest[]>();
  for (const request of unique.values()) {
    const key = request.owner.toLowerCase();
    byOwner.set(key, [...(byOwner.get(key) ?? []), request]);
  }

  const mappings: HuggingFaceIdentityMapping[] = [];
  const resolvedKeys = new Set<string>();
  const list = options.list ?? officialLister;
  for (const requestsForOwner of byOwner.values()) {
    const owner = requestsForOwner[0]?.owner;
    if (!owner) continue;
    const pending = new Map(
      requestsForOwner.map((item) => [item.providerId, item]),
    );
    const queryOwners = [
      owner,
      ...requestsForOwner.flatMap((item) => item.queryOwners ?? []),
    ].filter((item, index, values) => values.indexOf(item) === index);
    for (const queryOwner of queryOwners) {
      for await (const model of list({
        owner: queryOwner,
        ...(options.accessToken ? { accessToken: options.accessToken } : {}),
      })) {
        const direct = pending.get(model.id);
        const revisionMatches = model.sha
          ? [...pending.values()].filter((item) => item.revision === model.sha)
          : [];
        const request =
          direct ??
          (revisionMatches.length === 1 ? revisionMatches[0] : undefined);
        if (!request) continue;
        const identity = parseHuggingFaceModelIdentity(model.name);
        assertHuggingFaceOwner(identity.canonicalName, owner);
        mappings.push({
          owner,
          providerId: request.providerId,
          canonicalName: identity.canonicalName,
        });
        resolvedKeys.add(`${owner.toLowerCase()}:${request.providerId}`);
        pending.delete(request.providerId);
        if (pending.size === 0) break;
      }
      if (pending.size === 0) break;
    }
  }

  return {
    mappings: mappings.sort(
      (left, right) =>
        left.owner.localeCompare(right.owner) ||
        left.providerId.localeCompare(right.providerId),
    ),
    unresolved: [...unique.entries()]
      .filter(([key]) => !resolvedKeys.has(key))
      .map(([, request]) => ({
        owner: request.owner,
        providerId: request.providerId,
        ...(request.revision ? { revision: request.revision } : {}),
      }))
      .sort(
        (left, right) =>
          left.owner.localeCompare(right.owner) ||
          left.providerId.localeCompare(right.providerId),
      ),
  };
}
