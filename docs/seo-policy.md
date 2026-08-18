# SEO and discovery policy

The project is written for people first. Search visibility should come from useful pages, clear structure and trustworthy evidence, not from keyword stuffing or pages created only to capture queries.

## What every public page should do

A page should answer a real question in plain English. The title, description, headings and structured data must describe the same thing a person can actually read on the page.

Prefer one clear page for one useful intent. Do not create near-duplicate pages by changing a few words in the title.

## Structured data

Use JSON-LD because it is easy to generate and validate from the maintained data.

The main semantic types are:

- `DefinedTerm` for canonical bias and concept pages;
- `DefinedTermSet` for the library;
- `BreadcrumbList` for hierarchy;
- `Article` for reviewed research notes;
- `Dataset` and `DataDownload` for the public knowledge release;
- `CollectionPage` and `ItemList` for genuine collections such as Research and Decision contexts.

Do not add a schema type simply because it might create a richer search result. The type must match the visible page.

## Titles and descriptions

Write titles for a person who is deciding whether the page answers their question. Keep the canonical concept name near the beginning.

Descriptions should explain what the reader will learn. Do not repeat lists of keywords or make claims stronger than the evidence review.

## Evidence and provenance

Evidence-reviewed concept pages should expose their reviewed source links in both the visible page and structured metadata. Research notes should identify publication date, publisher and the sources used in the synthesis.

A citation in structured data does not make a claim true. It only makes provenance easier for search systems and other tools to follow.

## Crawlability

The public site must remain crawlable, canonical URLs must be stable, and the XML sitemap must contain the pages we want indexed. `robots.txt` should advertise the XML sitemap and allow search crawlers used by the project, including OAI-SearchBot for ChatGPT search discovery.

Research also publishes an Atom feed. It contains the maintained research notes and is advertised as an additional sitemap so crawlers can notice recent research updates without replacing the full XML sitemap.

Alias and retired duplicate pages should continue to point to the canonical record rather than competing with it.

## Honest freshness signals

Use sitemap `lastmod` only when the repository has a reliable date for the last significant content change. A build date is not a content date.

Research notes use their maintained publication or update dates. A resource page without a reliable content date should omit `lastmod` rather than pretend it changed on every deployment.

The same rule applies to feeds: an entry's `updated` value must come from the maintained content record, not from the time the static site happened to rebuild.

## Multilingual pages

When German and Russian pages are published, each language gets its own stable URL. Only publish `hreflang` links when both sides exist and contain real translated content. Every language version should link back to itself and to the other available versions.

Do not create thin machine-translated copies simply to increase the number of indexed URLs.

## Research pages

Research notes are valuable search pages only when they add a real synthesis: what was tested, what changed, what remains uncertain and what this changes in the library. A news headline without analysis is not a research note.

## Quality checks

CI should fail when important structured data disappears, source provenance is lost, the dataset no longer exposes downloadable distributions, old app-first metadata returns, feed discovery breaks, or sitemap freshness starts using deployment dates as fake content dates.

Search Console and referral data should guide future work, but ranking changes alone are not a reason to weaken scientific wording.
