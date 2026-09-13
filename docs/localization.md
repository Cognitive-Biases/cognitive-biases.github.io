# Localization quality contract

Cognitive Biases treats localization as a product surface, not as a translated folder.

English is the canonical knowledge base. A locale may publish a full human interface, a reviewed partial human layer, or only an agent-routing surface. Every locale is judged against the scope it explicitly promises; a limited locale is not incomplete merely because out-of-scope surfaces remain English-only or absent.

The shared workflow is:

`inventory → glossary → interface → structured content → independent reconciliation → build → rendered UI/accessibility → Search/AI surfaces → release gate → drift protection`

Locale-specific terminology and scope live in `docs/localization-<locale>.md`. Machine-readable scope lives in `data/localization-profile.json`.

## 1. Inventory before translation

Before adding or expanding a locale, inventory every localizable surface that exists in the current repository:

- navigation, buttons, filters, forms and runtime states;
- reusable components and templates;
- bias pages and catalogue labels;
- decision techniques;
- Decision Skills and workflow Agent Skills;
- examples, warnings, limitations and evidence-status wording;
- accessibility text such as skip links, alt text and accessible names;
- titles, descriptions, canonicals, reciprocal `hreflang`, sitemap entries and structured data;
- `llms.txt`, locale manifests, localized datasets and Agent Skills;
- text embedded in images or other media when relevant.

Do not infer completeness from a few translated pages. Use exact stable-ID or key-set comparison whenever a surface is enumerable.

## 2. Build and review the glossary first

A target locale must have a versioned glossary before bulk content generation. The glossary records stable concept IDs, preferred terminology, useful aliases, misleading alternatives to avoid, context and review state.

Current structured glossaries:

- `data/glossary-fr.json`
- `data/glossary-pt-br.json`

The glossary is not a word-for-word dictionary. Natural grammar may inflect preferred terms. Canonical entity IDs, schema keys, URLs, DOI values, code and protocol identifiers remain stable.

When a new product or domain term appears, update the glossary before or with the content that introduces it.

## 3. Localize from the canonical source, not from another translation

Use the English canonical record plus the reviewed target-locale glossary.

Preserve:

- canonical IDs and entity relationships;
- citations, source URLs and provenance;
- evidence status, uncertainty and limitations;
- placeholders, variables and machine tokens;
- distinctions between nearby constructs.

Adapt sentence structure, examples and search wording only when the result remains semantically equivalent and useful for the target audience.

A reviewed translation does not upgrade the evidence behind a cognitive-bias claim.

## 4. Separate generation from reconciliation

Do not let one generation pass be its own only reviewer.

Use four distinct jobs where AI assistance is used:

1. **Glossary Builder** — establishes terminology and unresolved choices.
2. **Content Localizer** — writes natural target-language UI/content from canonical sources.
3. **Localization Reconciler** — independently compares source and target by stable ID, evidence boundary and source revision.
4. **UI Localization Auditor** — checks the built experience, components, runtime states, accessibility, Search metadata and machine-visible language surfaces.

Reusable prompt contracts live in `skills/translation-review/references/prompts.md`.

## 5. Full and partial locales are different contracts

A full locale requires exact coverage for every surface marked `complete` in `data/localization-profile.json`.

A reviewed partial locale may intentionally publish only a reviewed subset of a collection. Missing records stay missing; English text must not be silently presented inside a page declared as reviewed target-language content.

For `pt-BR`, bias pages are intentionally a reviewed subset while techniques, Decision Skills and workflow Agent Skills have full parity. CI must preserve that distinction rather than forcing fake 100% bias coverage.

Agent-routing locales such as `de` and `ru` publish localized machine-routing text without claiming a complete human interface.

## 6. Track freshness, not only existence

An existing translation can become stale when its canonical source changes.

For structured content, prefer deterministic source hashes or an equivalent source revision. A record marked `reviewed` must be re-reviewed when its required source hash no longer matches.

Existing French and Brazilian Portuguese checkers already validate source relationships for important structured collections. New collections should adopt the same pattern instead of relying on timestamps alone.

## 7. Verify the built experience

Source JSON parity is not enough. Build the target locale and inspect representative desktop and narrow-mobile routes plus each reusable component family.

Include:

- navigation and footer;
- filters, search and pagination;
- forms, validation and success messages;
- loading, empty, error and confirmation states;
- cards, badges, tooltips and dialogs;
- language switching;
- skip links, accessible names and alt text;
- long-string wrapping and controls under text expansion.

A pseudo-locale is recommended when a UI layer grows large enough that hard-coded strings or fragile layouts become difficult to detect manually.

## 8. Verify Search, AEO and AI surfaces from the final artifact

For a human-facing localized page, verify as applicable:

- correct `<html lang>`;
- localized title and description;
- self-canonical localized URL;
- reciprocal `hreflang` and `x-default` policy;
- sitemap membership;
- structured-data language semantics;
- localized aliases that still map to the same canonical entity;
- locale-aware internal navigation.

For machine-readable localization, verify declared `llms.txt`, locale manifests, data indexes and Agent Skills against the same locale contract.

Do not create thin localized routes only to fill a language matrix.

## 9. New features have localization impact by default

A new component, route, content family, skill, taxonomy, dataset label, image with embedded text, or AI/agent surface is not multilingual-ready merely because its English version works.

When such a surface changes:

1. map it to a surface in `data/localization-profile.json`;
2. expose a deterministic canonical inventory when practical;
3. update glossary terminology when new vocabulary appears;
4. extend the appropriate locale checker;
5. update affected active locales or record an explicit temporary exception;
6. verify the built human and machine-readable outputs.

`npm run check:localization-impact` implements the diff-aware part of this rule in pull requests. Broad UI/template changes are surfaced for review; structured collections with full parity remain protected by their exact locale checkers and source hashes.

## 10. CI contract

`npm run check:localization` validates the shared governance layer and delegates deep locale correctness to the existing strong language-specific checks already included in `npm run check`.

The shared gate verifies, among other things:

- locale/profile/AI-manifest agreement;
- declared human and agent-routing language sets;
- locale-specific checker commands;
- first-class glossary validity;
- shared and locale-specific documentation links;
- required generated locale entry points after a build;
- explicit partial/full scope instead of silent fallback.

Do not replace a stronger locale-specific assertion with a weaker generic abstraction.

## 11. Evidence boundary

Passing localization checks proves only the checked repository/build/rendered contract. It does not prove indexing, Search ranking, AI citation, recommendation visibility, user comprehension or traffic.
