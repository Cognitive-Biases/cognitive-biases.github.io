# AGENTS.md — Cognitive Biases

Use this file as the root entry point for ChatGPT and other repository agents. Preserve the project's evidence-first knowledge model, explicit review state, public data compatibility, and separation between research discovery and published claims.

## Start here

Read only the context needed for the task:

1. `README.md` — current product, source locations, public data and validation.
2. `docs/project-direction.md` — product direction and non-goals.
3. `docs/editorial-policy.md` — public writing and evidence rules.
4. `docs/data-contract.md` — machine-readable compatibility contract.
5. `docs/research-agent.md` — source-first research workflow when research is involved.
6. Relevant repository skill under `skills/` for recurring research, content, or translation work.
7. `.arwp/README.md` and `.arwp/site-focus.json` — current site-focus boundary and Search/AI verification policy when navigation, URLs, discovery, public structure or agent surfaces are involved.

Do not start by loading all generated `dist/` output or the complete corpus when a targeted source read is sufficient.

## Task router

| Task | Canonical source | Coupled files to inspect | Verification |
| --- | --- | --- | --- |
| Bias explanation/library record | `data/biases.json` and relevant reviewed data beside it | affected human page, evidence/relations/taxonomy records | `npm run build` and `npm run check` |
| Evidence/claim update | reviewed evidence/source records | public explanation, source identity, claim provenance, review date/status | `npm run build` and `npm run check` |
| Comparison/context/decision guide | canonical comparison/context data | related bias records, evidence, generated pages and retrieval data | `npm run build` and `npm run check` |
| Research update | workflow in `docs/research-agent.md` and research inbox/source data | existing library claims and research pages | relevant research checks plus `npm run check` |
| Public data/API/RAG | canonical `data/` sources and schemas | release manifest, checksums, `/data/releases/`, MCP adapter | `npm run build` and `npm run check` |
| Translation/localization | canonical reviewed meaning plus translation state | localized pages/data and review metadata | relevant translation skill/check plus `npm run check` |
| MCP/integration | generated public release as input; `integrations/mcp/` and `docs/integration-cookbook.md` | schemas, retrieval/abstention contract | `npm run build`, `npm run check`; smoke the adapter when behavior changes |
| Site/search/discovery | human source and build code | sitemap, metadata, ARWP/search surfaces, internal links, canonical URLs | `npm run build`, `npm run check`; review post-deploy ARWP evidence |

## Source-of-truth rules

- The project is not a race to publish the longest bias list. Prefer reviewed explanation, evidence, comparisons, decision contexts, provenance, and honest uncertainty.
- `data/biases.json` is the original corpus; generated legacy records are not automatically independently reviewed.
- Research enters an inbox/review flow first. Do not change a public evidence-sensitive claim from search metadata or an unread source.
- When evidence is mixed or a popular claim is too strong, preserve that uncertainty in both human and machine-readable representations.
- Public data is another view of maintained knowledge. Keep page meaning, release data, schemas, provenance, and review status aligned.
- The reference MCP adapter is read-only and must preserve `no_match` when the reviewed library cannot support a concept or comparison.
- Fix canonical source or generator before generated `dist/` output; do not hand-edit derived output as a substitute for the source.
- Do not copy third-party source prose into the project; source-backed facts must be expressed in original editorial language.

## Search / AI technical preflight

- The active AWRP verification revision is `716e0a13aeaef1f2dcb2dd89d868fbf7343acc63`. Keep workflow pins and `.arwp/site-focus.json` on the same reviewed revision; do not silently follow upstream `main`.
- Site Focus, Site Readiness Gate and Technical Integrity are bounded implementation checks. A pass is not evidence of ranking, indexing, AI citation, traffic, educational effect or business impact.
- Public ARWP audits run after a successful Pages deployment and record the deployed commit, deploy workflow run, ARWP revision and report digests. Do not label a pull-request-only build as deployment proof.
- For an intentional URL rename, move or consolidation, add `.arwp/url-migrations.json` with explicit absolute HTTPS `oldUrl` → `newUrl` pairs. The post-deploy workflow must run URL Migration Integrity when that manifest is non-empty.
- A direct Site Focus remediation may receive a remediation receipt only after source checks, successful deployment, production re-measurement, before/after diagnostics and known unknowns exist. Never invent transformation lineage.
- Do not weaken robots, canonical, evidence, provenance, crawler or retrieval rules merely to silence a diagnostic. Review the finding and fix the canonical source or generator when the evidence supports a change.

## GitHub / publication boundary

- `main` is the production GitHub Pages source. Do not push or merge to `main` unless the active user request authorizes it.
- `.github/workflows/deploy-pages.yml` runs its build/check path for pull requests, but artifact upload and the `deploy` job are skipped for `pull_request`. Preserve this separation.
- Do not weaken evidence review, data compatibility, CI checks, Pages permissions, search workflows, or deployment triggers for agent convenience.
- A successful build/check proves repository consistency, not external search visibility or real-world decision quality.

## Verification

Normal local sequence:

```bash
npm install
npm run build
npm run check
```

Use repository skills and focused checks for research, content review, or translation work when relevant. Do not claim a check passed unless it ran for the changed revision.

For public Search/AI structure, inspect the post-deploy `AWRP Site Quality` artifact after Pages deploys the target revision. Treat P0 findings as review/fix signals and preserve the raw reports.
