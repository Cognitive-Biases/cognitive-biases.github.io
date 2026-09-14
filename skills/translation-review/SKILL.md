# Translation review

Use this skill when adding or updating reviewed localized Cognitive Biases content, including German, Russian, French, Brazilian Portuguese, Spanish and Italian surfaces.

## Goal

Make the translated experience natural for a reader while preserving the meaning, uncertainty and evidence boundaries of the canonical English record.

Localization is a product surface, not a string-presence exercise. A locale is not complete merely because locale files have full coverage or generated HTML exists.

## Four-level verification contract

For every published human-interface locale, keep these evidence levels separate:

1. **Source** — localized source records, UI dictionaries, glossary terms and review state are correct.
2. **Generated output** — the build contains the expected localized routes, metadata, structured data and machine-readable surfaces.
3. **Rendered browser experience** — a real browser shows usable localized pages after JavaScript and CSS execute, including narrow mobile and interaction states.
4. **Accessibility / machine interpretation** — browser accessibility semantics, accessible names, language signals and machine-facing representations expose the intended locale and meaning.

A locale can pass levels 1–2 and still fail levels 3–4. Do not label a browser-facing locale complete without browser evidence for representative page/component archetypes.

## Process

1. Read the canonical record and its evidence review.
2. Read the locale glossary and localization guide when that locale has them.
3. Keep IDs, sources, evidence status, review dates and relations unchanged.
4. Translate the meaning rather than the English sentence structure.
5. Prefer ordinary target-language wording over literal technical calques.
6. Preserve uncertainty and boundary conditions exactly in strength.
7. Check examples for cultural clarity without changing the scientific claim.
8. Review terminology across pages, techniques, skills, structured data and AI-facing files so the same concept does not acquire accidental names.
9. Verify machine-readable discovery, localized Agent Skills and UI strings when the locale publishes those surfaces.
10. Reconcile canonical and localized inventories independently; generation must not review itself.
11. Build the final public artifact and run browser verification across the locale's main page/component archetypes.
12. At minimum include 320 px mobile plus normal mobile, large mobile, tablet/narrow layout and desktop coverage where the interface is responsive.
13. Reconcile a rendered screenshot, post-render DOM and browser accessibility tree for representative states. Check hidden DOM and accessible-name language leaks, not only visible text.
14. Exercise keyboard focus and secondary interaction states such as menus, search/no-results, filters and disclosures where they exist.
15. Stress constrained UI with long real translations and approximately 30–50% expanded pseudo-localized text. Fix resilient layout rather than globally shrinking type.
16. Re-run key browser checks against deployed production. Keep local-build evidence and deployed evidence distinct.
17. Mark the translation for review again when canonical evidence-sensitive content or a shared localizable component changes.

## Browser false-green rules

Actively look for states that source checks can miss:

- translated visible text with an English `aria-label`, `title`, placeholder or live-region message;
- visually clipped or off-screen translated text despite correct DOM content;
- mobile navigation that is visually hidden but remains focusable or exposed incorrectly to assistive technology;
- focus that becomes invisible or trapped after responsive layout changes;
- correct generator metadata but wrong final browser canonical, `hreflang`, `lang` or structured-data language;
- runtime-injected English fallback;
- horizontal overflow that appears only at 320 px or only after text expansion.

When a real false-green class is found, fix the root cause and add the smallest stable regression guard that would catch the same class again.

## Rules

A translation must never be more certain than the canonical page.

Do not translate source titles unless a source has an established translated title. Do not invent translated citations. Do not create a new evidence status for one language.

If a clean natural translation conflicts with a literal translation, preserve the reviewed meaning and write naturally.

Never present English fallback content as reviewed localized content. Coverage claims and locale manifests must describe the actual reviewed scope.

Do not suppress difficult browser findings with permanent screenshot masks, ignore lists or blanket overflow exceptions. Any justified exception needs a reason, evidence, impact, removal condition and exact next verification step.

For French human-facing pages, also follow `docs/localization-fr.md` for terminology, UX copy, aliases, fallbacks and SEO/AEO rules.

For Italian human-facing and agent-facing pages, also follow `docs/localization-it.md` and `data/localization/it-glossary.json`. Keep canonical IDs and Agent Skill slugs in English, use `bias cognitivo` as the project taxonomy term, preserve evidence/provenance boundaries, and treat `distorsione cognitiva` as a search/user-language alias rather than a reason to introduce clinical claims.
