# Content review

Use this skill before publishing or substantially rewriting public Cognitive Biases content.

## Goal

Keep the library clear, original, evidence-aware and consistent with the project direction.

## Review steps

1. Read the full entry and any evidence review attached to it.
2. Check that the first paragraph does not make a stronger claim than the reviewed evidence.
3. Remove diagnostic language, exaggerated certainty and generic filler.
4. Rewrite from the underlying idea when wording is too close to a source or to another page.
5. Keep practical advice as a question, check or procedure rather than a promised cure.
6. Check related concepts for accidental duplication or contradiction.
7. Confirm sources, review date and evidence status when the entry is marked reviewed.
8. When publishing a new canonical cognitive bias, treat its individual Agent Skill as part of the same publication. The build must generate exactly one free Bias Skill linked to that canonical bias, expose it in the Bias Skills catalog, public agent-skills data, RAG and sitemap, and add an install link back to the canonical bias page.
9. If the new bias is also relevant to an existing Decision Skill, add it to that broader reviewed workflow so the mapped Workflow Agent Skill receives it as an evidence-linked lens too.
10. Run repository checks. They must fail if any published canonical bias lacks its individual Bias Skill or if a Decision Skill loses its Workflow Agent Skill mapping.

## Public writing test

A reader who knows nothing about psychology should understand:

- what the pattern is;
- a realistic example;
- what the evidence supports;
- what the evidence does not prove;
- one useful thing to check in a decision.

If the page needs technical vocabulary, explain it in the sentence where it first appears.

## Originality test

Do not copy source sentences. Do not use light synonym replacement. Build the final explanation from notes after reading the sources.

For important new pages, search a distinctive sentence on the public web before publication. If the same wording exists elsewhere, rewrite it.

## Agent Skill publication test

For every published canonical bias, verify after build:

- one generated Bias Skill exists;
- its `sourceBias` matches the canonical slug;
- its `SKILL.md` links to the canonical bias page;
- the bias page links back to the Agent Skill;
- the skill is marked free to install;
- marketplace catalogs, RAG, metrics and sitemap include it.

Do not maintain a second hand-written copy of the scientific claim inside the skill. The canonical bias record remains the source of truth.

## Result

Return one of:

- ready;
- ready after small edits;
- needs evidence review;
- needs rewrite;
- merge with another concept;
- missing generated Bias Skill;
- keep as legacy until reviewed.
