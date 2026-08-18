# Cognitive Biases

Cognitive Biases is a public knowledge library about cognitive biases, evidence and decision making.

The project started as an educational mobile app. The website and the maintained knowledge base are now the main product.

- Website: https://cognitive-biases.github.io/
- Explore the library: https://cognitive-biases.github.io/explore/
- Reviewed evidence: https://cognitive-biases.github.io/evidence/
- Research: https://cognitive-biases.github.io/research/
- Public data: https://cognitive-biases.github.io/data/

## What we are trying to do

There are already many lists of cognitive biases. This project is not trying to win by making a longer list.

We connect clear explanations with evidence, sources, review dates, useful comparisons and real decision contexts. When the evidence is mixed or a popular claim is too strong, the page should say so.

The same maintained knowledge is also published as structured data so search tools, assistants and agents can reuse it without having to guess what a page means.

See [`docs/project-direction.md`](docs/project-direction.md) for the product direction and [`docs/editorial-policy.md`](docs/editorial-policy.md) for the writing and originality rules.

## Local development

```bash
npm install
npm run build
npm run check
npm run dev
```

`npm run build` creates the static site in `dist/`. GitHub Actions checks the project and deploys the main branch to GitHub Pages.

## Content

The original corpus lives in [`data/biases.json`](data/biases.json). Reviewed evidence, comparisons, contexts, relations and taxonomy data live beside it in `data/`.

Older records marked as generated are useful legacy material, but they are not automatically treated as independently reviewed. Evidence-sensitive entries are improved in batches and keep an explicit review status.

## Research workflow

[`docs/research-agent.md`](docs/research-agent.md) defines the research loop. New papers and research updates enter an inbox first. They are compared with the existing library before any public claim is changed.

Repository skills for recurring work live in `skills/`:

- `research-editor` evaluates a new source;
- `content-review` checks public copy before publication;
- `translation-review` keeps language versions aligned with the reviewed meaning.

## Public data

The build publishes a public data release beside the human-readable pages. It includes the bias library, consolidated evidence reviews, decision contexts, comparisons, research notes and release metadata.

Human-readable pages remain the primary explanation. The data files are another view of the same maintained knowledge.

## Licence

The current Cognitive Biases website content is licensed under [CC BY-NC-SA 4.0](LICENSE). Attribution and the same licence are required for sharing or adaptations, and commercial use is not permitted without prior written permission from MetalHatsCats. Cognitive Biases names and logos are not licensed for reuse.

The licence does not permit copying third-party source prose into this project. Research sources support the facts and claims; new editorial text must be written in our own words.
