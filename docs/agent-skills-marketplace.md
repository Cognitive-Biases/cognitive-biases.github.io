# Agent Skills Marketplace

Cognitive Biases publishes the complete public bias library as free portable Agent Skills, plus higher-level workflow skills for recurring decision jobs.

The marketplace deliberately supports two useful granularities:

1. **Bias Skills** — one installable skill for every published canonical cognitive bias.
2. **Workflow Skills** — broader procedures for jobs such as decision review, forecasting, evidence evaluation, information verification and AI-assisted reasoning.

All public skills are free to inspect and install.

## Product model

The marketplace has four connected layers:

1. **Reviewed knowledge** — canonical bias records, evidence reviews, contexts and comparisons remain the source of truth.
2. **Bias Skills** — every published canonical bias is generated into its own portable `SKILL.md`. The skill explains that single lens, preserves uncertainty, requires an alternative non-bias explanation and gives practical counter-checks.
3. **Decision Skills** — human-readable workflows in `data/skills.json` connect several reviewed lenses to a practical capability.
4. **Workflow Agent Skills** — `data/agent-skills.json` packages those broader capabilities into the open `SKILL.md` format.

This avoids a second scientific source of truth. Bias Skills are generated from the canonical bias dataset and always link back to the canonical page. If evidence or wording changes, fix the reviewed source first and rebuild the marketplace.

## Compatibility contract

Every generated bundle uses the Agent Skills convention: one directory with a `SKILL.md` file containing YAML frontmatter with at least `name` and `description`, followed by Markdown instructions.

The collection is intentionally conservative:

- instruction-only;
- no executable scripts;
- no secrets or API keys;
- no required network access;
- framework-neutral workflow instructions;
- public source links are evidence support, not a runtime dependency.

The website provides direct install commands for Hermes Agent and OpenClaw. ChatGPT Skills, Codex and other Agent Skills-compatible tools can import the same `SKILL.md` through their supported skill surface or skill directory.

## One bias = one free skill

Every published canonical cognitive bias must have an individual Agent Skill.

The generated skill must:

- use a stable Agent Skills-compatible name;
- link to the canonical bias page and public dataset;
- explain the named pattern in plain language;
- require an observed signal before applying the lens;
- surface at least one ordinary alternative explanation;
- preserve the canonical evidence/review boundary;
- provide one or two practical counter-checks;
- avoid diagnosis, personality judgments, intent claims and causal overreach;
- remain free to inspect and install.

The general `cognitive-bias-lens` skill remains useful when an agent needs to identify or compare concepts dynamically, but it no longer substitutes for individual Bias Skills.

## Bias synchronization contract

Bias publication and Agent Skill publication are one workflow.

1. Every published canonical bias must generate exactly one individual Bias Skill.
2. The bias page must link back to its generated Agent Skill.
3. The Bias Skills collection, main Agent Skills catalog, public data, RAG distribution and sitemap must include the generated skill.
4. When a bias is useful to an existing Decision Skill, it should also remain connected to that broader workflow as an evidence-linked lens.
5. Every public Decision Skill must keep a mapped workflow Agent Skill.
6. Repository checks must fail if the count of individual Bias Skills differs from the count of published canonical biases or if any canonical bias loses its generated skill.

A new canonical bias therefore becomes installable automatically on the next successful build.

## Public surfaces

Build output exposes:

- `/agent-skills/` — main marketplace;
- `/agent-skills/biases/` — complete Bias Skills collection;
- `/agent-skills/biases/catalog.json` — machine-readable Bias Skills catalog;
- `/agent-skills/<name>/` — human-readable skill listing and install instructions;
- `/agent-skills/<name>/SKILL.md` — portable skill file;
- `/agent-skills/catalog.json` — complete marketplace catalog;
- `/data/agent-skills.json` — public structured distribution containing workflow and Bias Skills;
- `/schemas/agent-skill.schema.json` — public catalog record schema.

Each canonical bias page also exposes a direct “Install Agent Skill” path.

The same records are added to sitemap, corpus metrics and retrieval data.

## Skill quality gate

For every public Agent Skill, check all of the following:

1. **Free access** — the complete skill is inspectable and installable without a paid marketplace tier.
2. **Source alignment** — a Bias Skill points to exactly one published canonical bias; workflow skills preserve their Decision Skill mapping where applicable.
3. **Trigger** — the description tells an agent when the skill should load.
4. **Procedure** — the workflow contains observable steps, not slogans such as “think critically.”
5. **Output contract** — another agent can tell what a complete result looks like.
6. **Evidence boundary** — bias names remain candidate lenses unless evidence supports a stronger statement.
7. **Alternative explanation** — a Bias Skill must surface a plausible non-bias explanation rather than forcing the named concept to fit.
8. **Portability** — avoid framework-specific tools and filesystem assumptions inside the core workflow.
9. **Security** — instruction-only is the default. Any future executable resource requires explicit review and a documented reason.
10. **Discovery** — marketplace page, raw `SKILL.md`, bias page backlink, public data, RAG and sitemap remain aligned.

Run the normal repository build and checks after changes. `scripts/check-skills.mjs` validates the human Decision Skills layer, workflow Agent Skills and the one-to-one canonical bias → Bias Skill contract.

## Collection model

The workflow collection currently includes:

- `cognitive-bias-lens`;
- `bias-aware-decision-review`;
- `evidence-evaluation`;
- `decision-making-under-uncertainty`;
- `forecasting`;
- `metacognition`;
- `information-verification`;
- `ai-assisted-reasoning`.

In addition, `scripts/generate-bias-agent-skills.mjs` generates one free Bias Skill for every published canonical bias. There is no manually maintained target count: the number of Bias Skills is derived directly from the canonical library.

## Distribution strategy

The site remains the canonical marketplace because it can show the source concept, evidence model, complete skill text and security boundary before installation. External directories such as framework-specific community catalogs can be secondary distribution channels.

When publishing elsewhere, preserve the canonical marketplace URL, source bias URL, review state, licence and complete `SKILL.md`. Do not fork the instructions into silently divergent copies.

“Free” here means free to inspect and install. Content reuse remains governed by the project licence declared in the generated skill and marketplace data.
