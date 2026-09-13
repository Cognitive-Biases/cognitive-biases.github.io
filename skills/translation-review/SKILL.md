# Translation and localization review

Use this skill when adding, expanding or reviewing a localized Cognitive Biases surface: UI, bias catalogue, techniques, Decision Skills, Agent Skills, everyday/research/decision guides, accessibility, Search metadata or agent-routing assets.

Read `docs/localization.md`, `data/localization-profile.json`, the locale-specific guide and the target glossary first.

## Goal

Make the target-language experience natural and useful while preserving the canonical English knowledge graph, evidence boundaries, provenance and stable identity.

A locale is judged against the surfaces it explicitly promises. Do not force partial or draft surfaces to look complete.

## Process

1. Resolve the locale role and per-surface state from `data/localization-profile.json`.
2. Inventory affected UI, components, content libraries, accessibility, Search and AI/agent surfaces before writing.
3. Use the reviewed glossary first. Keep canonical IDs, schema keys, URLs, DOI values, code and protocol identifiers stable.
4. Localize meaning rather than English word order. Preserve uncertainty, limitations, evidence state and sources exactly in strength.
5. Compare canonical and localized records by stable ID in an independent reconciliation pass. Check omissions, inventions, glossary drift, stale source hashes/releases, broken placeholders/citations and duplicate localized slugs.
6. Build the target locale and inspect representative desktop/mobile routes plus reusable component and runtime-state families.
7. Verify `html lang`, localized metadata, self-canonical, reciprocal `hreflang` only for true equivalents, sitemap membership, structured-data language semantics and declared `llms.txt`/data/Agent Skill surfaces.
8. Run the locale-specific checker plus `npm run check:localization`. In pull requests also run `npm run check:localization-impact -- --base=<base-ref>`.

## AI-assisted sequence

Use four separate jobs so generation is not its own only reviewer:

1. Glossary Builder.
2. Content Localizer.
3. Localization Reconciler.
4. UI Localization Auditor.

Reusable contracts are in `references/prompts.md`.

## Locale-specific sources

- German: `docs/GERMAN_LOCALIZATION.md`, `docs/GERMAN_FULL_CATALOG.md`, `docs/GERMAN_SKILL_LIBRARY.md`, `data/de/glossary.json`.
- Russian: `docs/RUSSIAN_LOCALIZATION.md`, `data/ru/glossary.json`.
- French: `docs/localization-fr.md`, `data/glossary-fr.json`.
- Brazilian Portuguese: `docs/localization-pt-br.md`, `data/glossary-pt-br.json`.

German full-catalog localization and evidence-review depth are separate dimensions. Russian and Brazilian Portuguese intentionally contain partial collections; missing reviewed routes stay missing rather than becoming English fallback pages.

## Rules

A translation must never be more certain than the canonical page. A reviewed translation does not upgrade scientific evidence.

Do not translate source titles unless an established translated title exists. Do not invent citations or new evidence states. Do not collapse related constructs because their target-language names look similar.

A cognitive-bias label is a hypothesis/lens for inspecting a decision process, not a diagnosis of a person.

When a new component, route, content family, skill, taxonomy, dataset label, generator or machine-readable surface is added, map its localization impact and update affected locales/checkers or record an explicit time-bounded exception.

Passing localization checks proves the checked repository/build/rendered contract only. It does not prove indexing, ranking, AI citation, recommendation visibility, user comprehension or traffic.
