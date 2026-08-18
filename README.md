# Cognitive Biases

Cognitive Biases is a public knowledge library about cognitive biases, evidence and decision making.

The project started as an educational mobile app. The website and the maintained knowledge base are now the main product.

- Website: https://cognitive-biases.github.io/
- Explore the library: https://cognitive-biases.github.io/explore/
- Reviewed evidence: https://cognitive-biases.github.io/evidence/
- Decision guides: https://cognitive-biases.github.io/contexts/
- Research: https://cognitive-biases.github.io/research/
- Quality status: https://cognitive-biases.github.io/quality/
- Public data: https://cognitive-biases.github.io/data/

## What we are trying to do

There are already many lists of cognitive biases. This project is not trying to win by making a longer list.

We connect clear explanations with evidence, sources, review dates, useful comparisons and real decision contexts. When the evidence is mixed or a popular claim is too strong, the page should say so.

The same maintained knowledge is also published as structured data so search tools, assistants and agents can reuse it without having to guess what a page means.

See [`docs/project-direction.md`](docs/project-direction.md) for the product direction, [`docs/editorial-policy.md`](docs/editorial-policy.md) for the writing rules, and [`docs/data-contract.md`](docs/data-contract.md) for the public data compatibility contract.

## Local development

```bash
npm install
npm run build
npm run check
npm run dev
```

`npm run build` creates the static site and machine-readable release in `dist/`. GitHub Actions runs the full checks and deploys the main branch to GitHub Pages.

To run the read-only MCP reference adapter after a build:

```bash
node integrations/mcp/server.mjs
```

## Content

The original corpus lives in [`data/biases.json`](data/biases.json). Reviewed evidence, comparisons, contexts, relations and taxonomy data live beside it in `data/`.

Older records marked as generated are useful legacy material, but they are not automatically treated as independently reviewed. Evidence-sensitive entries are improved in batches and keep an explicit review status.

## Research workflow

[`docs/research-agent.md`](docs/research-agent.md) defines the research loop. New papers and research updates enter an inbox first. They are compared with the existing library before any public claim is changed.

Repository skills for recurring work live in `skills/`:

- `research-editor` evaluates a new source;
- `content-review` checks public copy before publication;
- `translation-review` keeps language versions aligned with the reviewed meaning.

## Public data and AI use

The build publishes a versioned public data release beside the human-readable pages. It includes the bias library, consolidated evidence reviews, canonical source identities, claim provenance, decision contexts, comparisons, research notes, quality metrics, translation state and a retrieval-ready NDJSON distribution.

The latest aliases stay under `/data/`. Reproducible consumers can pin `/data/releases/<releaseVersion>/`. Every release has a checksum manifest and public JSON Schemas.

The reference MCP adapter in [`integrations/mcp/`](integrations/mcp/) reads the same generated release. It is read-only and returns `no_match` when the reviewed library does not support a requested concept or comparison.

[`docs/integration-cookbook.md`](docs/integration-cookbook.md) shows the intended retrieval, RAG, citation and abstention flow.

Human-readable pages remain the primary explanation. The data files are another view of the same maintained knowledge.

## Contributing and citation

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for corrections, source suggestions, taxonomy proposals and research collaboration. Evidence-like submissions require provenance and editorial review before publication.

[`CITATION.cff`](CITATION.cff) contains project citation metadata. When a result depends on the dataset, also record the exact release version.

## Licence

The current Cognitive Biases website content is licensed under [CC BY-NC-SA 4.0](LICENSE). Attribution and the same licence are required for sharing or adaptations, and commercial use is not permitted without prior written permission from MetalHatsCats. Cognitive Biases names and logos are not licensed for reuse.

The licence does not permit copying third-party source prose into this project. Research sources support the facts and claims; new editorial text must be written in our own words.
