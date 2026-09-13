# French localization guide

French is a reviewed language layer. English remains the canonical source for identifiers, evidence status, sources, review dates and relations.

The goal is not to translate every English sentence. The goal is to give a French-speaking reader a natural, useful and evidence-aware experience without changing the scientific strength of the canonical content.

## Voice

Use contemporary French at roughly B2 level when possible.

- Prefer short, direct sentences.
- Use `vous` when the reader is addressed directly.
- Prefer a verb to an abstract noun when the meaning stays the same.
- Keep the tone semi-formal and practical.
- Avoid bureaucratic phrasing, marketing language and academic ornament.
- Do not use a cognitive bias as a diagnosis of a person.
- Do not turn a conditional research result into a universal rule.

Prefer:

> Vérifiez ce qui pourrait contredire votre idée.

Avoid unnecessarily formal phrasing such as:

> Procédez à une recherche d'éléments susceptibles d'invalider votre hypothèse.

## Product terminology

Use **Technique** as the default label for a practical intervention.

Use **Que faire ?** as the action heading on bias pages.

Do not use `hack` as the main French product term. It is familiar in some technology contexts, but it sounds less credible for evidence-aware decision guidance and does not describe the actual product well.

Use **contre-mesure** only when the context genuinely describes a defensive measure. Use **astuce** only for lightweight advice. Neither should replace **Technique** globally.

## Core terms

| English | Preferred French | Notes |
| --- | --- | --- |
| cognitive bias | biais cognitif | Standard umbrella term. |
| heuristic | heuristique | Keep when it names a judgment shortcut or an established construct. |
| debiasing | réduction de l'effet d'un biais / technique de réduction du biais | Avoid `débiaisage` in normal UI. It can appear once as a technical alias when useful. |
| decision-making | prise de décision | Use `décision` when the shorter form is enough. |
| cognitive shortcut | raccourci cognitif | Explain rather than implying that every heuristic is an error. |
| intervention | intervention / technique | Prefer `technique` for the product UI. |
| evidence | preuves / état des preuves / ce que montrent les études | Do not use `preuve` to imply certainty when the evidence is mixed. |
| uncertainty | incertitude | Keep it visible. |
| confidence | niveau de confiance / degré de certitude | Choose according to context. |
| framing | cadrage | Use `effet de cadrage` for the construct. |
| anchoring | ancrage | Primary entity label: `Effet d'ancrage`. |
| confirmation bias | biais de confirmation | Established French term. |
| sunk cost | coût irrécupérable | `Biais des coûts irrécupérables` is useful for discovery, but it is not automatically identical to escalation of commitment. |
| hindsight bias | biais rétrospectif | Established French term. |
| availability heuristic | heuristique de disponibilité | `Biais de disponibilité` may be kept as a search alias. |
| overconfidence | excès de confiance | Prefer this to an invented scientific-sounding calque. |
| survivorship bias | biais du survivant | `Biais de survivance` can be retained as a discovery alias if the canonical entry is localized later. |
| status quo bias | biais du statu quo | Keep `statu quo` unchanged. |
| social proof | preuve sociale | Popular term; in scientific contexts check whether the canonical construct is actually social influence rather than treating the terms as interchangeable. |
| loss aversion | aversion à la perte | Established term. |
| outcome bias | biais de résultat | Keep distinct from hindsight bias. |
| planning fallacy | biais de planification | `Erreur de planification` can be a secondary alias. |
| illusory truth effect | effet de vérité illusoire | Preferred French term; `effet de vérité` and `effet de réitération` are useful aliases. |
| escalation of commitment | escalade d'engagement | `Biais d'engagement` is an established variant. Do not collapse it into sunk-cost bias without explaining the difference. |

## Bias names are entity labels

A localized label does not create a new entity.

Example:

- canonical ID: `cognitive-bias-confirmation-bias`
- English label: `Confirmation Bias`
- French label: `Biais de confirmation`
- French URL label: `biais-de-confirmation`

The canonical ID remains unchanged in structured data. French aliases are discovery aids, not new entities.

## Practical techniques

A French technique should answer five questions quickly:

1. **Quand l'utiliser** — what situation should trigger the technique?
2. **À essayer** — what concrete steps should the reader take?
3. **Exemple** — what does this look like in a normal decision?
4. **Pourquoi cela peut aider** — what reasoning problem does the procedure address?
5. **Limites** — where can it fail or mislead?

A technique is a structured check, not a guaranteed cure. Translate this boundary explicitly.

## Examples

Prefer situations that work naturally for French-speaking readers without requiring country-specific knowledge:

- work and project decisions;
- recruitment and vendor selection;
- salaries and negotiations;
- online purchases and subscriptions;
- investments and forecasts;
- meetings and team decisions;
- information and media;
- education;
- AI-assisted work.

Do not add a France-specific example merely to make a page look localized. Localize only when the example becomes clearer or more natural.

## Search and aliases

A French page can include the English term in search aliases and once near the title when it improves recognition.

Do not repeat bilingual labels mechanically throughout the page.

Queries such as `confirmation bias français`, `anchoring effect français`, or a problem statement can resolve to the French entity page, while the canonical identifier remains English.

## Fallback

Do not silently render English body text inside a page declared as French.

If a reviewed French page does not exist:

- say that the French version is not available yet;
- provide an explicit link to the canonical English library or page;
- keep the language of the fallback link clear.

This prevents a partial translation from looking complete to people, search engines or agents.

## SEO and AEO

Every published French page should have:

- `<html lang="fr">`;
- a French title and meta description;
- a self-canonical French URL;
- reciprocal `hreflang="fr"` and `hreflang="en"` where an equivalent English page exists;
- `hreflang="x-default"` pointing to the canonical English equivalent;
- structured data with `inLanguage: "fr"`;
- the canonical English/internal identifier when the page represents an entity;
- useful aliases in structured data without changing the canonical ID.

Machine-readable fields and identifiers stay in English. Localization changes values, not schema semantics.

## Review rule

A French translation must be reviewed again when evidence-sensitive canonical content changes.

Never make the French version more certain than the English canonical record. Never invent a French evidence status, source, relation or review date.
