# Public data contract

Cognitive Biases publishes one maintained knowledge base in two forms: human-readable pages and machine-readable files. The data files are not a second editorial system.

## Versions

Every release has two versions:

- `releaseVersion` identifies a dated public snapshot, for example `2026.08.18`.
- `schemaVersion` identifies the structure of the public data, using semantic versioning.

The stable `/data/*.json` and `/data/*.ndjson` URLs always point to the latest release. A consumer that needs reproducible behavior should pin `/data/releases/<releaseVersion>/...` instead.

## Compatibility

A change is backward-compatible when existing consumers can keep reading the fields they already use. Adding an optional field is normally compatible. Renaming or removing a field, changing its meaning, or changing a stable identity is a breaking change and requires a new major `schemaVersion`.

Canonical concept IDs and public URLs should remain stable. When concepts are merged or renamed, aliases and redirects should preserve identity instead of creating a new meaning silently.

## Release manifest

`/data/manifest.json` is the entry point for a release. It records:

- release and schema versions;
- release date and licence;
- compatibility policy;
- live corpus counts;
- each public distribution and its SHA-256 checksum.

`/data/release-notes.json` describes what changed in plain English.

## Schemas and catalogue

`/data/catalog.json` lists the main distributions, formats and schemas. JSON Schemas are published under `/schemas/` and use JSON Schema Draft 2020-12.

The schemas describe integration contracts. Editorial meaning still comes from the reviewed records and their evidence qualifications.

## Trust boundary

Older library entries can exist without an evidence review. They remain useful for exploration, but they must not be silently promoted into the trusted evidence, RAG or MCP surfaces.

A trusted concept response should preserve at least:

- canonical ID and URL;
- descriptive evidence status;
- controlled evidence class;
- qualification and review date;
- source identities and links.

When no reviewed record fits, integrations should return `no_match` rather than inventing a bias.
