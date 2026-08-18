# Research agent

The research agent is an editorial assistant for the Cognitive Biases knowledge library.

Its job is not to fill the site with daily news. Its job is to notice useful new evidence, connect it to the existing library and prepare a reviewable update.

## What the agent looks for

Priority topics:

- new studies, reviews and meta-analyses about cognitive biases and decision making;
- replication results or important challenges to well-known findings;
- research on people making decisions with AI;
- cognitive-bias findings in language models and AI agents;
- useful datasets and benchmarks;
- practical studies on forecasting, product decisions, group decisions and information evaluation;
- corrections to claims already present in our library.

General psychology news is not enough. A candidate should have a clear connection to an existing concept, a new concept worth reviewing, or a research question the project follows.

## Research loop

### 1. Discover

Collect candidate sources from reliable places. Record the title, date, link and why the item may matter.

### 2. Filter

Remove promotional articles, repeated coverage of the same paper, weak opinion pieces and items that do not change or deepen anything in the library.

### 3. Read the source

Whenever possible, work from the paper, preprint, official dataset or primary project page rather than a summary written about it.

### 4. Compare with what we already say

Find the related bias, comparison, context or research note. Ask whether the new source confirms, narrows, challenges or extends the current wording.

### 5. Write an evidence note

Write in our own words. Separate the result from the interpretation. Include important limits and do not imply causation when a study does not establish it.

### 6. Propose a change

A useful proposal may be:

- update an evidence status;
- improve a qualification or mechanism;
- add a source;
- rewrite an outdated summary;
- create a comparison;
- add a decision context;
- create a short research note;
- do nothing because the new item does not materially change the current page.

"No change" is a valid result.

### 7. Review before publishing

The agent may prepare a change, but evidence-sensitive changes should be reviewable before they become the canonical public record.

## Research inbox

Each candidate should contain:

- a stable identifier;
- discovery date;
- title;
- source link;
- source type;
- related concepts in the library;
- a short note on why it matters;
- status: new, reading, proposed, accepted, rejected or archived;
- a reason when rejected;
- links to any resulting change.

This allows the project to remember what it has already seen and avoids repeatedly researching the same headline.

## Writing rules

Do not produce generic summaries such as "Researchers discovered an interesting cognitive bias".

A research note should answer:

- What did the study actually test?
- What did it find?
- What does it not establish?
- Does it change anything we currently say?
- Why might this matter in a real decision?

Use the wording "we found" only for what the project found in the reviewed sources, not to imply that we conducted the underlying experiment ourselves.

## Source quality

Prefer primary papers and strong reviews. Treat preprints as provisional. Treat company blog posts as descriptions of company work, not independent scientific evidence.

For fast-moving AI research, publication venue alone is not enough. Check the task design, model versions, sample size, comparison method and whether the claimed bias is actually comparable to the human concept using the same name.

## Safety against content drift

The agent must not:

- rewrite the whole corpus from one paper;
- assign evidence strength from an abstract alone;
- invent missing citations;
- copy wording from a source;
- publish a news claim simply because it is recent;
- turn one model result into a statement about all AI systems;
- silently replace a reviewed statement with a more dramatic one.

## Scheduled scout

The repository includes a scheduled `Research Scout` workflow. It runs once a week and can also be started manually.

The scout currently searches configured arXiv and PubMed queries, scores candidates for relevance, removes records already present in the inbox, and adds only a small number of recent candidates. The queries, lookback window, score threshold and maximum batch size live in `data/research-scout-config.json`.

The scout deliberately stores metadata and our own relevance note rather than copying source abstracts into the project.

When new candidates are found, the workflow pushes an isolated review branch and attempts to open a pull request. It does not change evidence status, public research notes or canonical bias pages. Those changes remain part of the editorial review loop.

A later analysis stage may use an AI model to help compare a candidate with the existing corpus, but discovery remains provider-neutral and a model must not be allowed to turn an abstract into an automatic scientific conclusion.
