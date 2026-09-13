# Russian localization policy

The English knowledge model remains canonical. Russian is a reviewed editorial and product layer for people and AI systems, not a second independent taxonomy.

## Product goal

A good Russian page should let a reader do four things without first learning specialist vocabulary:

1. recognize a familiar decision or information problem;
2. understand the mechanism in natural Russian;
3. see what the reviewed evidence does and does not support;
4. perform one or more concrete checks before the next decision.

A page is not complete because its title was translated. Interface copy, evidence boundaries, examples, practical actions, related journeys and interaction states are part of the localization contract.

## Public routes

- `/ru/` — Russian entry point;
- `/ru/biases/` — reviewed localized bias pages;
- `/ru/techniques/` — the complete structured technique set;
- `/ru/skills/` — the complete decision-skill set;
- `/ru/everyday/` — situation-first practical articles;
- `/data/ru/biases.json` — machine-readable reviewed bias localization;
- `/data/ru/techniques.json` — machine-readable Russian techniques;
- `/data/ru/skills.json` — machine-readable Russian skills;
- `/data/ru/everyday-guides.json` — machine-readable Russian practical articles.

The older `data/translations-ru.json` file is a small compatibility registry. New product localization belongs in `data/ru/` until the legacy registry is deliberately migrated.

## Translation rules

### Bias names

Prefer an established Russian scientific or educational term when it is common and unambiguous. Keep the English concept name as an alias for search and cross-language matching.

Examples:

- Confirmation bias → `Склонность к подтверждению`;
- Anchoring effect → `Эффект якоря`;
- Availability heuristic → `Эвристика доступности`;
- Hindsight bias → `Ошибка ретроспективы`;
- Automation bias → a clear descriptive Russian label rather than a forced calque.

Do not invent a confident Russian scientific term when terminology is unstable. A clear descriptive name plus the English alias is better than false precision.

### Natural Russian

Translate the meaning, not the English syntax.

Prefer short sentences, active verbs and ordinary Russian phrasing. Avoid bureaucratic language, excessive nouns, literal English word order, unexplained project jargon and mixed-language copy such as `Название bias`, `evidence review` or `legacy-текст` in the public interface.

English terms may remain where they serve identity or navigation: canonical concept aliases, original research titles, schema/data field names and an explicitly labelled language switch.

### Practical guidance

Avoid vague advice such as `думайте критически`, `будьте объективны` or `не поддавайтесь искажению` unless it becomes an observable action.

Prefer actions such as:

- write the forecast before the outcome;
- define evidence that would weaken the current conclusion;
- compare a vivid case with a base rate;
- make an independent estimate before seeing the anchor;
- define stop or review criteria before new evidence arrives;
- trace repeated claims to independent sources.

Do not claim that a technique removes a bias. Prefer language equivalent to `снижает риск`, `помогает заметить`, `делает решение проверяемым` or `даёт альтернативную проверку`.

## Evidence localization

A reviewed Russian bias page should expose the evidence boundary directly instead of forcing the reader to infer it from the English source page.

The localized page should normally contain:

- a plain-language summary;
- the practical trap;
- a Russian summary of what the reviewed evidence supports;
- an explicit boundary or important limitation;
- practical checks;
- original source titles and stable links;
- the review date when available;
- a link to the complete canonical English evidence review.

Localization must never strengthen the canonical claim. If the English review is mixed, contested, domain-specific or qualified, the Russian explanation must preserve that strength and scope. Source titles are not translated unless an established official translated title is known.

## Situation-first articles

Practical articles under `/ru/everyday/` should be localized as articles, not sentence-by-sentence translations.

Each article should contain:

1. a familiar concrete situation;
2. a plain explanation of what may be happening;
3. why the mechanism matters for the decision;
4. one small action the reader can try;
5. one memorable question to carry into the next decision;
6. a link to the reviewed Russian concept and its evidence boundary.

Examples may be adapted for clarity, but must not invent evidence, outcomes or precision. The Russian article should feel written for a Russian-speaking reader while preserving the same scientific meaning as the canonical article.

## Interface and widget localization

A Russian page should stay Russian after the user clicks something.

Localize:

- navigation and breadcrumbs;
- buttons and utility controls;
- saved/unsaved states;
- success and error feedback;
- search labels, result counts and empty states;
- section headings and metadata labels;
- accessibility labels where they are user-facing.

The language switch should point to the closest true English equivalent when one exists. Do not declare `hreflang` between pages that are only loosely related or have materially different coverage.

Reusable global scripts may serve both languages, but they must detect the page language and return localized labels and feedback. Russian collection search should normalize ordinary Russian input, including `ё`/`е`, and must remain useful without requiring English aliases.

## SEO and AEO

Localized pages keep the canonical English slug under `/ru/` so entity identity remains stable across languages. True English/Russian equivalents receive reciprocal `hreflang`; each Russian page uses a self-canonical URL. English aliases remain available in visible content or structured data where they help bilingual search and entity matching.

Do not claim that localization or hreflang guarantees ranking, indexing or AI citation.

## Quality gate

`scripts/check-ru-localization.mjs` should fail when the Russian product surface becomes incomplete or visibly mixed-language. It verifies, among other things, that:

- every canonical technique has exactly one Russian version;
- every canonical decision skill has exactly one Russian version;
- every canonical everyday guide has exactly one reviewed Russian article;
- reviewed Russian bias entries contain Russian title, explanation, trap, evidence boundary and practical actions;
- localized bias entries point to canonical reviewed evidence and a controlled evidence class;
- generated pages use `lang=ru`, self-canonicals and valid Russian alternate metadata;
- true English equivalents link back to Russian alternates;
- Russian detail pages expose localized breadcrumbs and page utilities;
- Russian collection search exposes localized labels, counts and empty states;
- obvious English UI fragments and internal project jargon do not leak into the public Russian surface;
- generated Russian routes and machine-readable datasets exist and are included in the sitemap where applicable.

Run the normal repository checks. Do not weaken evidence, canonical or localization gates merely to make a build green.
