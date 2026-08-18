# Search quality review

Use this skill before publishing a new public page, context, comparison, research note, or substantial rewrite.

## Goal

Keep search visibility aligned with useful human-readable content. The task is not to add more keywords. The task is to make each indexed page distinct, crawlable, understandable and connected to the rest of the knowledge base.

## Review loop

1. Read the page as a person first. Confirm that the title and first paragraph answer a real question in plain language.
2. Check that the page has one clear H1, a descriptive title, a page-specific meta description and a self-referential canonical URL.
3. Confirm that important concepts are linked with normal crawlable `<a href>` links using concise anchor text.
4. Reuse the canonical concept, evidence and relation data. Do not create a second page that says nearly the same thing just to target another phrase.
5. Add structured data only when it describes visible content on the page. Prefer the existing generated `DefinedTerm`, `Article`, `Dataset`, `BreadcrumbList`, `CollectionPage` and context relationships.
6. If the page has a reliable significant-update date, use it for freshness metadata. Never use the deployment time as fake freshness.
7. For evidence-sensitive copy, keep the reviewed sources and uncertainty visible. Search wording must not make the scientific claim stronger.
8. Run `npm run check`. Treat failures from `check-search-quality.mjs` as content or architecture defects, not as a reason to weaken the gate.

## Do not

- add meta keywords;
- stuff titles with synonyms;
- create thin FAQ pages for rich-result markup;
- duplicate a page for a slightly different search phrase;
- add schema types that do not match the visible page;
- remove a limitation or caveat to make a title more clickable;
- use a build date as `lastmod`;
- hide important navigation in non-crawlable click handlers.

## When a search-intent page is justified

Create a new page only when it adds a distinct useful job for a reader. Good examples are a comparison that separates two commonly confused constructs, a decision context with a concrete workflow, or a research synthesis that explains what changed in the evidence.

If the proposed page would mostly repeat an existing concept page, improve and link the existing page instead.
