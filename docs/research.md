# Research and announcement intelligence

Research Intelligence collects metadata for AI papers and official announcements. It does not download PDFs, article bodies, or raw feeds, and it does not use an LLM to summarize or rank content.

## Source registry

`config/research-sources.yaml` accepts two source kinds:

- `arxiv_query` runs a bounded arXiv API query once per day.
- `rss_feed` reads a public HTTPS RSS or Atom feed from an authoritative publisher.

Source IDs and kinds are immutable. Display name, query or feed URL, publisher, category, tags, weight, enabled state, and reviewed discovery defaults can be edited. `config/research-taxonomy.yaml` defines stable organization, venue, and topic IDs plus search aliases. Organization and venue defaults are valid only when every record from the source shares that authoritative provenance.

Manage sources locally with:

```bash
corepack pnpm research-source:list
corepack pnpm research-source:add -- --kind arxiv_query \
  --display-name "arXiv Machine Learning" --query "cat:cs.LG" \
  --category research-paper --tags machine-learning,research
corepack pnpm research-source:check RESEARCH_SOURCE_ID
corepack pnpm research-source:edit RESEARCH_SOURCE_ID -- --tags ai,research
corepack pnpm research-source:disable RESEARCH_SOURCE_ID
corepack pnpm research-source:validate
```

For remote changes, submit the Add or Edit research-source issue form. A maintainer reviews it and applies `research:approved`; automation dry-checks the source and opens a pull request.

## Collection

Preview collection without writing:

```bash
corepack pnpm research:collect -- --dry-run
corepack pnpm research:collect -- --source RESEARCH_SOURCE_ID --dry-run
```

Persist and validate a local run:

```bash
corepack pnpm research:collect
corepack pnpm research:validate
corepack pnpm generate:research
```

New sources use a seven-day lookback. Successful sources keep an independent timestamp-and-ID cursor. Failed sources do not advance. arXiv versions share a canonical base-paper identity; overlapping queries merge their source IDs and tags. Announcement identity uses a canonical URL with common tracking parameters removed.

## Data and safety

Canonical records are stored under:

```text
data/research-items/YYYY/MM/DD.jsonl
data/research-runs/YYYY/MM/DD/RUN_ID.json
data/research-state/SOURCE_ID.json
```

Feed requests are limited to public HTTPS destinations, three redirects, 15 seconds, and 2 MB. Markup is removed from excerpts. Credentials, custom headers, private-network feeds, full articles, and PDF ingestion are not supported.

The scheduled workflow runs daily at `04:37 UTC`, commits only the three research data directories, and deploys Pages. A run report is written on successful zero-change days.

## Dashboard semantics

The Research page renders 24 records at a time and supports shareable text, organization, venue, topic, type, source, tag, arXiv-category, recent-window, and date filters. Results sort by newest, oldest, or deterministic text relevance. Relevance is a field-match policy, not a claim about paper quality or scientific importance.

The generated public contract is static and bounded:

```text
apps/web/public/generated/research/index.json
apps/web/public/generated/research/pages/NNNN.json
apps/web/public/generated/research/search/index.json
```

The compact index and one page load initially. The search index loads lazily for catalog-wide matching, and page shards are cached. Organization and venue entries with no authoritative source are labeled `not configured`; the interface does not present missing coverage as zero publications. Computer Vision and Robotics are mapped deterministically from reviewed arXiv categories while original categories remain visible.

OpenAlex citation, institution, DOI, and author enrichment is intentionally deferred until this ingestion pipeline has operated reliably.
