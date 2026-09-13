# Full German bias corpus

Goal: every `published: true` canonical entry in `data/biases.json` has a high-quality German representation.

Quality contract:

- preserve canonical English slug and entity identity;
- use natural German at roughly B2 level, not literal sentence-by-sentence translation;
- keep useful English concept names searchable;
- never promote a legacy/generated English entry to evidence-reviewed status merely because it has been translated;
- existing reviewed German entries remain authoritative where the slug overlaps;
- localized legacy pages must visibly distinguish localization from controlled evidence review;
- effects that are learning, memory, psychophysics or domain-specific concepts must not be mislabeled as universal cognitive errors;
- exact published-slug parity is verified automatically by `scripts/check-de-corpus-parity.mjs`.

Rollout state: full corpus translation pass in progress; parity and public rendering gates determine completion.
