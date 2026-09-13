# German Skill Library

Status: reviewed localization layer

The German Skill Library is a localized representation of the same canonical skill graph used by the English site. It must not fork canonical skill identity or silently strengthen the evidence behind a bias.

## Product model

German uses three deliberately different labels:

- **Denkkompetenzen** — reusable human capabilities that can be learned and practised;
- **Denkwerkzeuge** — concrete techniques or interventions used inside a decision process;
- **Agent Skills** — portable instruction packages for AI agents.

Do not collapse these into one generic German word. They have different jobs in the product.

## Coverage contract

The German layer must maintain exact parity with the canonical published skill surfaces:

1. all Decision Skills from `data/skills.json`;
2. all reusable workflow Agent Skills from `data/agent-skills.json`;
3. one German Bias Agent Skill for every canonical per-bias Agent Skill generated from the canonical bias set.

Current build target:

- 6 Decision Skills;
- 8 workflow Agent Skills;
- 216 Bias Agent Skills;
- 224 Agent Skills total.

Counts are derived from canonical data during the build. Do not hard-code a smaller long-term target if the English library grows.

## Stable identity

Localization changes the human-visible language, not the entity identity.

Preserve:

- Decision Skill slugs;
- Agent Skill `name` values in SKILL.md frontmatter;
- bias slugs and sourceBias relationships;
- sourceDecisionSkill relationships;
- canonical English URLs;
- evidence and review status.

A German alias must not create a second skill entity.

## German Decision Skills

Source: `data/de/skills.json`.

Each localization must preserve the purpose of the English skill and provide natural German for:

- title and useful aliases;
- summary;
- learning outcome;
- when-to-use signals;
- practical actions.

The language should be contemporary German, roughly B2 where the subject allows it. Prefer direct verbs and concrete checks over abstract nominal style.

Decision Skill pages live under `/de/skills/` and link to the same canonical bias lenses and decision contexts as English. A German page may link to an English context when no true localized equivalent exists; do not claim false hreflang equivalence for a merely related page.

## German workflow Agent Skills

Source: `data/de/agent-skills.json`.

Every reusable workflow Agent Skill must localize:

- title and description;
- use conditions;
- complete procedure;
- required output contract;
- guardrails.

The canonical `name` remains unchanged in SKILL.md frontmatter so an Agent Skills-compatible tool sees the same skill identity across language variants.

German workflow SKILL.md files must be useful as instructions, not translations of marketing copy. Procedures should be executable as reasoning steps and guardrails must remain explicit.

## German Bias Agent Skills

Bias Agent Skills are generated from the complete public German bias dataset instead of being translated manually one by one.

This is intentional. It ensures that:

canonical bias identity → German bias title and explanation → evidence/localization state → German Agent Skill

stays synchronized when a bias localization is corrected later.

Every German Bias Agent Skill must:

1. describe the situation neutrally before applying the label;
2. identify the concrete observation that makes the lens plausible;
3. provide at least one ordinary alternative explanation that does not require the bias;
4. preserve the current evidence/uncertainty boundary;
5. suggest a practical counter-check;
6. state what would make the interpretation more likely, less likely or unresolved;
7. prohibit diagnosis and unsupported inference about motives, intelligence, personality or mental health.

A Bias Agent Skill is a focused lens, not a verdict.

## Evidence contract

Agent localization must preserve the distinction already used by the German bias catalog:

- `evidence-reviewed` — the German bias belongs to the controlled reviewed layer;
- `editorial-localization` — the canonical catalog entry is fully localized but is not scientifically upgraded by translation.

If a canonical English Evidence Review exists for an editorial localization, the Agent Skill may route to it. It must not describe the German editorial page as an independently reviewed German evidence synthesis.

Workflow Agent Skills can combine multiple reviewed lenses, but the existence of a workflow does not prove that a bias caused the user's situation.

## Human and agent discovery

The localized build publishes:

- `/de/skills/`;
- `/de/skills/{canonical-skill-slug}/`;
- `/de/agent-skills/`;
- `/de/agent-skills/biases/`;
- `/de/agent-skills/{canonical-agent-skill-name}/`;
- localized `SKILL.md` files;
- `/data/de/skills.json`;
- `/data/de/agent-skills.json`.

True English/German page equivalents receive reciprocal hreflang. All generated German skill routes use self canonicals, `lang="de"`, localized metadata and the project editorial-trust link.

## AI routing

`ai/llms.de.txt` should route by task:

- concept explanation → German bias page;
- human reasoning capability → German Denkkompetenz;
- one concrete intervention → German Denkwerkzeug;
- reusable agent workflow → German workflow Agent Skill;
- one focused bias lens for an agent → German Bias Agent Skill;
- scientific detail beyond localized copy → canonical Evidence Review.

Do not chain many single-bias skills when one workflow Agent Skill already represents the real task better.

## Quality gates

`check-de-skill-library.mjs` validates both source and generated public parity.

The gate covers:

- exact 6/6 Decision Skill source parity;
- exact workflow Agent Skill source parity;
- required German content depth;
- route and machine-data counts;
- one Bias Agent Skill for every canonical bias skill;
- canonical Agent Skill names in SKILL.md frontmatter;
- required German sections and guardrails;
- reciprocal hreflang;
- bias → Agent Skill backlinks;
- German skill navigation and search;
- sitemap coverage;
- editorial-trust discovery;
- bounded search metadata.

Missing localized coverage is a build failure, not a silent English fallback.
