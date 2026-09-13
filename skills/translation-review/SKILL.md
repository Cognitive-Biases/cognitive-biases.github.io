# Translation review

Use this skill when adding or updating reviewed localized Cognitive Biases content, including German, Russian, French, Brazilian Portuguese, Spanish and Italian surfaces.

## Goal

Make the translated page natural for a reader while preserving the meaning and uncertainty of the canonical English record.

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
10. Mark the translation for review again when the canonical evidence-sensitive content changes.

## Rules

A translation must never be more certain than the canonical page.

Do not translate source titles unless a source has an established translated title. Do not invent translated citations. Do not create a new evidence status for one language.

If a clean natural translation conflicts with a literal translation, preserve the reviewed meaning and write naturally.

Never present English fallback content as reviewed localized content. Coverage claims and locale manifests must describe the actual reviewed scope.

For French human-facing pages, also follow `docs/localization-fr.md` for terminology, UX copy, aliases, fallbacks and SEO/AEO rules.

For Italian human-facing and agent-facing pages, also follow `docs/localization-it.md` and `data/localization/it-glossary.json`. Keep canonical IDs and Agent Skill slugs in English, use `bias cognitivo` as the project taxonomy term, preserve evidence/provenance boundaries, and treat `distorsione cognitiva` as a search/user-language alias rather than a reason to introduce clinical claims.
