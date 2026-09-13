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

The structured source is `data/de/glossary.json`.

Important defaults:

| English | Primary German | Notes |
| --- | --- | --- |
| cognitive bias | kognitive Verzerrung | `Denkfehler` is a plain-language/search alias, not a perfect synonym. |
| heuristic | Heuristik | A heuristic can be useful; it is not automatically an error. |
| confirmation bias | Bestätigungsfehler | Alias: Bestätigungsverzerrung. |
| anchoring effect | Ankereffekt | Do not mechanically replace with Ankerheuristik. |
| availability heuristic | Verfügbarkeitsheuristik | Do not imply the heuristic is always wrong. |
| hindsight bias | Rückschaufehler | Keep the English name as a search alias. |
| illusory truth effect | Wahrheitseffekt | Aliases include illusorischer Wahrheitseffekt and Reiterationseffekt. |
| sunk cost effect | Sunk-Cost-Effekt | Explain as Effekt der versunkenen Kosten where useful. |
| status quo bias | Status-quo-Verzerrung | Staying can still be rational when switching costs are real. |
| framing effect | Framing-Effekt | Alias: Rahmungseffekt. |

Do not use search terms as semantic aliases when the concepts differ. For example, `Sunk-Cost-Effekt` is a search term around Escalation of Commitment, but the project keeps Sunk Cost Effect and Escalation of Commitment as separate canonical entities.

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

`aliases` may be emitted as alternate names in structured data. `searchTerms` are discovery-only phrases and must not be promoted to synonyms.

German techniques preserve the canonical technique slug and canonical bias links. Translation may improve readability but must not silently change the technique's purpose, prerequisites or limitations.

## Evidence boundary

A German bias page may be published in the reviewed layer only when:

- the canonical slug has a controlled evidence class;
- a canonical evidence review exists;
- the German summary does not claim more than that review supports;
- the boundary section remains visible;
- source links continue to point to the reviewed canonical sources.

Do not translate a broad popular definition when the canonical project has already narrowed or corrected it.

## UX vocabulary

The primary practical label is **Denkwerkzeug** in navigation and discovery. Individual pages use **Praktische Technik** as the content type.

`Hack` is not banned, but it is not the default taxonomy label because it can suggest a quick universal fix. Use it only in editorial copy when the informal tone is useful and the limitation remains clear.

Practical detail pages should expose these headings when applicable:

- Was passiert?
- Probier das
- Warum es helfen kann
- Grenzen

Examples are useful when they improve transfer, but should not be added mechanically to every page.

## Search and entity resolution

German search must match:

- the primary German name;
- accepted German aliases;
- the English canonical name;
- discovery-only phrases such as common mixed German/English search queries.

All variants resolve to one canonical concept page. Do not create separate pages for `Bestätigungsfehler`, `Bestätigungsverzerrung` and `Confirmation Bias`.

## International SEO

- German pages use stable `/de/` URLs and self-canonicals.
- Detail pages receive reciprocal `de` / `en` hreflang only when a true English equivalent exists.
- Partial collections must not claim an English collection as an equivalent alternate merely because the topics overlap.
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

## Initial reviewed cohort

The first German rollout deliberately prioritizes high-intent and practical concepts instead of bulk translating the corpus:

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

All canonical decision techniques are localized so a German user can move from recognition to action even while long-tail bias coverage remains incomplete.

## Next rollout criteria

Add a bias to German when at least one of these is true and the evidence contract is ready:

- meaningful German search demand;
- strong relationship to an existing German practical journey;
- strong relevance to work, money, information, learning or AI-assisted decisions;
- needed to remove a broken or awkward English fallback from a German path.

Prefer coherent clusters over arbitrary alphabetical batches.
