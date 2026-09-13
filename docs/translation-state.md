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

This does **not** mean every canonical bias has completed a dedicated evidence review. Translation review and evidence review are independent states:

- a reviewed translation says the localized terminology and wording were checked;
- a canonical evidence review says the scientific claims for that entity were separately reviewed.

French pages without a dedicated evidence review expose that limitation instead of inheriting or inventing scientific certainty.

German and Russian remain smaller reviewed layers. Their explicit gaps are preferable to silent mixed-language or machine-generated coverage.
