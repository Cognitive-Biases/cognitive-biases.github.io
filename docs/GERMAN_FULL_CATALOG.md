# German full-catalog localization contract

Status: full canonical coverage

## Product decision

The German layer must cover every published canonical concept in `data/biases.json`, not only the controlled evidence-reviewed subset.

Current parity target:

- 219 published canonical concepts;
- 219 German canonical concept pages;
- 0 missing canonical German slugs;
- supplemental German-only research concepts may exist, but they do not change the canonical parity count.

The source parity gate is `scripts/check-de-full-catalog.mjs`.

## Quality does not mean fake evidence parity

The catalog has two independent dimensions:

1. **Localization completeness** — is the canonical concept fully usable in German?
2. **Evidence-review depth** — does the project maintain a controlled scientific review for that concept?

Do not collapse these dimensions.

### `evidence-reviewed`

These pages belong to the controlled German reviewed layer. They keep explicit evidence boundaries and the richer German evidence-first presentation.

### `editorial-localization`

These pages are complete German editorial localizations of published canonical catalog entries. They have:

- a natural German title or the established international term;
- a German B2-level explanation;
- a concrete description of the reasoning/perception/memory pattern;
- at least three practical checks or handling steps;
- the English canonical name and stable canonical slug;
- an explicit evidence boundary.

An editorial localization MUST NOT silently upgrade a legacy/generated canonical entry into an established scientific effect.

If a canonical English Evidence Review exists for an editorial-localization page, the German page may link to it and expose the controlled evidence class, but it must still be clear that the detailed source synthesis remains in the canonical review.

## Terminology

Prefer established German terminology when it is common and unambiguous, for example:

- Funktionale Fixierung
- Illusorische Korrelation
- Kontrollillusion
- Basisratenfehler
- Spielerfehlschluss
- Besitztumseffekt
- Kindheitsamnesie
- Quellenverwechslung
- Testeffekt

Keep internationally used English labels when an invented German translation would be less natural or less searchable, for example:

- Common-Source-Bias
- Compassion Fade
- Dread Aversion
- Groupthink
- Truth Bias
- Shared-Information-Bias

In those cases the explanation itself remains German. Search must still match the English canonical term.

Do not translate a familiar research term merely to make every title look German. Terminological usefulness is more important than cosmetic purity.

## Writing standard

German catalog prose should be readable at approximately B2 level unless technical precision requires a specialist term.

Prefer:

- short, direct sentences;
- one mechanism or boundary per sentence;
- semi-formal `du` language in practical checks;
- observable checks over vague advice;
- `kann`, `häufig`, `in manchen Kontexten` when the source does not justify universality.

Avoid:

- literal English syntax;
- SEO filler;
- moral labels for people;
- claims that a bias can be eliminated by one trick;
- presenting every memory, perception, measurement or social effect as the same kind of cognitive error;
- translating project labels as if they were standardized academic terminology.

## Page contract

Every canonical German bias page must have:

- stable `/de/biases/{canonical-slug}/` URL;
- `html lang="de"`;
- self canonical;
- reciprocal English/German detail hreflang;
- German title, summary, trap explanation and practical checks;
- English canonical name for entity resolution;
- `DefinedTerm` structured data using the canonical slug;
- visible quality/evidence state;
- sitemap coverage;
- representation in `/data/de/biases.json`.

The complete collection `/de/biases/` must search across:

- German title;
- German aliases;
- English canonical title;
- discovery/search variants.

## Preservation rule

The full-catalog generator runs after the existing reviewed German generator.

It MUST NOT replace the richer reviewed pages. It only creates canonical pages that are still missing and then rebuilds the combined collection/data layer.

The public quality gate explicitly checks that the deep reviewed Confirmation Bias page still contains its reviewed sources and Denkwerkzeuge after full-catalog expansion.

## Machine-readable contract

`/data/de/biases.json` represents canonical published German coverage and includes:

- canonical slug;
- German title;
- English canonical title;
- aliases/search terms;
- German summary/trap/actions;
- `localizationState`;
- canonical status/category;
- canonical URL;
- evidence metadata when available.

Agents must treat `localizationState` and evidence provenance as separate from language availability.

## Autonomous completion rule

Full German localization is complete only when all of the following are true:

1. source parity reports 219/219 canonical published concepts;
2. the German language-quality gate passes;
3. the normal site build generates all 219 German canonical detail routes;
4. public `/data/de/biases.json` contains exactly the canonical published slug set;
5. every English canonical detail page links back to its German alternate;
6. every German detail page has self canonical, English alternate and sitemap entry;
7. the existing reviewed German pages remain richer than editorial legacy pages;
8. repository-wide checks and final public-surface gates pass.

Do not mark the full-catalog PR ready while any of these conditions fails.
