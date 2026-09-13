# German localization system

Status: reviewed-layer pilot

The German experience is a localized representation of the same canonical knowledge graph used by the English site. It is not a second encyclopedia and it must not create new psychological claims by translation.

## Product job

A German page should help a reader answer, in this order:

1. Was passiert gerade in meinem Denken oder meiner Entscheidung?
2. Woran erkenne ich das Muster?
3. Was kann ich konkret prüfen oder anders machen?
4. Warum könnte diese Gegenprüfung helfen?
5. Wo liegen die Grenzen des Effekts oder der Technik?

Definitions explain the concept. Denkwerkzeuge change the next action. Situation-first guides let readers start without knowing a bias name.

## Language style

Use contemporary German at roughly B2 reading level where the subject allows it.

- Prefer short, direct sentences over long nominal constructions.
- Use a semi-formal `du` voice on practical pages.
- Avoid literal English syntax, bureaucratic wording and marketing claims.
- Keep useful English terms when German readers commonly search for them, but do not make every heading bilingual.
- Explain specialist terms on first use when a plain-language phrase improves understanding.
- Never strengthen uncertainty in translation. `May`, `can`, `mixed`, `conditional` and similar boundaries must remain visible.

## Primary terminology

The structured source is `data/de/glossary.json`. Reviewed German pages may add a natural primary label while keeping the canonical English term searchable.

Important boundaries:

- `Sunk-Cost-Effekt` and `Eskalation des Commitments` are related but distinct constructs.
- `Default-Effekt` and `Status-quo-Verzerrung` overlap but are not interchangeable.
- Availability is a heuristic, not automatically an error.
- Dunning–Kruger is about calibration patterns in studied tasks, not a personality diagnosis.
- Backfire is not the normal response to factual corrections.
- Loss aversion does not have one universal coefficient.
- A late project does not prove a planning fallacy.
- Humanlike AI cues do not establish understanding, consciousness or accuracy.

Do not use search terms as semantic aliases when the concepts differ. `aliases` may be emitted as alternate names. `searchTerms` are discovery-only phrases and must not be promoted to synonyms.

## Content model

German bias entries keep the English canonical slug and add localized fields:

- `title`
- `englishTitle`
- `aliases`
- `searchTerms`
- `summary`
- `trap`
- `evidence`
- `boundary`
- `actions`

German techniques preserve the canonical technique slug and canonical bias links. Translation may improve readability but must not silently change the technique's purpose, prerequisites or limitations.

German decision guides live in `data/de/decision-guides*.json`. A reviewed guide contains a stable slug, natural problem-first title, situation, concrete checklist, explanation, explicit boundary, reviewed German bias links, canonical technique links and discovery-only search terms.

## Evidence boundary

A German bias page may be published in the reviewed layer only when:

- the canonical slug has a controlled evidence class;
- a canonical evidence review exists;
- the German summary does not claim more than that review supports;
- the boundary section remains visible;
- source links continue to point to the reviewed canonical sources.

Do not translate a broad popular definition when the canonical project has already narrowed or corrected it. Practical actions are checks, not guaranteed debiasing cures. A matching bias is a lens for inspecting a decision process, not proof that the bias caused one particular decision.

A situation-first guide is a practical composition of reviewed concepts and techniques. It is not a new scientific effect. The scenario must not diagnose a person or team, and its checklist must not imply that following the steps guarantees an unbiased or correct decision.

## UX vocabulary

The primary practical label is **Denkwerkzeug** in navigation and discovery. Individual technique pages use **Praktische Technik** as the content type. Situation-first pages use **Entscheidungssituation** and **Situationen**.

`Hack` is not banned, but it is not the default taxonomy label because it can suggest a quick universal fix.

Practical detail pages should expose these headings when applicable:

- Was passiert?
- Probier das
- Warum es helfen kann
- Grenzen

Situation-first pages use:

- Die Situation
- Prüfe das
- Warum es helfen kann
- Grenzen
- Bias-Linsen
- Denkwerkzeuge

## Search and entity resolution

German search must match the primary German name, accepted German aliases, the English canonical name and useful discovery-only phrases. All variants resolve to one canonical concept page.

For example, `Bestätigungsfehler`, `Bestätigungsverzerrung` and `Confirmation Bias` resolve to one entity. A search for `Sunk Cost` may help discover an escalation page, but it must not collapse Sunk Cost Effect and Escalation of Commitment into the same entity.

Situation search starts from ordinary problem language such as `KI`, `Projekt`, `Team`, `Termin`, `Kauf` or `Verhandlung`, then routes into reviewed concepts and techniques.

## International SEO

- German pages use stable `/de/` URLs and self-canonicals.
- Detail pages receive reciprocal `de` / `en` hreflang only when a true English equivalent exists.
- Partial collections must not claim a broader English collection as an equivalent alternate merely because the topics overlap.
- Situation-first German guides do **not** declare English hreflang when the nearest English context is only related rather than materially equivalent. A visible English navigation link may still route to `/contexts/`.
- No automatic browser-language redirect.
- German metadata, Open Graph text, headings and structured data are localized.
- The English canonical ID remains stable inside the data model.

## Machine-readable contract

Generated public data lives under `/data/de/` and is derived from the same canonical entity IDs as English.

Current reviewed outputs include:

- `/data/de/biases.json`
- `/data/de/techniques.json`
- `/data/de/decision-guides.json`

A consumer should be able to recover the canonical concept identity, German labels and aliases, practical content, evidence boundary and related reviewed techniques without inventing a second German taxonomy.

## Mobile and accessibility

German strings are expected to be longer than English strings.

- Layouts must wrap instead of shrinking fonts.
- Search inputs and controls must fit narrow screens without horizontal overflow.
- `html lang="de"`, localized navigation labels and meaningful link text are mandatory.
- English concept names on German pages use `lang="en"` where practical.
- Avoid truncating German compound nouns when wrapping works.

## Current reviewed cohort

The current German rollout contains 25 reviewed concept pages. It prioritizes practical search demand, useful decision clusters and popular claims that need careful evidence boundaries.

Core and decision concepts include:

- Bestätigungsfehler
- Ankereffekt
- Verfügbarkeitsheuristik
- Rückschaufehler
- Wahrheitseffekt
- Effekt des fortdauernden Einflusses
- Eskalation des Commitments
- Sunk-Cost-Effekt
- Status-quo-Verzerrung
- Framing-Effekt
- Planungsfehlschluss
- Ergebnisverzerrung
- Automation Bias
- Verlustaversion
- Dunning-Kruger-Effekt
- Backfire-Effekt
- Fluch des Wissens
- Decoy-Effekt
- Default-Effekt
- Mere-Urgency-Effekt
- Zero-Sum Bias
- Anthropomorphisierung
- Impact Bias
- Projektionsbias
- Hungry-Judge-Effekt

All 11 canonical decision techniques are localized.

## Situation-first layer

The reviewed `/de/entscheidungen/` layer provides six problem-first guides:

- convincing AI answers;
- weak projects that are hard to stop;
- teams that converge unusually quickly;
- project estimates when a target date already exists;
- important purchase decisions;
- consequential negotiations.

The product route is:

`situation → concrete check → relevant reviewed bias lenses → relevant Denkwerkzeuge → evidence boundary`

The collection and every detail page are generated from reviewed `data/de/decision-guides*.json`, publish one merged `/data/de/decision-guides.json`, appear in the sitemap and are connected back from relevant German bias and technique pages.

These pages intentionally avoid false alternate-language claims. They may link visibly to the English contexts hub for deeper exploration, but only materially equivalent pages qualify for reciprocal hreflang.

The implementation contract is tracked by GitHub issue #151.

## Next rollout criteria

Add a concept or situation when at least one of these is true and the evidence contract is ready:

- meaningful German search demand;
- strong relationship to an existing German practical journey;
- strong relevance to work, money, information, learning or AI-assisted decisions;
- needed to remove a broken or awkward English fallback from a German path;
- a popular oversimplification materially benefits from an evidence-bounded German correction.

Prefer coherent clusters over arbitrary alphabetical batches. Missing German coverage is better than an authoritative-looking weak translation.
