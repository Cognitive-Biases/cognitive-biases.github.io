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

Definitions explain the concept. Denkwerkzeuge change the next action.

## Language style

Use contemporary German at roughly B2 reading level where the subject allows it.

- Prefer short, direct sentences over long nominal constructions.
- Use a semi-formal `du` voice on practical pages.
- Avoid literal English syntax.
- Avoid bureaucratic wording and marketing claims.
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

## Evidence boundary

A German bias page may be published in the reviewed layer only when:

- the canonical slug has a controlled evidence class;
- a canonical evidence review exists;
- the German summary does not claim more than that review supports;
- the boundary section remains visible;
- source links continue to point to the reviewed canonical sources.

Do not translate a broad popular definition when the canonical project has already narrowed or corrected it. Practical actions are checks, not guaranteed debiasing cures. A matching bias is a lens for inspecting a decision process, not proof that the bias caused one particular decision.

## UX vocabulary

The primary practical label is **Denkwerkzeug** in navigation and discovery. Individual pages use **Praktische Technik** as the content type.

`Hack` is not banned, but it is not the default taxonomy label because it can suggest a quick universal fix. Use it only in editorial copy when the informal tone is useful and the limitation remains clear.

Practical detail pages should expose these headings when applicable:

- Was passiert?
- Probier das
- Warum es helfen kann
- Grenzen

## Search and entity resolution

German search must match the primary German name, accepted German aliases, the English canonical name and useful discovery-only phrases. All variants resolve to one canonical concept page.

For example, `Bestätigungsfehler`, `Bestätigungsverzerrung` and `Confirmation Bias` resolve to one entity. A search for `Sunk Cost` may help discover an escalation page, but it must not collapse Sunk Cost Effect and Escalation of Commitment into the same entity.

## International SEO

- German pages use stable `/de/` URLs and self-canonicals.
- Detail pages receive reciprocal `de` / `en` hreflang only when a true English equivalent exists.
- Partial collections must not claim a broader English collection as an equivalent alternate merely because the topics overlap.
- No automatic browser-language redirect.
- German metadata, Open Graph text, headings and structured data are localized.
- The English canonical ID remains stable inside the data model.

## Machine-readable contract

Generated public data lives under `/data/de/` and is derived from the same canonical entity IDs as English.

A consumer should be able to recover:

canonical slug → German label → English label → German aliases → German practical content → canonical evidence status → English canonical URL.

This keeps one conceptual graph with multiple language representations instead of forking English and German knowledge.

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

All 11 canonical decision techniques are localized so a German user can move from recognition to action even while long-tail concept coverage remains incomplete.

## Situation-first layer

Problem-first decision guides are a separate product layer from reviewed concept pages. Current staged data lives in `data/de/decision-guides*.json` and covers AI answers, weak projects, fast team consensus, fixed project deadlines, purchase decisions and negotiations.

These source packs intentionally remain `state: draft` until an end-to-end renderer, internal linking, machine-readable output and localization quality gate publish them together. Do not describe the staged records as public reviewed pages before that promotion.

The intended route is:

`situation → concrete check → relevant reviewed bias lenses → relevant Denkwerkzeuge`

A situation guide may combine reviewed concepts and techniques, but it must not invent a new scientific claim, diagnose a person or team, or declare a related English context to be a reciprocal hreflang equivalent unless the pages are materially equivalent.

Implementation and promotion criteria are tracked in GitHub issue #151.

## Next rollout criteria

Add a concept or situation when at least one of these is true and the evidence contract is ready:

- meaningful German search demand;
- strong relationship to an existing German practical journey;
- strong relevance to work, money, information, learning or AI-assisted decisions;
- needed to remove a broken or awkward English fallback from a German path;
- a popular oversimplification materially benefits from an evidence-bounded German correction.

Prefer coherent clusters over arbitrary alphabetical batches. Missing German coverage is better than an authoritative-looking weak translation.
