# Russian localization policy

The Russian surface is a reviewed localization layer, not a bulk translation of the English corpus.

## Editorial standard

Russian copy must translate meaning rather than English syntax. A useful Russian page should be understandable before the reader knows the academic term and should answer four questions:

1. What can happen in plain language?
2. What exactly is the trap?
3. What does the evidence support, and where does the claim stop?
4. What can the reader check or do before the next decision?

Do not publish a Russian concept page merely because a machine translation exists. Missing coverage is preferable to authoritative-looking low-quality prose.

## Reviewed evidence layer

Every concept with a controlled evidence class in `data/evidence-classes.json` must have a reviewed Russian counterpart. The build treats this as an exact coverage invariant rather than a target count.

Curated Russian concept data may be split across `data/ru/biases.json` and `data/ru/biases-reviewed-expansion-*.json` for maintainability. The public build merges them into one `/data/ru/biases.json` and one coherent `/ru/biases/` collection.

A reviewed concept entry must include:

- a natural Russian title plus the canonical English title for search and disambiguation;
- a plain-language summary;
- a concrete description of the trap;
- an evidence summary that preserves the canonical review boundary;
- an explicit limitation or boundary section;
- at least three observable, practical actions.

Popular simplifications must be corrected when the evidence is narrower. Examples include Dunning–Kruger, the Backfire Effect, Hungry Judge Effect, Declinism, Loss Aversion and project-specific labels.

## Terminology

Prefer established Russian terminology when it is clear and natural. If no stable translation exists, use a descriptive Russian title and preserve the canonical English term as an alias. Do not invent an academic-sounding Russian term merely to avoid English.

Original study titles stay in English unless an established official Russian title exists. Canonical IDs, schema fields and machine-facing identifiers remain language-stable.

## Interface contract

A Russian page must remain Russian after interaction. This includes:

- primary navigation and breadcrumbs;
- collection search and result-count/empty states;
- Save / Saved, Share, Copy link and Cite actions;
- success, error and browser-fallback messages;
- accessibility labels;
- mobile/responsive interface copy.

Language switches should route to the nearest true English equivalent, not automatically to the English homepage.

## Evidence and safety boundaries

Localization must not strengthen a claim beyond the canonical evidence review. Keep contested, mixed, domain-specific and methodological concepts visibly distinct from established effects.

Practical checks are decision procedures, not promises to eliminate a bias. The site is educational and does not replace medical, legal, financial or psychological advice.

## Machine-readable parity

Human-visible Russian content and `/data/ru/*.json` must agree. Russian pages use self-canonicals and reciprocal `hreflang` only where the English page is a true equivalent. AI guidance in `ai/llms.ru.txt` should prefer reviewed Russian content and fall back to canonical English rather than inventing translations.
