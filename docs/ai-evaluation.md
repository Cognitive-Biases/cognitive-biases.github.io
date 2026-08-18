# AI retrieval and citation evaluation

Machine-readable data is useful only if a retrieval system returns the right reviewed material and keeps its limits visible.

The public benchmark in `/data/evals/retrieval-citation.json` contains versioned cases for:

- direct concept lookup;
- evidence and source requests;
- concept comparisons;
- situation-first decision questions;
- no-answer and out-of-scope requests.

Expected answers use canonical reviewed IDs. The benchmark records the data release so a result can be reproduced later.

Deterministic checks can measure canonical IDs, URLs, valid source references and correct no-match behavior. Semantic answer quality should remain a separate review dimension. If an LLM judge is used later, its judgment must stay inspectable and must not become the only authority for scientific correctness.

We do not collapse retrieval, citation and uncertainty preservation into one AI-readiness score. A single score would hide the exact failure that needs to be fixed.
