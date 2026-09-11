# Agent skill review

Use this repository skill before adding or substantially changing a public skill in the Cognitive Biases Agent Skills Marketplace.

## Goal

Keep public Agent Skills useful, portable, evidence-aware, free to install and safe to use.

The marketplace contains two classes of skills:

- **Bias Skills** — exactly one generated skill for every published canonical cognitive bias.
- **Workflow Skills** — broader reusable jobs such as forecasting, verification or decision review.

## Review steps

1. Classify the skill as a Bias Skill or Workflow Skill.
2. For a Bias Skill, verify that it maps to exactly one published canonical bias and is generated from the canonical source rather than maintained as a duplicate knowledge record.
3. For a Workflow Skill, identify the recurring job it performs and reject broad or redundant routing.
4. Check the trigger description. It should make clear when the skill helps and avoid loading for unrelated tasks.
5. Walk through the procedure with a realistic case. Every step should change the work product or decision process.
6. Check the output contract. A user or another agent should be able to tell whether the workflow completed.
7. Inspect all bias language. Biases are candidate lenses, not diagnoses, intent claims or proof of causation.
8. Require at least one alternative non-bias explanation whenever a Bias Skill or workflow interprets a real person's or team's behavior.
9. Verify mapped Decision Skills and evidence-linked lenses against canonical current data. Every public Decision Skill must have a mapped Workflow Agent Skill.
10. Prefer framework-neutral instructions. Do not hard-code a tool name when the workflow can describe the capability generically.
11. Keep public skills instruction-only by default. Executable scripts, secrets, network requirements or external writes require an explicit reason and separate security review.
12. Verify that the complete skill is free to inspect and install.
13. Inspect the generated marketplace page and raw `SKILL.md`, then run the normal build/check path.

## Routing test

Bias Skills are intentionally narrow: the named bias itself is the routing signal. Workflow Skills should be narrow enough that an agent can choose them reliably.

Ask:

- What user request should trigger this skill?
- What similar request should not trigger it?
- For a Bias Skill, is the requested concept actually the canonical bias linked by `sourceBias`?
- For a Workflow Skill, does another existing workflow already own this job?

## Evidence test

Public skills must not create a second scientific source of truth. When a step depends on a cognitive-bias claim, link back to canonical project material and preserve mixed, limited, generated, disputed or unknown status instead of upgrading it for a cleaner prompt.

A generated Bias Skill may summarize the canonical concept, but the bias page and public dataset remain authoritative.

## Bias synchronization test

A new canonical bias and its individual Agent Skill are one publication workflow.

- Every published canonical bias must generate exactly one Bias Skill.
- The generated skill must have a stable Agent Skills-compatible name, `sourceBias`, canonical bias URL and raw `SKILL.md`.
- The canonical bias page must link back to the generated skill.
- The main catalog, Bias Skills catalog, public agent-skills data, metrics, RAG and sitemap must contain it.
- If the bias strengthens an existing Decision Skill, keep that broader workflow mapping as well.
- The generic `cognitive-bias-lens` remains available, but it does not replace the required individual Bias Skill.
- CI must fail when the number of generated Bias Skills differs from the number of published canonical biases.

## Result

Return one of:

- ready;
- ready after small edits;
- source mismatch;
- routing overlap — merge or narrow workflow skill;
- needs stronger workflow/output contract;
- needs evidence review;
- needs security review;
- generated Bias Skill missing;
- do not publish workflow skill.
