# AI Systematic Biases — editorial and evidence method

## Purpose

The AI Biases pillar documents repeatable directional sensitivities and evaluation distortions in language-model systems. It is deliberately separate from the Human Biases catalog and from Human–AI interaction patterns.

The project uses human cognitive-bias names only when a controlled manipulation is meaningfully analogous. The label is about observable model behaviour. It is not evidence that an AI system has the same mental mechanism, experience, or psychology as a person.

## Three-layer project model

1. **Human Biases** — psychological constructs, evidence, examples and practical decision tools for people.
2. **AI Systematic Biases** — measured model-output sensitivities, evaluator distortions and dated model snapshots.
3. **Human–AI Interaction Patterns** — effects that emerge from people, models and information environments acting together.

Do not merge these layers merely because they share a familiar bias name.

## Evidence ladder

Prefer, in order:

1. peer-reviewed controlled multi-model evidence;
2. peer-reviewed controlled single-model or narrow-context evidence;
3. transparent provider incident reports or system cards for claims about that provider's own deployed system;
4. high-quality preprints with reproducible methods;
5. observations or demonstrations as hypotheses only.

A screenshot, viral conversation or one surprising response is not evidence of a systematic bias.

## Model snapshot contract

Every model-specific public claim must state:

- the exact model or model set when the source reports it;
- the relevant product/API or evaluation surface when known;
- an evidence or observation date;
- the source;
- whether the finding is recent, historical, rolled back, mixed or awaiting retest.

Never copy a finding from one model generation to another. Never infer that a provider family has a permanent trait because one checkpoint showed an effect.

## Freshness

Model behaviour is volatile. The public catalog therefore preserves historical evidence while making recency visible.

- Model-specific snapshots enter a fast review window after 90 days.
- The default catalog review interval is 180 days.
- A materially new model generation, post-training approach, judge protocol or product surface is a reason to retest earlier.
- Old peer-reviewed work remains useful as historical evidence, but it must not be phrased as a current-model guarantee.

## Promotion flow

The scheduled AI research scout writes candidates to `data/ai-bias-research-inbox.json`. This inbox is an evidence queue, not public truth.

Before a candidate changes `data/ai-systematic-biases.json`:

1. open the primary source;
2. verify publication status, model scope and experiment design;
3. record important limits and counter-evidence;
4. decide whether the finding updates an existing entry or justifies a new one;
5. add a dated model snapshot rather than rewriting history;
6. run the full site check.

## Practical self-tests

Self-tests should use controlled pairs or permutations. Change one suspected bias trigger while keeping the task stable, use fresh contexts, record model identity and date, and repeat stochastic cases.

The existing AI Bias Benchmark is the reusable protocol for human-bias analogues such as anchoring and framing. AI-system-specific effects such as judge position bias, RAG source conflict and long-context position sensitivity can use dedicated tests while following the same reproducibility principles.

## Writing rule

Write for a technically curious reader at roughly B2 English. Explain what breaks, where it matters, how to test it and what evidence supports the claim. Avoid anthropomorphic certainty, provider fan culture and generic AI-safety language when a concrete mechanism or test can be described instead.
