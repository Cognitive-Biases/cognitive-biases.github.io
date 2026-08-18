# Multilingual content

English is the canonical editorial language for reviewed Cognitive Biases records.

German and Russian should be added as language layers over the same reviewed knowledge, not as separate copies of the database.

## What stays canonical

These fields should not be independently translated or re-decided per language:

- record ID and canonical slug;
- kind and family;
- evidence status;
- reviewed date;
- source metadata and DOI;
- typed relations;
- publication state.

## What can be localised

Language layers may provide:

- display title;
- summary;
- mechanism explanation;
- examples;
- practical questions and checks;
- comparison copy;
- research-note prose.

A translation should preserve uncertainty. If the English page says the evidence is mixed, the translated page must not silently make the claim stronger.

## URL plan

Keep current English URLs stable. Add language prefixes for new versions:

- `/de/...`
- `/ru/...`

Use proper `hreflang` links and language-specific canonical URLs when the pages are implemented.

## Translation workflow

1. Translate only canonical reviewed material or clearly mark a legacy translation as unreviewed.
2. Translate meaning, not sentence structure.
3. Check scientific terms against normal usage in the target language.
4. Preserve citations, review dates and evidence status from the canonical record.
5. Review for natural language by a fluent speaker.
6. Re-review a translation when the canonical evidence-sensitive fields change.

The goal is not to create three parallel encyclopedias. It is one maintained knowledge base that can be read naturally in several languages.
