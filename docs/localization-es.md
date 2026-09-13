# Spanish localization contract

Spanish (`es`) is a reviewed human and agent-facing layer over the canonical English Cognitive Biases knowledge base. It is not a fork of the ontology.

## Editorial target

Use natural, neutral international Spanish that is readable in Spain and Latin America. Prefer established psychology and decision-science terms when they are clear. Keep useful regional search variants as aliases rather than forcing them into every page. For example, the primary copy may use `coste hundido`, while `costo hundido` remains discoverable through aliases and search terms.

The writing should explain a mechanism, show where it can matter, and give the reader a practical check. Do not turn a bias label into a diagnosis of a person or group.

## Canonical identity and evidence

English remains canonical for:

- bias and skill identifiers;
- JSON field names and schemas;
- evidence status and evidence classes;
- source identity, DOI and source titles;
- relationships between concepts, techniques, contexts and skills.

A reviewed Spanish translation and a reviewed scientific claim are different states. Spanish pages must preserve the canonical evidence status when a dedicated review exists. If no dedicated review exists, the page says so explicitly instead of inventing a local evidence grade.

Do not strengthen a claim during localization. Preserve caveats for contested, context-dependent, non-standard or measurement-oriented entries.

## Routes

Human routes use Spanish vocabulary while preserving canonical IDs in structured data:

- `/es/` — Spanish home;
- `/es/explorar/` — published bias library;
- `/es/sesgos/<localized-slug>/` — bias detail;
- `/es/tecnicas/` and `/es/tecnicas/<localized-slug>/` — practical decision techniques;
- `/es/habilidades/` and `/es/habilidades/<localized-slug>/` — decision skills for people and agents.

The current Spanish layer has complete coverage of published canonical biases, canonical decision techniques and canonical Decision Skills. Checks fail when the English canonical layer grows without a matching reviewed Spanish record.

## Search and discovery

Each localized bias keeps:

- the Spanish label;
- the canonical English recognition label;
- aliases and common search variants;
- the canonical ID;
- a localized slug used only for the human URL.

Search should work for both Spanish and common English bias names. Where a regional wording difference matters for discovery, include it in aliases/search terms instead of creating duplicate concepts.

## SEO and hreflang

Spanish pages use a self-canonical URL and reciprocal `hreflang` relationships with the true English and French equivalent when that equivalent exists. `x-default` points to canonical English.

Generated Spanish pages declare `lang="es"`, `inLanguage: "es"` in structured data and Spanish Open Graph locale metadata. Sitemap entries are generated from the reviewed source layer.

Do not create `hreflang` links between pages that are merely similar. They must represent the same canonical entity or the equivalent collection surface.

## Agent skills and AI discovery

`ai/llms.es.txt` is the Spanish routing surface for agents. It directs agents to the Spanish bias, technique and skill libraries while keeping scientific identity and provenance canonical.

Agent behavior should follow these rules:

1. start from the user's decision or information problem rather than guessing a bias label;
2. treat a bias as a candidate mechanism or review lens, not a diagnosis;
3. prefer practical checks and techniques that make the decision process inspectable;
4. preserve evidence status, uncertainty and source boundaries;
5. distinguish independent evidence from repeated copies of the same source;
6. when using AI, separate fluent output from verified capability and independently verify consequential claims;
7. answer `unknown` or `not verified` when the evidence does not support a stronger claim.

## Quality gates

Run:

```bash
npm run check:spanish-localization
npm run check:spanish-skills
```

The normal `npm run check` includes both gates. They validate complete canonical coverage, reviewed state, source release parity, required practical content, route generation, structured data, reciprocal language discovery, sitemap coverage, public datasets, AI routing and Decision Skills parity.

Never hand-edit generated `dist/` output. Update source datasets, generators or checks and rebuild.
