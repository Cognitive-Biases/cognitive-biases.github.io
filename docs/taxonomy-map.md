# Taxonomy map v2

Status: **proposal for migration, not yet applied to published records**.

The current `typeOfBias` field mixes several different dimensions: mechanism families, theories, contexts, broad catch-all buckets, and entity kinds. The v2 model separates these concerns:

- `kind` says what an entry is: bias, effect, heuristic, fallacy, phenomenon, or principle;
- `family` says which cognitive mechanism or decision problem it primarily belongs to;
- `contexts` says where it commonly appears, such as human-robot interaction or finance;
- typed `relations` connect overlapping, contrasting, broader, or easily confused concepts.

This map intentionally avoids mass-renaming published records until duplicate concepts and ambiguous buckets have been reviewed.

## Proposed family vocabulary

Keep the first migration small enough to explain and stable enough to generate useful hubs:

1. `memory-retrieval` — encoding, recall, reconstruction, source memory, forgetting;
2. `belief-updating` — evidence evaluation, confirmation, priors, truth judgments, belief persistence;
3. `probability-risk` — probability estimation, uncertainty, risk perception, base rates;
4. `attention-information` — salience, availability, search, information sampling and omission;
5. `perception-patterns` — perceptual interpretation, pattern detection, apophenia and agency perception;
6. `valuation-choice` — framing, reference points, gains/losses, option comparison and preference construction;
7. `reasoning-flexibility` — logical errors, problem representation, rigidity and tool fixation;
8. `self-metacognition` — self-assessment, confidence, introspection and beliefs about one's own cognition;
9. `social-judgment` — attribution, conformity, social inference and judgments about other people;
10. `time-commitment` — temporal preference, plan persistence, escalation and commitment dynamics.

A record may eventually have secondary families, but v2 should start with one reviewed primary family. Contexts and relations should carry the rest instead of turning `family` into another uncontrolled tag list.

## Current category inventory and migration direction

| Current `typeOfBias` | Count | Proposed direction | Migration mode |
| --- | ---: | --- | --- |
| Memory Bias | 53 | `memory-retrieval` | mostly direct; review known homonyms/duplicates |
| Cognitive Bias | 37 | no direct family | **per-record review**; generic catch-all must disappear |
| Conformity Bias | 15 | `social-judgment` | mostly direct |
| Egocentric Bias | 14 | `self-metacognition` or `social-judgment` | per-record split |
| Attribution Bias | 11 | `social-judgment` | mostly direct |
| Availability Heuristic | 10 | `attention-information` | mostly direct; `kind` often heuristic/bias/effect |
| Extension Neglect | 8 | `valuation-choice` or `probability-risk` | per-record review |
| Logical Fallacy | 8 | `reasoning-flexibility` | mostly direct; preserve `kind=fallacy` where appropriate |
| Prospect Theory | 8 | `valuation-choice` / `probability-risk` | per-record split; move `Prospect Theory` to theory/source metadata rather than family |
| Confirmation Bias | 6 | `belief-updating` | mostly direct |
| Framing Effect | 6 | `valuation-choice` | mostly direct |
| Self-Assessment | 6 | `self-metacognition` | direct; consolidate naming with Self-Assessment Bias |
| False Priors | 5 | `belief-updating` or `probability-risk` | per-record review |
| Truth Judgment | 4 | `belief-updating` | mostly direct |
| Apophenia | 3 | `perception-patterns` | direct |
| Cognitive Dissonance | 3 | `belief-updating` / `self-metacognition` | per-record review |
| Decision Making | 3 | no direct family | **per-record review**; generic bucket must disappear |
| Cognitive Rigidity | 2 | `reasoning-flexibility` | direct |
| Perception Bias | 2 | `perception-patterns` | mostly direct |
| Self-Assessment Bias | 2 | `self-metacognition` | direct; consolidate category naming |
| Social Bias | 2 | `social-judgment` | mostly direct |
| Belief Perseverance | 1 | `belief-updating` | direct |
| Dynamic Inconsistency | 1 | `time-commitment` or `valuation-choice` | review temporal mechanism |
| Heuristic Bias | 1 | no direct family | per-record review; heuristic is a `kind`, not a family |
| Human-Robot Interaction | 1 | no direct family | move HRI to `contexts`; classify mechanism separately |
| Information Bias | 1 | `attention-information` / `belief-updating` | review information-search mechanism |
| Metacognitive Bias | 1 | `self-metacognition` | direct |
| Probability Bias | 1 | `probability-risk` | direct |
| Self-Perception Bias | 1 | `self-metacognition` | mostly direct |

## Duplicate disposition queue

The automated audit finds four exact canonical-name groups after structural integrity repair. Matching names are review candidates, not proof that the underlying constructs are identical.

| Group | Current records | Proposed disposition |
| --- | --- | --- |
| Conservatism Bias | #2, #55, #171 | #2 and #55 appear to describe the same belief-updating construct and should be compared for merge; #171 describes a memory/extremity effect and must be researched as a possible homonym rather than auto-merged |
| Hindsight Bias | #100, #182 | likely merge after content/source comparison; preserve one canonical URL and redirect the other |
| Illusory Truth Effect | #87, #184 | likely merge after evidence/content comparison; preserve legacy URL through redirect |
| Subadditivity Effect | #69, #211 | likely merge after checking that both describe the same probability-judgment construct |

Default merge rule: keep the better-supported canonical record, not automatically the lowest ID. When two published URLs already exist, every retired slug must receive an explicit permanent redirect and be recorded in `legacySlugs`.

## Migration order

1. Add optional v2 fields to the renderer and validator while retaining `typeOfBias` compatibility.
2. Review the four duplicate groups and record explicit keep/merge/separate decisions.
3. Classify the generic buckets (`Cognitive Bias`, `Decision Making`, `Heuristic Bias`) record by record.
4. Migrate direct categories in small batches with tests and unchanged canonical URLs.
5. Move context-like values such as Human-Robot Interaction into `contexts`.
6. Generate family hubs only after enough reviewed records exist to make each hub useful.
7. Remove `typeOfBias` only after the complete corpus has a reviewed v2 family and all old navigation routes have equivalents.

## Guardrails

- Do not infer scientific equivalence from matching names alone.
- Do not manufacture evidence ratings while doing taxonomy work.
- Do not create one family for every old category.
- Do not use application domains such as HRI, finance, medicine, or workplace as cognitive mechanism families.
- Do not delete an existing published slug without a redirect.
- Keep taxonomy changes separate from major editorial rewrites so regressions remain attributable.
