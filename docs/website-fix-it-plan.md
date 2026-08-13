# Website Fix-It Plan

This document is the implementation backlog for correcting known data issues,
removing duplicated website experiences, and making the Observatory easier to
search and navigate. The work is deliberately divided into six independently
reviewable phases. Each phase should be implemented, tested, and merged before
the next phase begins.

## Goals

- Correct broken Hugging Face identities and links at the data source.
- Stop presenting the same underlying event more than once.
- Reduce the primary navigation from eight destinations to five.
- Make Research fast to load, paginated, and useful for organization, venue,
  topic, and free-text discovery.
- Remove generated artifacts and payload fields that have no consumer.
- Preserve the repository-first architecture and GitHub Pages deployment.
- Keep Add/Edit workflows available even when their current pages are merged.

## Target navigation

```text
Today · Radar · Research · Models · API Health
```

The intended responsibilities are:

- **Today**: the current daily brief, optional curated note, important changes,
  incidents, and the archive date selector.
- **Radar**: tracked GitHub repositories and Hugging Face organizations,
  activity, and Add/Edit controls.
- **Research**: searchable and paginated papers and official announcements.
- **Models**: the normalized model catalog and release history.
- **API Health**: current endpoint status and recent measurements.

Old routes should redirect to their replacement rather than immediately
returning 404 responses.

## Phase 1: Data integrity and link repair

**Weight:** Heavy  
**Status:** Implemented on the Noir branch  
**Purpose:** Repair the canonical data before reorganizing pages that consume
it.

### Work

1. Correct the Hugging Face collector adapter.
   - Preserve the SDK's internal `model.id` as the stable provider identity used
     by cursors, observation IDs, and `externalId`.
   - Use `model.name` as the canonical public `owner/model` identifier used by
     titles, URLs, and `details.modelId`.
   - Construct model-card URLs only from a validated canonical identifier.
2. Replace the unrealistic Hugging Face collector fixture with one containing
   both an internal ID and a canonical name.
3. Add provider-aware semantic validation.
   - A Hugging Face model ID must have an `owner/model` shape.
   - The observation URL must agree with `details.modelId`.
   - The owner must agree with the tracked organization, case-insensitively.
   - A GitHub release URL must agree with its tracked repository.
4. Create a one-time, repeatable Hugging Face repair command.
   - Query each tracked organization and build an internal-ID-to-model-name
     mapping from provider data.
   - Produce a report before writing anything, including unresolved IDs.
   - Never guess a model name when no authoritative mapping is available.
   - Rewrite affected observations while preserving their stable IDs and
     collection cursors.
   - Repair derived model event display fields and add exact observation
     lineage without changing event IDs or run-report references.
   - Preserve curation `sourceIds` while repairing evidence names and URLs.
5. Prevent duplicate presentation of model activity.
   - When a Hugging Face observation has a corresponding normalized model
     event, daily views must show the model event only once.
   - Manual model events with no observation must continue to appear.
6. Add regression fixtures for a real-looking Hugging Face SDK response and a
   digest containing both a raw observation and its derived model event.

### Acceptance criteria

- No generated Hugging Face URL uses a 24-character provider-internal ID.
- Every resolved Hugging Face link follows
  `https://huggingface.co/owner/model` and passes validation.
- The migration is idempotent and emits a reviewable report.
- Unresolved historical records are reported explicitly and are not silently
  rewritten.
- A single Hugging Face change contributes one visible daily item and one
  logical count.
- All downstream source references remain valid after ID migration.

### Repair command

The checked-in migration has already repaired the historical dataset. The
repeatable command remains available for auditing or another affected branch:

```bash
corepack pnpm hf-identities:audit
corepack pnpm hf-identities:resolve
corepack pnpm hf-identities:repair
```

The resolve step writes an ignored local mapping and does not edit tracked
data. The repair step refuses unresolved identities and dirty migration target
files, preserves stable IDs, and writes a tracked migration report.

## Phase 2: Replace Overview, Digests, and Curation with Today

**Weight:** Medium to heavy  
**Purpose:** Create one useful daily landing page instead of three overlapping
presentations.

### Work

1. Turn `/` into the **Today** experience.
2. Move the digest date selector and older/newer navigation to Today.
3. Display the published curation note at the top when one exists.
   - Keep curation generation, review, schemas, and stored notes unchanged.
   - A day without a curated note must still have a useful deterministic brief.
4. Replace the full daily dump with bounded sections.
   - Important ecosystem releases.
   - Model releases and updates.
   - Research highlights.
   - API incidents or status transitions.
   - Counts and links to the complete domain pages.
5. Use one normalized representation per event; do not repeat promoted model
   observations in the raw ecosystem section.
6. Include the latest collection status and a real `last updated` timestamp.
7. Redirect `/digests/` and `/curation/` to Today while preserving a requested
   `date` query parameter.
8. Remove Digests and Curation from primary navigation after redirects work.

### Presentation rules

- The newest day is selected by default.
- The selected day is encoded as `?date=YYYY-MM-DD` and is shareable.
- Each section has a small default limit and a domain-specific `View all` link.
- Quiet days explain that collection succeeded without inventing activity.
- Historical dates must never be described as `today` inside their content.

### Acceptance criteria

- The homepage provides the useful information previously spread across three
  pages.
- A visitor can move between daily editions without loading a full historical
  catalog.
- Curated and deterministic content coexist without duplicate cards.
- Old digest and curation URLs resolve through redirects.
- The primary navigation now has six entries or fewer at this stage.

## Phase 3: Merge Sources into Radar

**Weight:** Medium  
**Purpose:** Keep the source-management capability while eliminating two nearly
identical catalogs.

### Work

1. Make Radar the canonical page for GitHub repositories and Hugging Face
   organizations.
2. Retain Radar activity information:
   - 24-hour, 7-day, 30-day, and all-time counts.
   - Latest observation.
   - Activity status.
   - Linked API monitor when configured.
3. Move Sources management actions into Radar:
   - Add source.
   - Request edit.
   - Enabled/disabled state.
   - Immutable source ID and configuration metadata in a details area.
4. Keep search and category, tag, type, period, status, and source filters in
   URL state.
5. Generate one source/radar view model instead of making the Sources page load
   both `sources.json` and `radar.json`.
6. Redirect `/sources/` and `/sources/?source=...` to the equivalent Radar view.
7. Remove Sources from primary navigation.

Research feeds and API monitors remain managed within Research and API Health;
Radar should clearly say it manages repository and model-publisher tracking,
not every registry in the project.

### Acceptance criteria

- Every existing Sources capability is reachable from Radar.
- A source can still be added or edited through the existing reviewed GitHub
  workflow.
- Source filters and focused source links remain shareable.
- The frontend no longer downloads two overlapping source artifacts.
- The primary navigation matches the five-entry target.

## Phase 4: Research discovery, search, facets, and pagination

**Weight:** Heavy; keep this phase independent  
**Purpose:** Turn Research into a focused discovery tool without loading or
rendering the entire catalog.

### 4.1 Normalized discovery metadata

Extend the research model with optional, provenance-backed facets:

- `organizations`: for example Google Research, Google DeepMind, Meta AI.
- `venues`: canonical conference or journal names, such as ICML and NeurIPS.
- `topics`: controlled Observatory topics such as computer vision, robotics,
  agents, speech, or reinforcement learning.
- Existing authors, publisher, source, tags, arXiv categories, publication
  date, and content type remain available.

Rules:

- Do not infer an author's employer from their name.
- Do not infer a conference solely from arbitrary abstract text.
- Organization and venue facets must come from an official tracked source,
  structured provider metadata, or explicit reviewed source configuration.
- Preserve provenance for every normalized organization, venue, and topic.
- Normalize aliases for search while displaying one canonical label. Examples
  include `Meta`, `Meta AI`, and `Facebook AI Research`, or `NeurIPS` and
  `Neural Information Processing Systems`.

### 4.2 Source coverage

Add adapter/configuration support for authoritative organization and venue
sources without requiring a paid service:

- Official organization research feeds, APIs, or reviewed publication pages
  for publishers such as Google, Google DeepMind, and Meta AI.
- Official proceedings, feeds, or structured APIs for venues such as ICML and
  NeurIPS.
- Explicit source metadata that stamps a trusted organization or venue onto
  records collected from that source.

Provider-specific adapters should remain behind the existing research adapter
boundary. If a source does not expose stable structured data, it should not be
scraped through fragile page selectors in the first iteration.

### 4.3 Topic taxonomy

Create a small reviewed research-topic taxonomy and mapping layer.

- Map reliable arXiv categories, explicit source tags, and structured provider
  topics to Observatory topics.
- Support at minimum computer vision and robotics in the first release.
- Keep original provider categories alongside normalized topics.
- Permit future topic aliases without rewriting canonical research records.

### 4.4 Search and filtering

Search should cover:

- Title and summary/abstract excerpt.
- Authors and publisher.
- Organization.
- Venue.
- Normalized topic and original category.
- Tags and tracked source name.

Provide dedicated filters for:

- Organization.
- Venue.
- Topic.
- Content type.
- Tracked source.
- Date range or recent window.

Provide sorting for:

- Newest first, as the default.
- Oldest first.
- Relevance when a text query is present.

Search and filter state must be encoded in URL parameters. Changing a query,
filter, or sort order resets pagination to page 1. Matching should be
case-insensitive, alias-aware, and tolerant of punctuation and common spacing
differences. Quoted phrase support is desirable but not required for the first
iteration.

Required user journeys include:

- Select Google or Meta and see their newest tracked publications.
- Select ICML or NeurIPS and see the newest tracked proceedings records.
- Select Computer Vision or Robotics and see the newest matching work.
- Combine organization, venue, topic, date, and text filters.

If no authoritative source for a requested facet is configured, the interface
must say that coverage is not configured rather than implying there are no
publications.

### 4.5 Static pagination architecture

Keep the site static and avoid a database dependency:

1. Generate a lightweight `research/index.json` containing summaries, facets,
   source coverage, and a page/shard manifest.
2. Generate bounded full-record page shards instead of embedding up to 1,000
   full records in the index.
3. Generate a compact search index with normalized searchable fields, record
   IDs, and shard pointers.
4. Load the search index lazily when the user searches or activates a facet
   that requires global matching.
5. Fetch only the shards necessary to render the current result page and cache
   previously loaded shards in the browser.
6. Use a default page size of 24 or 25 and provide previous, next, page count,
   result count, and an accessible page-size control if needed later.
7. Reuse or replace the currently generated research day files; do not retain
   both a full index and an unused duplicate set of daily files.

### Acceptance criteria

- Initial Research load does not download or render 1,000 records.
- No more than one result page is rendered initially.
- Page, query, filters, and sort can be shared by URL and survive refresh.
- Google/Meta, ICML/NeurIPS, Computer Vision, and Robotics journeys work when
  corresponding authoritative sources contain records.
- Search results are deterministic for a fixed generated dataset.
- Empty results distinguish `no match` from `coverage not configured`.
- Existing source Add/Edit review workflows remain available.
- Tests cover normalization, aliases, combined filters, sorting, pagination,
  URL state, empty states, and shard loading.

## Phase 5: Payload cleanup, dead artifacts, and public wording

**Weight:** Light to medium; group the smaller cleanup items  
**Purpose:** Remove hidden duplication and internal implementation language.

### Generated data cleanup

1. Produce a compact Today artifact rather than loading the complete Research,
   Models, Health, and Curation indexes to display summary numbers.
2. Remove the unused Phase 2 `activity.json` artifact, its dedicated generator,
   tests that exist only for that artifact, and obsolete documentation, after
   confirming there is no external consumer.
3. Reduce the Models artifact.
   - Remove unused `recentEvents` from the public payload.
   - Do not include each model's complete `releases` array unless the UI has a
     lazy detail view that consumes it.
   - Remove unused `latestEvent`, `firstObservedAt`, and `lastObservedAt` fields
     from the public card model.
   - Make `latestByCategory` reference compact model summaries instead of
     embedding complete catalog entries again.
4. Remove obsolete source artifacts after the Radar merge.
5. Avoid emitting unused research shards after the pagination architecture is
   active.

### Public wording cleanup

1. Replace the unconditional `Dashboard active` badge with status derived from
   collection freshness and the latest run.
2. Remove `Phase 7` and other implementation milestones from the public header.
3. Remove roadmap language such as `eventually model-specific API behavior`
   from public page descriptions.
4. Keep assistance/provenance metadata in stored curation records, but do not
   display provider or model implementation details in the public note for now.
5. Use neutral public labels such as `Daily note`, `Reviewed`, and `Evidence`.
6. Ensure model counters distinguish revisions, first observations, and actual
   releases instead of calling every provider update a release.
7. Remove or rename the Research `Match` score unless the UI clearly explains
   that it is a deterministic source/recency rank rather than model confidence.

### Acceptance criteria

- Today loads one compact summary artifact plus only the selected day's data.
- No generated artifact or exported payload field is retained without a known
  consumer or documented compatibility requirement.
- The Models payload contains no duplicated full event history.
- Public copy describes observable product behavior, not internal phases or
  future roadmap.
- Status labels are calculated from actual run and freshness data.

## Phase 6: Quality gate, documentation, and release hardening

**Weight:** Medium  
**Purpose:** Verify the six-phase cleanup as one coherent product before calling
the work complete.

### Automated checks

1. Add a generated-link audit for:
   - Provider-specific URL shapes.
   - Internal application routes and redirects.
   - Curation evidence references.
   - Relationships between observations and derived model events.
2. Add integration tests for the final five-page navigation.
3. Add browser-level tests for:
   - Today date navigation.
   - Radar source filtering and management links.
   - Research search, combined facets, sorting, pagination, refresh, and browser
     back/forward navigation.
   - Model-card and evidence links.
   - API Health focused-monitor URLs.
4. Add accessibility checks for keyboard navigation, focus behavior, labels,
   result announcements, and pagination controls.
5. Add deterministic generated-artifact tests so a rebuild with the same input
   does not produce content drift beyond `generatedAt`.

### Performance budgets

Use budgets as regression guards rather than exact permanent limits:

- Today initial generated JSON: target at or below 250 KB uncompressed.
- Research initial metadata plus first result page: target at or below 250 KB.
- A Research result shard: target at or below 150 KB.
- Models index: target at or below 250 KB unless a documented feature requires
  more.
- No page should render hundreds of cards on initial load.

Record measured compressed and uncompressed sizes in the pull request for this
phase and adjust budgets only with an explanation.

### Documentation and rollout

1. Update dashboard, research, source-management, model-radar, and maintainer
   documentation to match the final routes and artifacts.
2. Document the Hugging Face migration report and recovery procedure.
3. Document Research coverage semantics so missing coverage is not confused
   with zero publications.
4. Run the complete validation, test, typecheck, lint, formatting, and static
   build suites.
5. Verify the GitHub Pages base path and redirects in the deployed build.
6. Compare key counts before and after migration and retain the report with the
   implementation pull request.

### Final acceptance criteria

- The site has five primary destinations with no lost management capability.
- Broken Hugging Face links and duplicate model presentation are resolved.
- Research is paginated, searchable, sortable, facet-driven, and source-aware.
- Initial page payloads meet the agreed budgets.
- Legacy routes redirect correctly.
- Documentation describes the current product rather than completed phases.
- `corepack pnpm check` and deployed GitHub Pages verification pass.

## Deferred work

The following are intentionally outside this six-phase fix:

- Moving canonical data to a database or external object store.
- Long-term API-health retention and archival policy.
- Paid research metadata services.
- Semantic/vector search that requires embeddings or a hosted search backend.
- Fully autonomous public curation without maintainer review.

These can be reconsidered after the current repository size, source coverage,
and user needs justify the added complexity.
