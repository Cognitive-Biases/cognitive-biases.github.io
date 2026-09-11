# Agent Skills Marketplace

Cognitive Biases publishes practical decision workflows as portable Agent Skills.

The goal is not to turn every bias name into a tiny prompt. A useful agent skill should represent a job the agent can perform repeatedly: review a decision, challenge evidence, verify information, forecast, compare concepts, or use AI advice more carefully.

## Product model

The marketplace has three layers:

1. **Reviewed knowledge** — canonical bias records, evidence reviews, contexts and comparisons remain the source of truth.
2. **Decision skills** — human-readable workflows in `data/skills.json` connect several reviewed lenses to a practical capability.
3. **Portable Agent Skills** — `data/agent-skills.json` packages those capabilities into the open `SKILL.md` format and adds agent-specific workflows that are useful across the library.

This avoids a second knowledge base. If evidence changes, fix the reviewed source first. Agent skills should point back to that source rather than copying a stale scientific claim into a prompt.

## Compatibility contract

The generated bundle uses the Agent Skills convention: one directory with a `SKILL.md` file containing YAML frontmatter with at least `name` and `description`, followed by Markdown instructions.

The first release is intentionally conservative:

- instruction-only;
- no executable scripts;
- no secrets or API keys;
- no required network access;
- no framework-specific tool names inside the workflow;
- public source links are optional evidence support, not a runtime dependency.

The website provides direct install commands for Hermes Agent and OpenClaw. ChatGPT Skills, Codex and other Agent Skills-compatible tools can import the same `SKILL.md` through their supported skill surface or skill directory.

Do not add framework-specific metadata unless the generic skill cannot express the required capability. Portability is more valuable than decorative metadata.

## Why not one skill per bias?

A bias name is usually knowledge, not a capability. Hundreds of one-concept skills would create routing collisions, duplicate definitions, increase prompt-selection noise and provide little procedural value.

Use these rules:

- If the user job is **understand one concept**, improve `cognitive-bias-lens` and the canonical bias page.
- If the user job is **review a real decision**, improve `bias-aware-decision-review` or a task-specific decision skill.
- Create a new portable skill only when it has a distinct trigger, workflow, output contract and quality check that existing skills cannot cover cleanly.
- Bias-specific skills are allowed when the bias genuinely requires a distinct procedure, not because a page exists for it.

## Bias synchronization contract

A newly published canonical cognitive bias must never exist only in the human library while the Agent Skills layer remains unaware of it.

The synchronization rule is:

1. Every published canonical bias is automatically in scope of `cognitive-bias-lens`. That skill uses the canonical public bias dataset as its library source, so adding a new published canonical record extends the generic skill without creating a duplicate prompt.
2. When the new bias is useful to an existing Decision Skill, add its canonical slug to that Decision Skill's reviewed `biases` list. The mapped portable Agent Skill must then expose the bias as an evidence-linked lens.
3. Every public Decision Skill must keep a mapped portable Agent Skill. A new Decision Skill cannot be published as human-only functionality.
4. Create a separate portable Agent Skill for a new bias only when it introduces a distinct recurring job, trigger, procedure and output contract. Do not create one merely to satisfy catalogue count.
5. Repository checks must fail if `cognitive-bias-lens` loses its canonical bias-library source or if a Decision Skill loses its portable Agent Skill mapping.

This makes bias publication and skill coverage one workflow. The default outcome for a new bias is **generic skill coverage plus relevant workflow lenses**, not **one new skill per bias**.

## Public surfaces

Build output exposes:

- `/agent-skills/` — marketplace;
- `/agent-skills/<name>/` — human-readable listing and install instructions;
- `/agent-skills/<name>/SKILL.md` — portable skill file;
- `/agent-skills/catalog.json` — marketplace catalog;
- `/data/agent-skills.json` — public structured distribution;
- `/schemas/agent-skill.schema.json` — catalog record schema.

The same records are also added to sitemap, data catalogue, corpus metrics and retrieval data.

## Skill quality gate

Before adding or changing a public agent skill, check all of the following:

1. **Job** — the skill solves a recurring task, not merely a topic.
2. **Trigger** — the description tells an agent when the skill should load and when it should not.
3. **Procedure** — the workflow contains observable steps, not slogans such as “think critically.”
4. **Output contract** — another agent can tell what a complete result looks like.
5. **Evidence boundary** — bias names remain candidate lenses unless evidence supports a stronger statement.
6. **Alternative explanation** — important bias interpretations should allow ordinary non-bias explanations such as incentives, constraints, missing information or chance.
7. **Bias coverage** — every published canonical bias remains reachable through `cognitive-bias-lens`; relevant new biases are also wired into existing Decision Skills.
8. **Portability** — avoid tool names and filesystem assumptions inside the core workflow unless essential.
9. **Security** — instruction-only is the default. Any future executable resource requires explicit review and a documented reason.
10. **Source alignment** — mapped decision skills and evidence-linked lenses must still exist and remain canonical; every Decision Skill keeps a portable mapping.
11. **Discovery** — marketplace page, raw `SKILL.md`, public data, sitemap and internal links remain aligned.

Run the normal repository build and checks after changes. `scripts/check-skills.mjs` validates both the human Decision Skills layer and the portable Agent Skills layer, including the bias synchronization contract.

## Initial collection

The first release contains two core skills and six task-specific skills:

- `cognitive-bias-lens` — explain or compare a named bias without diagnosing a person;
- `bias-aware-decision-review` — review a consequential decision using a small set of candidate lenses and counter-checks;
- `evidence-evaluation`;
- `decision-making-under-uncertainty`;
- `forecasting`;
- `metacognition`;
- `information-verification`;
- `ai-assisted-reasoning`.

The collection should grow from real user jobs and search/agent demand, not from a target count.

## Distribution strategy

The site remains the canonical marketplace because it can show the evidence model, complete skill text and security boundary before installation. External directories such as framework-specific community catalogs can be secondary distribution channels once a skill is stable.

When publishing elsewhere, preserve the canonical marketplace URL, version/review date, licence and complete `SKILL.md`. Do not fork the instructions into silently divergent copies.
