# Translation review state

English is the canonical editorial layer. Localized views reuse the same canonical concepts rather than creating independent knowledge bases.

Each translated record keeps the canonical ID and the `sourceRelease` it was reviewed against.

States:

- `missing` — no translation is maintained yet;
- `draft` — wording exists but has not completed review;
- `reviewed` — wording was checked against the current canonical release;
- `stale` — it was reviewed before, but the canonical release has changed materially since that review.

Evidence class, source identity, relations and other scientific metadata stay language-independent.

## French coverage contract

French is a complete reviewed human-language layer for the currently published bias catalog. Every canonical record with `published: true` must have a French translation. The French localization check fails if a new published bias is missing from the French dataset.

French also covers the complete canonical Decision Skills library in `data/skills.json`. Every canonical decision skill must have a reviewed French entry with a natural title, English recognition alias, summary, learning outcome, realistic use cases, a practical procedure, an example and an explicit boundary. The French skills check fails if the canonical skill library grows without matching French coverage.

The French skill URL is localized for human readers, while the canonical skill slug remains unchanged in structured data and public datasets. Linked bias lenses keep their canonical IDs. Linked decision contexts may remain English until a dedicated French context layer exists; they must be marked as English rather than silently inserted as English body copy on a French page.

## Spanish coverage contract

Spanish is also a complete reviewed human-language layer for the currently published bias catalog. Every canonical record with `published: true` must have a Spanish translation, and every canonical decision technique and Decision Skill must have a reviewed Spanish equivalent. `npm run check:spanish-localization` and `npm run check:spanish-skills` fail when canonical coverage grows without matching Spanish coverage.

Spanish uses neutral international wording while keeping regionally useful discovery terms as aliases where appropriate. Human URLs use localized Spanish slugs, but canonical bias and skill identifiers remain English in structured data and public datasets. Linked decision contexts may remain English until a dedicated Spanish context layer exists; they must be marked as English instead of being presented as translated content.

See `docs/localization-es.md` for terminology, routing, SEO, evidence-boundary and agent-routing rules.

## Evidence review is a separate state

Complete French or Spanish translation coverage does **not** mean every canonical bias has completed a dedicated evidence review. Translation review and evidence review are independent states:

- a reviewed translation says the localized terminology and wording were checked;
- a canonical evidence review says the scientific claims for that entity were separately reviewed.

Localized pages without a dedicated evidence review expose that limitation instead of inheriting or inventing scientific certainty.

A localized Decision Skill is a practical reasoning workflow. It does not prove that a linked bias caused a decision and does not guarantee a better outcome.

German and Russian remain smaller reviewed layers. Their explicit gaps are preferable to silent mixed-language or machine-generated coverage.
