# Integration cookbook

This project is designed to be useful without requiring a custom SDK. The simplest integration is ordinary HTTP over the static public release.

## 1. Pin a release

Start with `/data/manifest.json`. Check `releaseVersion`, `schemaVersion` and the checksum of the file you plan to use. For a reproducible experiment, switch from the latest alias to `/data/releases/<releaseVersion>/...`.

## 2. Retrieve reviewed knowledge

Use `/data/evidence.json` when a scientific claim matters. A useful response should include the concept's canonical URL, evidence status, evidence class, qualification, review date and source IDs.

Do not treat a record from the large concept library as evidence-reviewed unless it also has a reviewed evidence record.

## 3. Start from the situation when possible

If a user describes a real decision but does not name a bias, check `/data/contexts.json` before guessing a label. Decision guides combine several reviewed lenses around one situation.

Use `/data/comparisons.json` when two named concepts are easy to confuse. Use `/data/relations.json` only for reviewed typed relations.

## 4. RAG

`/data/rag.ndjson` contains stable semantic chunks. Each chunk keeps a canonical resource ID, URL, review state, release version and content hash. Consumers can choose their own embedding model. Embeddings are intentionally not part of the canonical release.

A retrieved chunk should remain traceable to its public page and sources. Do not split an evidence qualification away from the claim it limits.

## 5. MCP

`integrations/mcp/` contains a small read-only reference adapter. It reads the same generated public data and exposes reviewed search, concept lookup, evidence, contexts, comparisons and semantic relations.

The adapter is provider-neutral. It is an example integration surface, not a new source of truth.

## 6. Abstain cleanly

A useful agent can say that the library does not have a reviewed answer. The retrieval benchmark includes no-answer cases on purpose. A missing match is safer and more informative than producing a confident label from weak similarity.

## Citation

For a concept, cite the canonical public page. For a dataset-dependent result, also record the release version. `CITATION.cff` contains project-level citation metadata.
