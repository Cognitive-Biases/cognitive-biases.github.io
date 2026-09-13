# Localization prompt contracts

Use these as role-separated review contracts. Always inspect the current repository, `docs/localization.md`, `data/localization-profile.json`, the canonical English source and the target locale glossary before applying them.

Do not combine all four jobs into one pass. Fluent generation is not independent verification.

## 1. Glossary Builder

```text
GOAL
Build or update the reviewed terminology layer for TARGET_LOCALE before bulk localization.

CONTEXT
This is the Cognitive Biases knowledge base. English is canonical for entity IDs, evidence status, provenance, sources and machine-readable schema semantics. Cognitive-bias labels are hypotheses about decision processes, not diagnoses of people.

INPUTS
- current canonical English corpus;
- target locale and audience;
- existing target-locale guide and glossary;
- project voice: useful, semi-formal, clear, approximately B2 when practical;
- protected IDs, citations, URLs, code and schema keys.

FOR EACH IMPORTANT TERM
Return:
- conceptId: stable language-neutral identifier;
- source: canonical English term;
- preferred: natural target-language term;
- aliases: useful accepted alternatives, including English only when discovery/recognition benefits;
- avoid: misleading, unnatural or over-literal alternatives;
- context: what the term means in this project;
- status: reviewed-candidate | needs-review;
- rationale: only when the choice is non-obvious.

PRIORITIES
1. Preserve meaning and distinctions between nearby constructs.
2. Sound native to the target audience.
3. Preserve evidence/uncertainty wording.
4. Keep product terminology consistent across UI, content and machine-readable values.
5. Preserve canonical IDs and technical tokens.

FLAG NEEDS-REVIEW WHEN
- several professional terms are genuinely plausible;
- terminology can change scientific meaning;
- regional usage matters;
- a literal translation would be understandable but unnatural;
- the choice may materially affect Search intent.

DO NOT
- invent scientific-sounding calques;
- translate canonical IDs, schema keys, URLs or citations;
- collapse distinct canonical biases into one target-language concept;
- use keyword repetition as a substitute for natural language.
```

## 2. Content Localizer

```text
GOAL
Localize the supplied canonical Cognitive Biases record or UI surface for TARGET_LOCALE so it reads as intentionally written for that audience.

SOURCE OF TRUTH
- canonical English controls factual meaning, evidence strength, uncertainty, IDs, sources and relations;
- the reviewed target glossary controls recurring terminology;
- data/localization-profile.json controls which surfaces are complete, partial or out-of-scope.

MUST PRESERVE
- canonical IDs and machine-readable field names unless the locale architecture explicitly defines a localized presentation field;
- evidence status, caveats, limitations and negative evidence;
- citations, source URLs, DOI values, code and protocol identifiers;
- placeholders and interpolation variables;
- distinctions between related constructs;
- the rule that a bias label is not a diagnosis of a person.

MAY ADAPT
- sentence structure and idiom;
- examples, only when they keep the same practical lesson and evidence boundary;
- localized slugs where the locale architecture supports them;
- target-language Search terms based on real user phrasing rather than literal keyword translation.

QUALITY BAR
- natural, concise, useful target-language prose;
- semi-formal project voice;
- no unexplained English UX leakage on a surface declared complete;
- no stronger certainty than the canonical record;
- no invented facts or sources;
- no SEO filler;
- no silent English fallback presented as reviewed localization.

PARTIAL LOCALES
If the target surface is declared partial, localize only reviewed records. Do not generate placeholder or machine-translated pages merely to reach 100% numeric coverage.
```

## 3. Localization Reconciler

```text
ROLE
Act as an independent localization reconciler. Assume fluent localized text may still contain semantic drift, omissions or structural errors.

COMPARE BY STABLE ID
Do not compare collections by list position when canonical identifiers exist.

CHECK
1. Coverage against the declared locale/surface contract.
2. Meaning of definitions, practical questions, examples, warnings and limitations.
3. Evidence strength and uncertainty: nothing became more certain or more causal.
4. Terminology against the reviewed glossary, allowing natural inflection.
5. Structure: IDs, relations, citations, URLs, schema fields and placeholders remain valid.
6. Language leakage: no unintended canonical-language UI/body copy on complete surfaces.
7. Local correctness: grammar, punctuation, number/date/unit formatting and regional usage.
8. Identity: localized slugs/aliases remain unique and map to the correct canonical entity.
9. Freshness: sourceRelease/sourceHash matches the canonical version required by the locale checker.
10. Practical task parity: the localized version still lets a reader understand and use the same decision check.

SEVERITY
- blocking: missing required coverage, changed meaning/evidence, stale reviewed record, broken ID/link/citation/placeholder, silent fallback, or misleading task;
- warning: likely terminology, style, Search-intent, accessibility or layout problem;
- info: optional improvement.

DO NOT
- rewrite clean content only for stylistic preference;
- treat proper names, source titles, code or citations as untranslated leakage;
- turn a partial locale into fake full coverage.

OUTPUT
Return exact coverage counts where enumerable, findings by stable ID/path, unresolved review questions, and release recommendation: pass | fail | partial | unknown.
```

## 4. UI Localization Auditor

```text
GOAL
Audit the built TARGET_LOCALE experience. Do not limit the review to translation JSON or page body prose.

INVENTORY
Map observed routes, reusable component families and runtime states. State what was not observed.

CHECK VISIBLE UI
- header, navigation, footer, breadcrumbs;
- search, filters, tabs, pagination and calls to action;
- cards, badges, tooltips, dialogs and notifications;
- forms, field help, validation and success states;
- loading, empty, error and confirmation states;
- language switch and locale-aware internal navigation.

CHECK ACCESSIBILITY
- skip links;
- alt text;
- accessible names and descriptions;
- validation announcements and hidden instructions;
- focus/keyboard behavior where translated layout changes can affect interaction.

CHECK LAYOUT
Use representative desktop and narrow-mobile widths. Look for clipping, overlap, fragile fixed widths, bad truncation and text-expansion failures.

CHECK SEARCH/MACHINE PAGE CONTRACT
For representative localized pages verify html lang, localized title/description, self-canonical, reciprocal hreflang, sitemap presence and structured-data language semantics. Verify declared llms.txt, locale manifest, data index and Agent Skills when in scope.

CHECK LANGUAGE LEAKS
Find hard-coded English strings, but do not flag canonical IDs, proper names, citations, source titles or technical tokens that should remain stable.

OUTPUT
Return route/component/state coverage, blocking findings, warnings, hard-coded string candidates, accessibility/layout findings and unknown/unobserved surfaces.

Never report 'fully localized' from a small route sample when unobserved component or content families exist.
```

## Orchestration

New locale:

`inventory → Glossary Builder → terminology review → interface/content localization → exact collection checks → Localization Reconciler → build → UI Localization Auditor → Search/AI parity → CI impact gate → release`

Feature change in an existing locale:

`canonical diff → impact mapping → glossary delta if needed → affected locale updates or explicit temporary exception → reconciliation → focused build/UI check → locale checker + shared localization gate`
