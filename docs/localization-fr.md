# French localization guide

French is a reviewed human-language layer. English remains canonical for identifiers, schemas, evidence status, sources, review dates and relations.

Shared workflow and CI contract: [`localization.md`](./localization.md). The first-class terminology source is [`../data/glossary-fr.json`](../data/glossary-fr.json). This guide explains locale-specific editorial choices; the structured glossary is the machine-readable terminology layer used by review tooling and agents.

The published-bias catalog has complete French coverage. Translation review and evidence review are separate states: good French wording must never imply that a construct has stronger scientific support than the canonical record provides.

## Voice

Use contemporary French at roughly B2 level when possible.

- Prefer short, direct sentences and `vous` for practical prompts.
- Prefer a verb to an abstract noun when the meaning stays the same.
- Keep the tone semi-formal, useful and calm.
- Avoid bureaucratic phrasing, marketing language and academic ornament.
- Do not use a cognitive bias as a diagnosis of a person.
- Do not turn a conditional or disputed result into a universal rule.

Prefer: `Vérifiez ce qui pourrait contredire votre idée.`

## Product terminology

Use **Technique** as the default label for a practical intervention and **Que faire ?** as the action heading. Do not use `hack` as the main French product term.

Important preferred terms include:

| English | Preferred French |
| --- | --- |
| cognitive bias | biais cognitif |
| heuristic | heuristique |
| decision-making | prise de décision |
| evidence | preuves / état des preuves |
| uncertainty | incertitude |
| framing effect | effet de cadrage |
| anchoring effect | effet d'ancrage |
| confirmation bias | biais de confirmation |
| sunk-cost bias | biais des coûts irrécupérables |
| hindsight bias | biais rétrospectif |
| availability heuristic | heuristique de disponibilité |
| overconfidence | excès de confiance |
| survivorship bias | biais de survivance |
| status quo bias | biais du statu quo |
| loss aversion | aversion à la perte |
| outcome bias | biais de résultat |
| planning fallacy | biais de planification |
| illusory truth effect | effet de vérité illusoire |
| escalation of commitment | escalade d'engagement |

Do not collapse nearby constructs. In particular, escalation of commitment and sunk-cost bias remain separate canonical entities even when they are linked for discovery.

## Bias names are entity labels

A localized label does not create a new entity. The canonical ID remains unchanged in structured data and machine-readable datasets. French aliases improve discovery; they do not replace the canonical identifier.

If there is no well-established French scientific name, prefer a clear descriptive label over an invented scientific-sounding calque. Keep the English name as an alias.

Non-standard or domain-specific canonical entries must stay visibly bounded in French. A translation may say that an entry is a project label, measurement concept or disputed finding when that is important to prevent overclaiming.

## Practical content

A French bias page should normally provide:

1. a natural French entity label;
2. a concise definition;
3. a practical question that can change a decision process;
4. at least one realistic example;
5. a visible limitation or evidence boundary;
6. a link to a relevant technique when one is genuinely applicable.

A French technique should answer: **Quand l'utiliser**, **À essayer**, **Exemple**, **Pourquoi cela peut aider**, and **Limites**.

A technique is a structured check, not a guaranteed cure.

## Examples

Prefer situations that work naturally for French-speaking readers without unnecessary country-specific references: work, recruitment, salary, purchases, subscriptions, projects, investments, meetings, media, education, team decisions and AI-assisted work.

Do not add a France-specific detail merely to make a page look localized.

## Search and aliases

Search must resolve both French labels and useful English terms. A query such as `confirmation bias français` should reach the same canonical entity as `biais de confirmation`.

Do not repeat bilingual labels mechanically throughout the page. Show the English term near the title and expose aliases in search/structured data where useful.

## Coverage and fallback

Every currently `published` canonical bias must have a reviewed French translation entry. The French localization check fails when a published canonical bias has no French entry.

Do not silently render English body text inside a page declared as French. If a future canonical bias is published without French coverage, CI must fail rather than publishing a mixed-language fallback.

English remains available as the canonical equivalent through the language switch and reciprocal `hreflang`.

## Translation review vs evidence review

These are different claims:

- **translation reviewed** means the French wording, terminology and entity mapping were checked;
- **evidence reviewed** means a canonical evidence review exists for that construct.

A page without a dedicated evidence review must say so explicitly. It must not invent a local evidence class, local source list or local review date.

## SEO and AEO

Every published French bias page must have:

- `<html lang="fr">`;
- a French title and meta description;
- a self-canonical French URL;
- reciprocal `hreflang="fr"`, `hreflang="en"` and `x-default`;
- structured data with `inLanguage: "fr"`;
- the canonical English/internal identifier;
- French and useful English aliases for discovery;
- inclusion in the sitemap and French machine-readable manifest.

Machine-readable field names and identifiers stay in English. Localization changes values, not schema semantics.

## Review rule

A French translation must be reviewed again when evidence-sensitive canonical wording changes materially. Never make the French version more certain than the English canonical record.
