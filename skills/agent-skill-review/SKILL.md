# Agent skill review

Use this repository skill before adding or substantially changing a public skill in the Cognitive Biases Agent Skills Marketplace.

## Goal

Keep public agent skills useful, portable, evidence-aware and safe to install.

## Review steps

1. Identify the recurring job the skill performs. Reject a skill that only renames a topic or a single bias without a distinct procedure.
2. Check the trigger description. It should make clear when the skill helps and avoid broad wording that would cause it to load for unrelated tasks.
3. Walk through the procedure with a realistic case. Every step should change the work product or the decision process.
4. Check the output contract. A user or another agent should be able to tell whether the workflow completed.
5. Inspect all bias language. Biases are candidate lenses, not diagnoses, intent claims or proof of causation.
6. Require at least one alternative non-bias explanation when the workflow interprets a real person's or team's behavior.
7. Verify mapped Decision Skills and evidence-linked lenses against canonical current data.
8. Prefer framework-neutral instructions. Do not hard-code a tool name when the workflow can describe the capability generically.
9. Keep public skills instruction-only by default. Executable scripts, secrets, network requirements or external writes require an explicit reason and separate security review.
10. Inspect the generated marketplace page and raw `SKILL.md`, then run the normal build/check path.

## Routing test

A good skill has a narrow enough description that an agent can choose it reliably.

Ask:

- What user request should trigger this skill?
- What similar request should not trigger it?
- Does another existing skill already own this job?
- Would combining two skills reduce routing overlap without losing a useful workflow?

## Evidence test

Public skills may summarize a procedure, but they should not create a second scientific source of truth. When a step depends on a reviewed cognitive-bias claim, link back to the canonical reviewed material. Preserve mixed, limited or unknown evidence instead of upgrading it for a cleaner prompt.

## Result

Return one of:

- ready;
- ready after small edits;
- routing overlap — merge or narrow;
- needs stronger workflow/output contract;
- needs evidence review;
- needs security review;
- do not publish as a separate skill.
