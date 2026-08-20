# Study 001 — Anchoring direction re-analysis

Status: preregistered re-analysis, pending automated run.

This study independently re-analyses public model-output data released with Lou & Sun, *Anchoring bias in large language models: an experimental study* (Journal of Computational Social Science, 2025/2026).

The source experiment is not ours. Our contribution is a transparent question-level re-analysis of four released Claude/Gemini result files, pinned to source commit `0083e9ec780469d91d52c5411e59d0efbd82fe9e`.

Primary question: when Group B uses a higher numerical anchor than Group A, how often does the model's trimmed mean response move in the same direction?

Primary outcome: direction-alignment rate across analysable question/model pairs, with a Wilson 95% interval.

Secondary outcomes: parse coverage, median absolute response shift, and a scale-free relative response shift. Results are descriptive. They do not establish a psychological mechanism, human impact, or a new cognitive bias.

Source DOI: https://doi.org/10.1007/s42001-025-00435-2
Source data: https://github.com/JiaxuLou/LLM_Bias
