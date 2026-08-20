# Study 001 result

**Status:** independent re-analysis of public model outputs.

## Primary result

Across **248** analysable question-model pairs, the model response moved in the same direction as the anchor in **185** cases (**74.6%**, Wilson 95% interval 68.8%–79.6%).

This supports the narrow descriptive claim that anchor direction and model answer direction are strongly associated in these released outputs. It does **not** establish a new bias, a causal mechanism beyond the source experiment, or a human effect.

## By model

| Model | Questions | Aligned | Rate | 95% interval | Median relative shift |
|---|---:|---:|---:|---:|---:|
| anthropic/claude-3-haiku | 62 | 51 | 82.3% | 71.0%–89.8% | 0.145 |
| anthropic/claude-3.5-haiku | 62 | 48 | 77.4% | 65.6%–86.0% | 0.097 |
| google/gemini-2.5-flash | 62 | 44 | 71.0% | 58.7%–80.8% | 0.044 |
| google/gemini-2.5-flash-lite-preview-06-17 | 62 | 42 | 67.7% | 55.4%–78.0% | 0.071 |

## Sensitivity: unambiguous anchor strings

When restricted to **144** pairs where each anchor hint contains one numeric token, alignment is **80.6%** (Wilson 95% interval 73.3%–86.2%).

## Paired model-family check

| Comparison | Common questions | Baseline rate | Comparison rate | Difference | McNemar exact p |
|---|---:|---:|---:|---:|---:|
| Claude Haiku 3.5 vs 3 | 62 | 82.3% | 77.4% | -4.8 pp | 0.549 |
| Gemini Flash vs Flash Lite | 62 | 67.7% | 71.0% | +3.2 pp | 0.804 |

The paired checks are secondary and descriptive. They do not support a simple claim that a newer or larger model is automatically more or less anchor-sensitive.

## Reproducibility

Source data are pinned to `JiaxuLou/LLM_Bias@0083e9ec780469d91d52c5411e59d0efbd82fe9e`. The source paper is DOI [10.1007/s42001-025-00435-2](https://doi.org/10.1007/s42001-025-00435-2).

The full question-level output is published beside this summary.

## Limitations

- This is a re-analysis of outputs collected by the source authors, not a fresh model run.
- Anchor extraction is rule-based. A conservative sensitivity analysis excludes pairs whose hint contains more than one numeric token.
- Repeated model outputs within a question are not treated as independent question-level replications.
- Direction alignment is descriptive and does not identify a psychological mechanism.
- The result says nothing directly about how humans respond to AI advice.
