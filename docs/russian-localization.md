# Russian localization policy

The English dataset remains the canonical source of record. Russian is a reviewed editorial layer for people and AI systems, not a second independent taxonomy.

## Product goal

The Russian surface should help a reader do three things:

1. understand the mechanism without translation-heavy wording;
2. recognize the practical decision trap;
3. perform a concrete check that can reduce the risk of the error.

A Russian page is not considered complete because its title was translated. Practical guidance is part of the localization contract.

## Public routes

- `/ru/` — Russian entry point;
- `/ru/biases/` — reviewed localized bias pages;
- `/ru/techniques/` — the complete structured technique set;
- `/ru/skills/` — the complete decision-skill set;
- `/data/ru/biases.json` — machine-readable reviewed bias localization;
- `/data/ru/techniques.json` — machine-readable Russian techniques;
- `/data/ru/skills.json` — machine-readable Russian skills.

The older `data/translations-ru.json` file is a small label registry retained for compatibility. New practical localization work belongs in `data/ru/` until the legacy registry is deliberately migrated.

## Translation rules

### Bias names

Prefer an established Russian scientific or educational term when one is common and unambiguous. Keep the English concept name as an alias for search and cross-language matching.

Examples:

- Confirmation bias → `Склонность к подтверждению` (alias: `предвзятость подтверждения`);
- Anchoring effect → `Эффект якоря`;
- Availability heuristic → `Эвристика доступности`;
- Hindsight bias → `Ошибка ретроспективы`;
- Automation bias → `Склонность доверять автоматизации`.

Do not invent a confident Russian scientific term for a concept whose terminology is unstable. A clear descriptive name plus the English alias is better than false precision.

### Practical guidance

Avoid vague advice such as `думайте критически`, `будьте объективны` or `не поддавайтесь искажению` unless it is converted into an observable action.

Prefer actions such as:

- write the forecast before the outcome;
- define evidence that would weaken the current conclusion;
- compare the vivid case with a base rate;
- make an independent estimate before seeing the anchor;
- define stop or review criteria before new evidence arrives;
- trace repeated claims to independent sources.

Do not claim that a technique removes a bias. Use wording such as `снижает риск`, `помогает заметить`, `делает решение проверяемым` or `даёт альтернативную проверку`.

### Tone

Write natural modern Russian. Prefer short sentences and concrete verbs. Avoid literal English syntax, excessive nominalizations, bureaucratic language, motivational filler and diagnostic labels for people.

## Evidence boundary

Localization must not strengthen the source claim. If the English evidence review is qualified, the Russian explanation must preserve the qualification. Legacy generated descriptions are not automatically promoted to reviewed Russian content.

The reviewed Russian bias set can therefore be smaller than the canonical English catalog. Missing is better than confidently mistranslated.

## SEO and AEO

Localized pages use the canonical English slug under `/ru/` so entity identity stays stable across languages. Equivalent English/Russian pages receive reciprocal `hreflang` links and each Russian page has a self-canonical URL. English aliases remain visible in the content and structured data to support bilingual search.

Do not add `hreflang=en` to a Russian page when there is no equivalent English public page. For example, the Russian technique pages currently expose structured source data that does not yet have one-to-one English HTML pages.

## Quality gate

`scripts/check-ru-localization.mjs` verifies that:

- every canonical technique has exactly one Russian version;
- every canonical decision skill has exactly one Russian version;
- reviewed Russian bias entries contain a Russian title, mechanism, trap and at least three actions;
- generated pages use `lang=ru`, self-canonical URLs and Russian hreflang;
- equivalent English bias pages link back to the Russian alternate;
- obvious English UI fragments do not leak into the Russian surface;
- every generated Russian page is included in the sitemap.

Run the normal repository check command; the Russian gate is executed from the standard static-site checker after the localization generator runs in the post-build phase.
