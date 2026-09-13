# Localization prompt contracts

Use these as separate jobs. Inspect `docs/localization.md`, `data/localization-profile.json`, the canonical English source and the target glossary first. Generation must not be its own only reviewer.

## Glossary Builder

```text
GOAL
Build or update the reviewed terminology layer for TARGET_LOCALE before bulk localization.

For each important concept return a stable concept ID, canonical English term, natural preferred target term, accepted aliases, misleading terms to avoid, context and review flag.

Preserve canonical IDs, schema keys, sources, URLs, code and protocol names. Preserve distinctions between related biases. Prefer established target-language usage over literal English syntax. Keep uncertainty/evidence terminology precise. Flag ambiguous scientific terminology for review instead of guessing.
```

## Content Localizer

```text
GOAL
Localize the supplied canonical Cognitive Biases record or UI surface for TARGET_LOCALE so it feels intentionally written for that audience.

The canonical English record controls factual meaning, evidence strength, uncertainty, IDs, sources and relations. The reviewed glossary controls recurring terminology. data/localization-profile.json controls which surfaces are complete, partial, draft or out of scope.

Preserve IDs, citations, source URLs, evidence state, caveats, placeholders and machine tokens. Adapt sentence structure and examples only when practical meaning and evidence boundaries remain equivalent. Never silently show English body text as reviewed localization. A bias label is a decision-process lens, not a diagnosis of a person.
```

## Localization Reconciler

```text
ROLE
Act as an independent localization reconciler. Compare canonical and localized records by stable ID.

Check exact declared coverage, semantic parity, evidence/uncertainty strength, glossary consistency, IDs/relations/citations/placeholders, language leakage, local grammar/formatting, unique slugs/aliases, source freshness and practical task parity.

Treat missing required coverage, stronger claims, stale reviewed records, broken identifiers/links/placeholders and silent fallback as blocking. Do not turn intentionally partial locales into fake 100% coverage.

Return exact counts where enumerable, findings by stable ID/path, unresolved questions and pass/fail/partial/unknown recommendation.
```

## UI Localization Auditor

```text
GOAL
Audit the built TARGET_LOCALE experience, not only source translation files.

Inventory observed routes, reusable component families and runtime states. Check navigation, search/filters, forms, validation, loading/empty/error states, cards/dialogs, language switching, skip links, accessible names, alt text, mobile layout and text expansion.

For representative pages verify html lang, localized title/description, self canonical, reciprocal hreflang only for true equivalents, sitemap presence, structured-data language semantics and declared llms/data/Agent Skill surfaces.

Report blocking findings, warnings, hard-coded source-language candidates and unobserved surfaces. Never claim full localization from a small route sample.
```

## Orchestration

New locale:

`inventory → Glossary Builder → terminology review → interface/content localization → exact collection checks → Localization Reconciler → build → UI Localization Auditor → Search/AI parity → CI impact gate → release`

Existing locale after a feature change:

`canonical diff → impact mapping → glossary delta if needed → locale updates or explicit temporary exception → reconciliation → focused build/UI check → locale checker + shared localization gate`
