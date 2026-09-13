# Translation and localization review

Use this skill when adding, expanding or reviewing a localized Cognitive Biases surface. This includes human pages, UI, techniques, Decision Skills, workflow Agent Skills, accessibility text, Search metadata, structured data and agent-routing surfaces.

Read `docs/localization.md` and `data/localization-profile.json` first. Then read the target locale's guide and structured glossary when they exist.

## Goal

Make the target-language experience natural and useful while preserving the meaning, evidence boundaries, canonical identity and machine-readable contracts of the English knowledge base.

A locale is judged against the surfaces it explicitly promises. Do not force an agent-routing locale to become a human interface, and do not call a reviewed partial locale complete outside its declared scope.

## Process

1. **Resolve the target locale contract.**
   - Read the locale role, status and surface states from `data/localization-profile.json`.
   - Confirm whether each relevant surface is `complete`, `partial`, `out-of-scope` or canonical.
   - Preserve intentional partial publication; missing reviewed content must stay missing rather than falling back silently to English.

2. **Inventory affected surfaces before writing.**
   - Map UI strings and runtime states, reusable components, bias records, techniques, Decision Skills, workflow Agent Skills, accessibility text, Search metadata and AI/agent outputs.
   - For enumerable collections, compare canonical and localized stable IDs exactly instead of sampling.
   - When a new component, content family, skill or machine-readable surface is introduced, update the localization contract/checker in the same change.

3. **Use the reviewed glossary first.**
   - Read the target locale's structured glossary declared in `data/localization-profile.json`.
   - Use preferred terminology naturally; grammar may inflect it.
   - Keep canonical IDs, schema keys, code, URLs, DOI values and protocol identifiers unchanged.
   - Add new important terminology to the glossary before or with bulk localized content.

4. **Localize meaning, not English sentence order.**
   - Prefer ordinary target-language wording over literal technical calques.
   - Preserve facts, uncertainty, limitations, evidence status, sources, review dates and entity relationships.
   - Adapt an example only when it keeps the same practical lesson and does not introduce a stronger scientific claim.
   - Treat a cognitive-bias label as a hypothesis about a decision process, never as a diagnosis of a person.

5. **Run an independent reconciliation.**
   - Compare canonical and localized records by stable ID.
   - Look for omissions, inventions, stronger claims, stale source hashes/releases, glossary drift, broken placeholders, changed citations/links and duplicate localized slugs.
   - Keep language review separate from evidence review. A reviewed translation does not strengthen the evidence behind a construct.

6. **Verify the built experience.**
   - Build the locale and inspect representative desktop and narrow-mobile routes plus each affected component family.
   - Include navigation, filters/search, forms, validation, loading/empty/error states, cards, dialogs, language switching and accessibility text.
   - Check long-string wrapping and hard-coded English. A pseudo-locale is recommended when UI complexity grows.

7. **Verify Search and agent surfaces.**
   - For human-facing pages check language metadata, localized title/description, self-canonical, reciprocal `hreflang`, sitemap membership and structured-data language semantics.
   - Verify `llms.txt`, locale manifests, localized data indexes and Agent Skills when the locale contract declares them.
   - Keep canonical entity identifiers stable while exposing useful target-language and English aliases.

8. **Protect freshness and future changes.**
   - Use source hashes/releases where the collection supports them; an existing reviewed translation can become stale after canonical changes.
   - Run the locale-specific checker plus `npm run check:localization`.
   - In pull requests, run `npm run check:localization-impact -- --base=<base-ref>` so new localizable surfaces cannot silently escape review.

## AI-assisted prompt sequence

Use separate jobs so generation is not its own only reviewer:

1. Glossary Builder.
2. Content Localizer.
3. Localization Reconciler.
4. UI Localization Auditor.

Reusable prompt contracts are in `references/prompts.md`.

## Locale notes

For French human-facing pages, follow `docs/localization-fr.md` and `data/glossary-fr.json`.

For Brazilian Portuguese, follow `docs/localization-pt-br.md` and `data/glossary-pt-br.json`. Bias coverage is intentionally reviewed-partial, while techniques, Decision Skills and workflow Agent Skills have the stronger parity declared in the localization profile.

German and Russian currently serve agent-routing roles rather than complete human interfaces. Do not imply broader human localization from their `llms.txt` surfaces.

## Rules

A localized page must never be more certain than the canonical page.

Do not translate source titles unless a source has an established translated title. Do not invent translated citations. Do not create a new evidence status for one language.

Do not claim localization completeness from fluent prose alone. Coverage, semantic parity, source freshness, rendered UI and Search/AI parity are separate checks.

Passing localization checks proves the checked repository/build/rendered contract only. It does not prove indexing, ranking, AI citation, recommendation visibility, user comprehension or traffic.
