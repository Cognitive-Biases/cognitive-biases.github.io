# Translation review state

English is the canonical editorial layer. German and Russian are reviewed views of the same canonical concepts, not independent knowledge bases.

Each translated record keeps the canonical ID and the `sourceRelease` it was reviewed against.

States:

- `missing` — no translation is maintained yet;
- `draft` — wording exists but has not completed review;
- `reviewed` — wording was checked against the current canonical release;
- `stale` — it was reviewed before, but the canonical release has changed since that review.

A build can therefore mark a translation stale without changing its canonical identity. Evidence class, source identity, relations and other scientific metadata stay language-independent.

The first German and Russian records are deliberately a small pilot. Broad machine translation would create more visible content faster, but it would also create three versions that quietly disagree. This project prefers explicit gaps over invisible drift.
