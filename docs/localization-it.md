# Italian localization (`it`)

The Italian layer is a reviewed localization of Cognitive Biases. It extends the canonical English knowledge base; it does not create a parallel taxonomy or a separate evidence system.

## Current coverage

- Human routes under `/it/`.
- Reviewed Italian UI and discovery copy.
- A curated reviewed subset of bias pages. English is used only as an explicit fallback when an Italian bias record does not yet exist.
- Full parity for canonical techniques.
- Full parity for canonical Decision Skills.
- Full parity for canonical workflow Agent Skills plus generated bias-specific skills for every reviewed Italian bias.
- Italian machine-readable datasets, `llms.txt`, locale manifest, sitemap entries, structured data and reciprocal discovery from canonical English pages.

The manifest must report the actual bias coverage. Never describe the Italian bias catalog as complete until every published canonical bias has a reviewed Italian record.

## Terminology baseline

Use the versioned glossary in `data/localization/it-glossary.json` as the stable terminology contract.

Important editorial choices:

- **bias cognitivo** is the project taxonomy term for *cognitive bias*;
- **distorsione cognitiva** is a useful search/user-language alias, but do not use it to imply a clinical framing absent from the canonical source;
- **bias di conferma** is preferred for *confirmation bias*;
- **effetto ancoraggio** names the phenomenon; **bias di ancoraggio** is useful when referring to the bias lens;
- **euristica della disponibilità** is preferred for *availability heuristic*;
- **fallacia della pianificazione** is preferred for *planning fallacy*;
- distinguish **escalation dell'impegno** from the narrower everyday framing **fallacia dei costi irrecuperabili**;
- use **riduzione dei bias** / **mitigazione dei bias** rather than language implying that bias can be eliminated;
- use **evidenze** in research contexts; do not silently strengthen it to a stronger claim than the source supports.

## Translation rules

1. Translate meaning, not English syntax.
2. Preserve canonical IDs, evidence status, sources, uncertainty, review dates and provenance.
3. Keep translation review separate from evidence review.
4. Source titles stay in their original language unless an established localized title is explicitly available.
5. Do not add scientific claims, prevalence claims or causal explanations that are absent from the canonical source.
6. Prefer contemporary educated Italian suitable for a general audience; explain technical terms on first use when necessary.
7. Search terms are written for Italian intent, not obtained by literal keyword translation.
8. A localized example may be adapted to an Italian reader only when the adaptation does not alter the mechanism, evidence boundary or factual claim.
9. Never publish untranslated English prose inside a route marked as reviewed Italian. If coverage is missing, route users explicitly to the canonical English source.

## Search intent

Useful Italian query families include:

- bias cognitivi;
- distorsioni cognitive;
- processo decisionale;
- pensiero critico;
- errori di giudizio;
- euristiche;
- bias di conferma;
- effetto ancoraggio;
- costi irrecuperabili;
- prendere decisioni migliori.

Use these naturally in titles, descriptions, aliases and problem-first copy. Avoid keyword stuffing and do not create thin pages for query variants.

## AI-agent localization

`data/agent-skills-it.json` localizes the canonical workflow skill library. Canonical skill IDs remain English and must exist in `data/agent-skills.json`.

The Italian layer must support, at minimum:

- cognitive-bias detection as candidate hypotheses, not diagnoses;
- bias-aware decision review;
- debiasing interventions and practical decision checks;
- assumption challenging and metacognition;
- evidence-aware reasoning;
- research and content verification;
- forecasting and decisions under uncertainty;
- bias-aware AI workflows.

Generated machine discovery lives in `/it/data/agent-skills.json`, `/it/llms.txt` and the `SKILL.md` files below `/it/agent-skills/`.

## Quality gate

Before an Italian localization change is considered complete:

1. compare the Italian records with the current canonical release;
2. run the Italian localization generator;
3. run `npm run check:italian-localization`;
4. run `npm run build` and `npm run check`;
5. verify `/it/` routes, self canonicals, reciprocal English `hreflang`, sitemap membership and JSON-LD `inLanguage`;
6. verify the locale registries and localization contract;
7. verify machine-readable datasets and Agent Skill discovery;
8. inspect representative pages for natural Italian and accidental English UI leakage;
9. keep coverage counts and source release values accurate.

When the canonical release changes, reviewed Italian records remain tied to their `sourceRelease` until they are rechecked. Do not silently advance the release marker without semantic review.
