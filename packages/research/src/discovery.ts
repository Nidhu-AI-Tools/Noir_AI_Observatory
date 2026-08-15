import type {
  ResearchDiscoveryTaxonomy,
  ResearchItem,
  ResearchRegistry,
} from "@noir/core";

export function validateResearchDiscoveryConfiguration(
  registry: ResearchRegistry,
  taxonomy: ResearchDiscoveryTaxonomy,
): void {
  const allowed = {
    organizations: new Set(taxonomy.organizations.map((value) => value.id)),
    venues: new Set(taxonomy.venues.map((value) => value.id)),
    topics: new Set(taxonomy.topics.map((value) => value.id)),
  };
  for (const source of registry.sources)
    for (const dimension of ["organizations", "venues", "topics"] as const)
      for (const id of source.facetDefaults?.[dimension] ?? [])
        if (!allowed[dimension].has(id))
          throw new Error(
            `Research source ${source.id} references unknown ${dimension} facet ${id}.`,
          );
}

export function validateResearchItemFacetEvidence(
  items: ResearchItem[],
  taxonomy: ResearchDiscoveryTaxonomy,
): void {
  const allowed = {
    organization: new Set(taxonomy.organizations.map((value) => value.id)),
    venue: new Set(taxonomy.venues.map((value) => value.id)),
  };
  for (const item of items)
    for (const evidence of item.facetEvidence ?? [])
      if (!allowed[evidence.dimension].has(evidence.facetId))
        throw new Error(
          `Research item ${item.id} references unknown ${evidence.dimension} facet ${evidence.facetId}.`,
        );
}
