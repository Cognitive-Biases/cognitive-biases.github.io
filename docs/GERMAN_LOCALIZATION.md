# German localization system

Status: full canonical German coverage with tiered evidence states

The German experience is a localized representation of the same canonical knowledge graph used by the English site. It is not a second encyclopedia and translation must never create a stronger scientific claim than the canonical project supports.

## Product job

A German page should help a reader answer, in this order:

1. Was passiert gerade in meinem Denken oder meiner Entscheidung?
2. Woran erkenne ich das Muster?
3. Was kann ich konkret prüfen oder anders machen?
4. Wie gut ist dieses Konzept im Projekt evidenzgeprüft?
5. Wo liegen die Grenzen des Effekts oder der Technik?

Definitions explain concepts. Denkwerkzeuge change the next action. Situation-first guides let readers start without knowing a bias name.

## Language style

Use contemporary German at roughly B2 reading level where the subject allows it.

- Prefer short, direct sentences over long nominal constructions.
- Use a semi-formal `du` voice on practical pages.
- Translate meaning, not English syntax.
- Avoid bureaucratic wording, hype and universal claims.
- Keep useful English terms searchable without making every heading bilingual.
- Explain specialist terms on first use when plain language helps.
- Preserve uncertainty. `May`, `can`, `mixed`, `conditional`, contested mechanisms and scope limits must not become stronger claims in German.

## Full-corpus coverage

Every published canonical slug in the prepared `data/biases.json` must have exactly one German representation. Coverage is checked mechanically by `scripts/check-de-corpus-parity.mjs` after the canonical preparation step.

The maintainable localization packs are `data/de/biases-corpus-*.json`. They preserve canonical slugs and provide natural German titles, English names, aliases, summaries, observable traps and concrete checks.

Existing reviewed German entries remain authoritative where the same slug also appears in the complete corpus packs. The corpus packs guarantee language coverage; they do not replace stronger evidence-reviewed copy.

## Three evidence/localization states

The public `/data/de/biases.json` uses three states.

### `reviewed-evidence`

A fully reviewed German evidence page. The canonical concept has a controlled Evidence Review and the German page includes the reviewed evidence summary, explicit boundary and sources.

### `localized-with-canonical-review`

A high-quality German concept and practice localization where a controlled canonical Evidence Review exists, but the scientific detail has not been promoted into the fully reviewed German layer. The German page links to the canonical review for sources, evidence strength and exact boundaries.

### `localized-legacy`

A high-quality German localization of a published canonical legacy entry for which the project currently has no controlled Evidence Review. The page must explicitly say this. Its existence in the canonical dataset does not establish effect strength, universality, mechanism or causality.

Complete language coverage must not be confused with complete scientific validation of every historical catalog entry.

## Concept-type accuracy

Not every historical item in `data/biases.json` is best described as a cognitive error. German localization should be more precise than weak legacy shorthand when necessary.

- Testing Effect, Generation Effect, Levels of Processing, Lag Effect and similar entries are learning or memory effects, not automatically errors.
- Weber–Fechner is a psychophysical principle, not a universal cognitive bias.
- Systematic Bias is a measurement and statistical concept, not one psychological mechanism.
- Surrogation and Prevention Bias are domain-specific constructs.
- HRI project labels must not be presented as standardized psychological effects.
- Persistence of intrusive memories can enter a mental-health context and must not be reduced to a casual self-help bias label.

## Important evidence boundaries

- `Sunk-Cost-Effekt` and `Eskalation des Commitments` are related but distinct.
- `Default-Effekt` and `Status-quo-Verzerrung` are related but not interchangeable.
- Availability is a heuristic, not automatically an error.
- Dunning–Kruger is a calibration pattern in studied tasks, not a personality diagnosis.
- Backfire is not the normal response to factual correction.
- Loss aversion has no universal coefficient of exactly two.
- A late project does not prove Planning Fallacy.
- The Hungry Judge literature does not establish hunger as the causal mechanism.
- Humanlike AI cues do not establish understanding, consciousness or accuracy.
- Groupthink is not diagnosed by fast consensus alone.

## Search and entity identity

German search matches the primary German name, accepted German aliases, the English canonical name and useful discovery wording. All language variants resolve to the same canonical slug.

Search phrases must not collapse different entities. For example, `Sunk Cost` may help discovery around escalation, but Sunk Cost Effect and Escalation of Commitment remain separate concepts.

## Practical UX

The primary practical label is **Denkwerkzeug**. Bias and effect pages expose, where applicable:

- Was passiert?
- Probier das
- Evidenzstatus / Warum es helfen kann
- Grenzen

Situation-first pages use:

- Die Situation
- Prüfe das
- Warum es helfen kann
- Grenzen
- Bias-Linsen
- Denkwerkzeuge

Practical checks are not guaranteed debiasing cures and do not diagnose the cause of one decision.

## International SEO

- German pages use stable `/de/` URLs and self-canonicals.
- Every German detail page that represents a canonical English concept gets reciprocal `de` / `en` hreflang.
- German collection pages do not claim broader English hubs as equivalent alternates merely because their topics overlap.
- Situation-first German guides declare English hreflang only if a materially equivalent page exists.
- No automatic browser-language redirect.
- German metadata, Open Graph text and structured data are localized.
- Canonical IDs remain language-stable.

## Machine-readable contract

Generated German public data lives under `/data/de/`:

- `/data/de/biases.json` — full published canonical coverage plus localization/evidence state;
- `/data/de/techniques.json` — all canonical decision techniques;
- `/data/de/decision-guides.json` — reviewed situation-first guides.

A consumer can recover:

canonical slug → German label → English label → German aliases → practical content → localization/evidence state → evidence class when available → canonical English URL → German URL.

Agents must inspect the state before making scientific claims. A `localized-legacy` record is useful for language and discovery but not, by itself, evidence that the named effect is well established.

## Quality gates

German completion is not determined by a manual count.

- `scripts/check-de-corpus-parity.mjs` verifies exact source-level coverage of the prepared published canonical slugs, with no extras or duplicates.
- `scripts/check-de-full-corpus-public.mjs` verifies generated page coverage, public dataset parity, evidence-state disclosure, reciprocal detail hreflang and sitemap coverage.
- `scripts/check-de-localization.mjs` continues to protect the fully reviewed German concepts, techniques and situation-first routes.
- The full repository check must remain green.

## Decision layer

`/de/entscheidungen/` provides problem-first routes for AI answers, weak projects, fast team consensus, target-driven estimates, important purchases and negotiations.

The route is:

`situation → concrete check → relevant reviewed bias lenses → relevant Denkwerkzeuge → evidence boundary`

These guides are practical review procedures assembled from reviewed concepts and techniques; they do not create new scientific effects.

## Maintenance rule

When a new canonical entry becomes published during `prepare:data`, the German parity gate must fail until a German representation is added. When a controlled Evidence Review is added later, the German entry should be promoted to the strongest justified evidence state rather than leaving a stale legacy warning.
