# Cognitive Biases agent loop

## Goal

Turn Cognitive Biases from a mobile-app landing page plus flat glossary into a source-traceable decision-debugging knowledge system.

The product should help a reader move through four steps:

**Recognize → Test → Counter → Decide**

A larger list of bias names is not the objective. The objective is a trustworthy, navigable knowledge base that helps people inspect a decision and choose a better next action.

## Product principles

1. **Trust before scale.** Prefer reviewed, sourced entries over automatically expanding page count.
2. **One canonical concept.** Merge duplicates and model aliases instead of publishing competing definitions.
3. **Evidence is part of the content.** Distinguish strong, moderate, mixed, debated, and historical claims.
4. **Relationships have meaning.** Related concepts should eventually explain whether they overlap, contrast, cause confusion, or provide a countermeasure.
5. **Useful pages have intent.** Family, context, comparison, and research pages should exist only when they answer a distinct user question.
6. **The website is the canonical knowledge layer.** The mobile app is one interface over that knowledge, not the only reason the site exists.
7. **Static-first remains the default.** Keep the deployment cheap, fast, inspectable, and portable.

## Loop

Every improvement cycle follows the same sequence:

1. **Audit** — inspect content quality, search structure, technical health, and user paths.
2. **Prioritize** — choose the smallest change with the strongest impact on trust, discovery, or usefulness.
3. **Implement** — change data, generation, or UX without creating parallel sources of truth.
4. **Validate** — run data checks, build checks, link/schema checks, and inspect the generated result.
5. **Ship** — merge only after the generated site is internally consistent.
6. **Measure** — use Search Console, store traffic, repository issues, and content-quality metrics to choose the next cycle.

## Roadmap

### Phase 1 — foundation

- Repair category navigation and sitemap metadata.
- Validate IDs, slugs, relations, and required fields in CI.
- Define the v2 content model before mass-editing the corpus.
- Preserve the current static build and canonical URL structure.

### Phase 2 — corpus normalization

- Inventory duplicate and near-duplicate concepts.
- Introduce `kind`, `family`, aliases, contexts, evidence status, sources, and review dates.
- Merge duplicate concepts while preserving redirects from old slugs.
- Migrate richer material from the former MetalHatsCats pages into canonical entries.

### Phase 3 — knowledge architecture

- Generate family hubs from normalized data.
- Add context hubs such as decision-making, work, finance, relationships, and learning only where the corpus supports them.
- Add typed related-concept links and focused comparison pages.
- Add Dataset structured data for the public corpus.

### Phase 4 — decision tools

- Add a lightweight Decision Audit based on Recognize → Test → Counter → Decide.
- Let entries expose reusable reflection prompts rather than generic advice.
- Connect the mobile app to the same canonical content model.

### Phase 5 — growth

- Expand research-backed long-form pages for high-intent concepts.
- Build comparison and problem-oriented pages from real search demand.
- Add additional languages only after the English ontology and citation model are stable.

## Definition of done for each cycle

A cycle is complete only when:

- the source data remains the single source of truth;
- `npm run check` passes;
- generated canonical URLs remain stable or have explicit redirects;
- new claims have an evidence path where the content model supports it;
- no new duplicate concept or orphan relation is introduced;
- the change improves trust, discovery, or decision usefulness rather than merely increasing page count.

## Metrics

Track a small set of signals instead of vanity page counts:

- indexed canonical bias pages;
- non-brand organic impressions and clicks;
- number of reviewed/sourced entries;
- duplicate/unresolved concept count;
- internal-link coverage and orphan count;
- visits from bias entry → related concept / decision tool / app;
- returning visitors and app-store referral clicks.
