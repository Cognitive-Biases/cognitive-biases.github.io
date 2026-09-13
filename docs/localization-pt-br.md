# Brazilian Portuguese localization (`pt-BR`)

The Brazilian Portuguese layer is a reviewed localization of the canonical English knowledge base. It is not a fork and it must not create independent scientific claims.

## Scope

The initial `pt-BR` release intentionally uses two coverage levels:

- **Full parity:** all canonical decision techniques, all canonical Decision Skills, and all canonical workflow Agent Skills.
- **Reviewed subset:** bias pages are published only after editorial review in Brazilian Portuguese. Missing bias pages stay missing in `pt-BR`; English text must not be shown as if it were a reviewed translation.

The generated manifest at `/pt-br/data/index.json` exposes both the translated count and the total number of published canonical concepts.

## Canonical identity and evidence

English remains canonical for:

- bias IDs and canonical slugs;
- Decision Skill and Agent Skill IDs;
- JSON field names;
- evidence statuses;
- evidence-review sources and source titles;
- provenance and scientific review dates.

Translation review and evidence review are separate states. A reviewed Portuguese translation does not strengthen a claim or create a scientific review.

## Terminology decisions

Prefer contemporary Brazilian Portuguese used by educated general readers:

| Canonical concept | Preferred `pt-BR` term | Notes |
| --- | --- | --- |
| cognitive biases | **vieses cognitivos** | Main category and search term. |
| decision making | **tomada de decisão** | Prefer over literal or European-Portuguese alternatives. |
| critical thinking | **pensamento crítico** | Use naturally, not as keyword stuffing. |
| heuristics | **heurísticas** | Keep distinction between a heuristic and an error. |
| confirmation bias | **viés de confirmação** | Stable primary term. |
| anchoring effect | **efeito de ancoragem** | `viés de ancoragem` and `ancoragem` are aliases/search terms. |
| availability heuristic | **heurística da disponibilidade** | `viés de disponibilidade` can be an alias when users search for it. |
| hindsight bias | **viés retrospectivo** | `viés de retrospectiva` is an alias. |
| planning fallacy | **falácia do planejamento** | `viés de planejamento` is an alias. |
| escalation of commitment | **escalada de comprometimento** | Do not collapse it into sunk cost. |
| sunk cost fallacy | **falácia do custo afundado** | Search alias related to escalation of commitment; the concepts are close but not identical. |
| debiasing | **redução de vieses** / **mitigação de vieses** | Avoid the unnatural literal form `desenviesamento` in general UX copy. |

Use `como tomar decisões melhores` only where it matches real user intent. Do not repeat search phrases mechanically.

## Routes

- `/pt-br/`
- `/pt-br/explorar/`
- `/pt-br/vieses/<localized-slug>/`
- `/pt-br/tecnicas/`
- `/pt-br/tecnicas/<localized-slug>/`
- `/pt-br/habilidades/`
- `/pt-br/habilidades/<localized-slug>/`
- `/pt-br/agent-skills/`
- `/pt-br/agent-skills/<canonical-skill-id>/`
- `/pt-br/agent-skills/<canonical-skill-id>/SKILL.md`
- `/pt-br/data/index.json`
- `/pt-br/llms.txt`

The visible URL base is lowercase `/pt-br/`; the language tag remains the BCP 47 form `pt-BR`. Open Graph uses `pt_BR`.

## Agent Skills

Workflow Agent Skills keep their canonical English IDs but localize instructions, use conditions, procedures, output contracts and guardrails. The build also emits one Portuguese bias-specific `SKILL.md` for every reviewed Portuguese bias page.

Agents must:

1. treat bias labels as hypotheses, not diagnoses;
2. keep plausible alternative explanations open;
3. separate facts, inferences, recommendations and unknowns;
4. preserve canonical evidence status and provenance;
5. avoid treating agreement between AI outputs as independent evidence;
6. use decision checks to test a process, not to promise a correct result.

## Adding another bias translation

1. Add one reviewed entry to `data/translations-pt-br.json`.
2. Keep `canonicalId` identical to the published English bias slug.
3. Write a natural `localizedLabel`, `summary`, `practicalQuestion`, examples and boundary from scratch in Brazilian Portuguese; do not bulk-translate generated English prose.
4. Add useful English aliases and real Brazilian search terms without stuffing.
5. Link only canonical techniques that actually apply.
6. Run `npm run build` and `npm run check`.

The generator will create the human page, machine-readable entry, search record, sitemap URL, reciprocal English discovery link and bias-specific Agent Skill.
