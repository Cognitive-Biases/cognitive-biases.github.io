# Localization quality contract

Cognitive Biases treats localization as a product surface, not as a translated folder. English is the canonical knowledge graph; localized layers preserve canonical IDs, evidence boundaries, provenance and relations.

The repository-level workflow is:

`inventory → glossary → interface/content → independent reconciliation → build → rendered UI/accessibility → Search/AI surfaces → release gate → drift protection`

Machine-readable scope lives in `data/localization-profile.json`. Locale-specific guidance lives in each locale guide and glossary.

## Current locale roles

- `en` — canonical.
- `de` — reviewed human interface with full canonical bias coverage, techniques, Decision Skills, workflow/bias Agent Skills and reviewed decision situations.
- `ru` — reviewed partial human interface: evidence-reviewed bias subset, full techniques, Decision Skills and everyday guides, plus a reviewed subset of research syntheses.
- `fr` — reviewed human interface for the declared bias, technique and Decision Skill surfaces.
- `pt-BR` — reviewed partial human interface: reviewed bias subset with full techniques, Decision Skills and workflow Agent Skills.
- `es` — reviewed human interface with complete published bias, technique and Decision Skill coverage.

A partial locale is not a failed full locale. Missing reviewed content stays missing; English body text must not be silently presented as reviewed localized content.

## 1. Inventory every localizable surface

Before adding or changing a locale, inspect navigation, buttons, filters, forms, runtime states, reusable components and templates, bias catalogues, techniques, Decision Skills, Agent Skills, everyday/research/decision guides, accessibility text, Search metadata, `hreflang`, sitemap membership, structured data, `llms.txt`, locale manifests, localized datasets and text embedded in media when relevant.

Use exact stable-ID or key-set comparison whenever a surface is enumerable. Do not infer completeness from a route sample.

## 2. Glossary first

Review terminology before bulk localization. First-class glossary sources include `data/de/glossary.json`, `data/ru/glossary.json`, `data/glossary-fr.json`, `data/glossary-pt-br.json` and `data/glossary-es.json`.

Glossaries record stable concepts, preferred terminology, useful aliases, misleading alternatives and context. Natural grammar may inflect preferred terms. Canonical IDs, schema keys, URLs, DOI values, code and protocol identifiers remain stable.

When new domain or product vocabulary appears, update the relevant glossary before or with localized content.

## 3. Localize meaning, not English syntax

The canonical English record controls factual meaning, evidence strength, uncertainty, sources and entity relations. A localized page may improve readability, examples and target-language discovery wording, but it must not strengthen a scientific claim or turn a project label into an established effect.

A cognitive-bias label is a hypothesis or lens for inspecting a decision process, not a diagnosis of a person.

## 4. Separate generation from review

AI-assisted localization uses four distinct jobs: **Glossary Builder**, **Content Localizer**, **Localization Reconciler**, and **UI Localization Auditor**. Reusable prompt contracts live in `skills/translation-review/references/prompts.md`.

Generation is not its own only reviewer.

## 5. Track freshness, not only existence

A reviewed translation can become stale after the canonical source changes. Use source hashes or releases where a localized collection supports them. Keep translation review separate from evidence review: a reviewed translation does not upgrade scientific evidence.

## 6. Verify the built experience

Source JSON parity is not enough. Build and inspect representative desktop and narrow-mobile routes plus each reusable component family. Include navigation, search/filter controls, forms, validation, loading/empty/error states, cards/dialogs, language switching, skip links, accessible names, alt text and text-expansion behavior.

Use a pseudo-locale when UI complexity makes hard-coded source-language strings difficult to detect.

## 7. Verify Search and machine-readable parity

For human-facing localized pages verify, where applicable, `<html lang>`, localized title/description, self canonical, reciprocal `hreflang` only for true equivalents, sitemap membership, structured-data language semantics, stable canonical entity identifiers and useful localized aliases.

For machine-readable localization, verify declared `llms.txt`, locale manifest, localized datasets and Agent Skills against the same locale contract. Do not create thin locale placeholders merely to fill a matrix.

## 8. New features have localization impact by default

A new component, route, content family, skill, taxonomy, dataset label, image with embedded text, generator or AI/agent surface is not multilingual-ready merely because English works.

A localizable canonical change must map to `data/localization-profile.json`, update terminology when needed, retain or extend exact checkers, update affected active locales or use an explicit time-bounded exception, and verify final human and machine-readable outputs.

`npm run check:localization-impact -- --base=<base-ref>` enforces the diff-aware part of this rule in pull requests.

## 9. CI contract

Existing strong locale-specific checks remain authoritative for their collections. The shared `check:localization` layer coordinates them and checks profile/registry/AI-manifest agreement, glossaries, declared generated surfaces and partial/full scope. Do not replace a stronger locale-specific assertion with a weaker generic abstraction.

Temporary deferrals live in `data/localization-exceptions.json`; each exception requires a reason, affected locale/surface and review date, and never redefines missing coverage as complete.

## Evidence boundary

Passing localization checks proves only the checked repository, build and rendered contract. It does not prove Search indexing, ranking, AI citation, recommendation visibility, user comprehension or traffic.
