# Cognitive Biases content model v2

This document defines the target model for the next corpus migration. It is intentionally documented before changing all existing records.

## Why change the model

The current corpus is optimized for rendering a glossary: title, category, description, related IDs, and a slug. That is enough for a catalogue but not enough for a trustworthy knowledge system.

The v2 model separates identity, taxonomy, educational content, evidence, relationships, and publishing metadata so the same record can support the website, mobile app, search pages, comparisons, and decision tools.

## Proposed record

```json
{
  "id": 1,
  "slug": "information-bias-common-source-bias",
  "canonicalName": "Common Source Bias",
  "displayTitle": "Common Source Bias – when everyone repeats the same thing",
  "aliases": [],
  "kind": "bias",
  "family": "information-evaluation",
  "contexts": ["media", "research", "decision-making"],
  "summary": "A concise plain-language definition.",
  "mechanism": "What is believed to produce the effect and under what conditions.",
  "examples": [
    { "context": "media", "text": "Example text" }
  ],
  "countermeasures": [
    { "prompt": "What independent source would change my confidence?" }
  ],
  "evidence": {
    "status": "moderate",
    "note": "Short qualification or boundary condition."
  },
  "sources": [
    {
      "type": "paper",
      "title": "Source title",
      "authors": ["Author Name"],
      "year": 2024,
      "doi": null,
      "url": "https://example.org/source"
    }
  ],
  "relations": [
    { "id": 14, "type": "related" }
  ],
  "legacySlugs": [],
  "reviewedAt": "2026-08-18",
  "updatedAt": "2026-08-18T00:00:00.000Z",
  "published": true
}
```

## Controlled fields

### `kind`

Start with a small vocabulary and expand only when the corpus requires it:

- `bias`
- `effect`
- `heuristic`
- `fallacy`
- `phenomenon`
- `principle`

The public project may still use "cognitive biases" as the umbrella brand. `kind` exists to stop the data model from pretending every entry is scientifically the same type of thing.

### `evidence.status`

- `strong` — replicated or strongly supported across relevant literature.
- `moderate` — meaningful support with known limitations or narrower conditions.
- `mixed` — credible evidence points in more than one direction.
- `debated` — important disagreement, replication concern, or unstable definition.
- `historical` — useful mainly as a historical concept or older framing.
- `unreviewed` — not yet reviewed under the v2 process.

Evidence status is editorial metadata, not a numerical scientific score.

### `relations.type`

Begin with:

- `related`
- `overlaps-with`
- `contrasts-with`
- `often-confused-with`
- `special-case-of`
- `broader-than`
- `countered-by`

Relations should be added only when a short explanation can justify them.

## Migration rules

1. Preserve current `id` values whenever possible.
2. Preserve current canonical slugs unless there is a strong reason to rename them.
3. If a slug changes or duplicate records are merged, store every old slug in `legacySlugs` and generate a redirect map.
4. Do not fabricate citations to fill the model. Use `unreviewed` until sources are actually reviewed.
5. Do not automatically classify evidence strength from an LLM summary alone.
6. Keep existing plain-language descriptions available during migration so the website never depends on a partially populated v2 field set.
7. Normalize duplicates before generating new family, comparison, or context pages.

## Migration sequence

1. Produce a corpus inventory: duplicate titles, near-duplicates, missing relations, categories, and legacy URLs.
2. Create a taxonomy map from existing `typeOfBias` values to candidate `kind` and `family` values.
3. Migrate a small reviewed pilot set of 10–20 important entries.
4. Update the renderer to support v1 and v2 records during transition.
5. Validate the pilot pages and redirects.
6. Migrate the remaining corpus in batches with explicit review status.

## Editorial rule

The project should prefer a qualified statement that reflects uncertainty over a memorable statement that overclaims an effect. A trustworthy smaller entry is better than a confident but unsupported one.
