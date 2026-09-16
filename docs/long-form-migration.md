# Long-form bias article migration

## Why this exists

The current Cognitive Biases site inherited the canonical bias catalogue and evidence model, but many bias pages still expose only the older short `description` record plus the newer evidence block. The earlier Metalhatscats site had a much larger article layer for many of the same slugs.

Losing that narrative depth made the canonical pages less useful for readers and removed material that could explain mechanisms, examples, distinctions and practical checks in one place.

This migration restores long-form reading depth without bringing the old publishing model back.

## Canonical rule

A long-form article is an extension of the existing canonical bias page:

`/biases/<canonical-slug>/`

Do not create a second SEO article URL for the same bias. The short definition remains useful for quick scanning and retrieval; the long-form guide explains the concept in depth on the same canonical page.

## Evidence rule

A bias may receive a long-form article only when it already has a current evidence review.

The evidence review remains the source of truth for scientific claims. Long-form prose may explain and apply that reviewed meaning, but it must not silently strengthen the claim, remove limitations or invent a mechanism.

If a legacy article exists but the canonical bias is still unreviewed, keep the legacy material as migration inventory until an evidence review is complete. Page length is not a reason to publish unsupported claims.

## Originality rule

The old Metalhatscats URL is provenance, not copy source.

Do not paste the old article body into the new site. Reconstruct the useful ideas from the current canonical record, evidence review, reviewed sources, comparisons, contexts and decision guides, then write new prose in the current B2 semi-formal editorial style.

This also prevents the two owned sites from competing with substantially identical text while old URLs and search caches are still visible.

## Storage

Each long-form article lives in its own file:

```text
data/long-form/<canonical-slug>.json
```

The file name must match the entry's `slug`. `scripts/apply-long-form-articles.mjs` and `scripts/check-long-form-articles.mjs` load every `data/long-form/*.json` file in deterministic sorted order, so articles can be added, reviewed and regenerated independently without a single shared document becoming a merge bottleneck.

`scripts/inventory-legacy-long-form.mjs` maintains the machine-readable migration roadmap under `.artifacts/long-form-migration/` (local working artifact, not published). Because the live legacy URLs now redirect to this site (see `docs/migration-map.md`), the inventory probes the Wayback Machine for historical snapshots of each legacy article.

## Page structure

The long-form layer should normally provide:

1. a useful headline and lede;
2. four or more explanatory sections;
3. realistic examples or worked situations;
4. distinctions from commonly confused concepts where relevant;
5. a concrete decision checklist;
6. an explicit evidence boundary;
7. links to a matching practical guide when one exists;
8. current evidence sources through the existing evidence review;
9. Article structured data tied to the same canonical page.

The long-form article is rendered before the evidence review so the reader moves from explanation to the explicit research boundary and sources.

## Quality gate

`scripts/check-long-form-articles.mjs` verifies that every migrated article:

- targets a published canonical bias rather than a duplicate alias;
- has a current evidence review;
- has a valid review date and matching legacy provenance URL;
- meets minimum structural and narrative depth;
- includes a decision checklist and evidence boundary;
- renders on the canonical bias page before the evidence review;
- emits Article structured data;
- retains the current evidence sources in the final page;
- links matching everyday guides when available.

This gate is intentionally a floor, not a target word count. It exists to prevent a future generator or redesign from silently collapsing the restored article layer back into short glossary text.

## Migration status

### Batch 1 — restored 2026-09-16

- Hindsight Bias
- Anchoring Effect
- Confirmation Bias
- Availability Bias
- Sunk Cost Effect
- Escalation of Commitment
- Loss Aversion
- Outcome Bias

These were selected because they have reviewed evidence, broad decision relevance and strong connections to existing everyday guides or decision tools.

## Next batches

Continue from reviewed concepts first. Prioritize pages where all three conditions are true:

- the old site contains useful long-form material or the current short page is clearly under-serving the topic;
- the canonical bias already has a reviewed evidence record;
- the concept has real decision, comparison, context or search value.

For each batch use the loop:

`inventory → evidence check → rewrite → render → content review → build/check → deploy → verify live`

Do not treat the number of migrated articles as the quality metric. The useful metric is how many canonical bias pages combine clear explanation, honest evidence boundaries and an actionable next step without duplicating unsupported legacy claims.
