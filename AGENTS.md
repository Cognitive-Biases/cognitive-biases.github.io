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
7. `.arwp/README.md`, `.arwp/site-focus.json`, `.arwp/technical-seo-critic.json` and `.arwp/image-discovery.json` — current site-focus boundary, second-pass technical Search review, image-discovery review and Search/AI verification policy when navigation, URLs, discovery, public structure, visual assets or agent surfaces are involved.

Do not start by loading all generated `dist/` output or the complete corpus when a targeted source read is sufficient.

## Task router

| Task | Canonical source | Coupled files to inspect | Verification |
| --- | --- | --- | --- |
| Bias explanation/library record | `data/biases.json` and relevant reviewed data beside it | affected human page, evidence/relations/taxonomy records | `npm run build` and `npm run check` |
| Evidence/claim update | reviewed evidence/source records | public explanation, source identity, claim provenance, review date/status | `npm run build` and `npm run check` |
| Comparison/context/decision guide | canonical comparison/context data | related bias records, evidence, generated pages and retrieval data | `npm run build` and `npm run check` |
| Deep situation guide | `data/situations.json` + `data/situation-guides.json` | matching reasoning-practice pack, `data/search-intents.json`, comparisons/research notes, schema, citation/AWRP routing | `npm run build` and `npm run check` |
| Research update | workflow in `docs/research-agent.md` and research inbox/source data | existing library claims and research pages | relevant research checks plus `npm run check` |
| Public data/API/RAG | canonical `data/` sources and schemas | release manifest, checksums, `/data/releases/`, MCP adapter | `npm run build` and `npm run check` |
| Translation/localization | canonical reviewed meaning plus translation state | localized pages/data and review metadata | relevant translation skill/check plus `npm run check` |
| MCP/integration | generated public release as input; `integrations/mcp/` and `docs/integration-cookbook.md` | schemas, retrieval/abstention contract | `npm run build`, `npm run check`; smoke the adapter when behavior changes |
| Site/search/discovery | human source and build code | sitemap, metadata, ARWP/search surfaces, internal links, canonical URLs, Technical SEO Critic, Image Discovery | `npm run build`, `npm run check`, `npm run check:technical-seo-critic`, `npm run check:image-discovery`; review post-deploy live critic/image evidence |
| Editorial image/search image | `public/assets/editorial/`, `data/image-metadata.json`, build post-processors | page `og:image`, structured data, sitemap image entry, robots/preview policy | `npm run check:image-discovery`; live check after deployment |

## Source-of-truth rules

- The project is not a race to publish the longest bias list. Prefer reviewed explanation, evidence, comparisons, decision contexts, provenance, and honest uncertainty.
- `data/biases.json` is the original corpus; generated legacy records are not automatically independently reviewed.
- `data/situation-guides.json` is the authored deep-guide extension keyed to canonical records in `data/situations.json`. Improve the existing `/situations/<slug>/` page instead of creating a second SEO landing page for the same decision.
- `data/search-intents.json` is an editorial discovery model. A `situationSlugs` mapping says the situation is useful for that question; it is not evidence that Google demand, ranking or traffic has been measured.
- Deep guides should connect a real decision to a bounded review protocol, realistic practice and the strongest existing comparison/research surfaces. Do not manufacture a new cognitive-bias label merely to fill a guide.
- Research enters an inbox/review flow first. Do not change a public evidence-sensitive claim from search metadata or an unread source.
- When evidence is mixed or a popular claim is too strong, preserve that uncertainty in both human and machine-readable representations.
- Public data is another view of maintained knowledge. Keep page meaning, release data, schemas, provenance, and review status aligned.
- The reference MCP adapter is read-only and must preserve `no_match` when the reviewed library cannot support a concept or comparison.
- Fix canonical source or generator before generated `dist/` output; do not hand-edit derived output as a substitute for the source.
- Do not copy third-party source prose into the project; source-backed facts must be expressed in original editorial language.
- For images, fix the asset mapping, metadata source or build post-processor rather than hand-editing generated HTML/sitemap output. Informative images may carry contextual alt; decorative card/UI imagery may legitimately remain empty-alt.

## Public writing quality

- Write public English at approximately B2 level: clear, concrete and readable without flattening the idea into baby language.
- Prefer a semi-formal human voice. Short memorable lines are welcome when they sharpen the decision, for example a contrast or a small piece of dry humor, but the page must quickly move to evidence, procedure or an example.
- Do not add generic SEO filler, throat-clearing introductions, repeated definitions or paragraphs whose only job is to make a page longer.
- Explain specialist terms when they matter. A reader should be able to use the guide without already knowing the bias name.
- Keep examples realistic and specific enough to transfer to work or everyday decisions, while avoiding fake precision and invented outcomes.
- Every practical recommendation should be bounded: state what it helps inspect and what it does not prove.

## Search / AI technical preflight

- General ARWP validation/Growth is pinned to reviewed revision `73bd2a64e2e746deeb8de792ca01f654f0a7d33a`. The completed Technical SEO Critic review remains pinned to its reviewed source revision `28c9cc9b75fa2b17791b7b294b4249fa28496445`, while Image Discovery is pinned to `73bd2a64e2e746deeb8de792ca01f654f0a7d33a`. The Site Focus v0.3 contract and its dedicated workflow may remain on their separately reviewed compatible revision. Never silently follow upstream `main`; document revision boundaries in `.arwp/README.md`.
- Run the Technical SEO Critic after ordinary Search Release/final-public-surface checks. Its job is to find false-green states: invalid effective `<head>`, missing field-CWV evidence, pagination/query-state mistakes, accidental internal `nofollow`, obsolete SEO metadata, HTTP/HTML canonical conflict and negative robots/X-Robots-Tag restrictions.
- `scripts/check-technical-seo-critic.mjs` is deterministic final-artifact evidence and must run before release. `scripts/check-live-technical-seo-critic.mjs` is bounded post-deploy evidence for HTTP headers and revalidation. Neither check turns a clean technical state into a ranking claim.
- Apply Image Discovery after canonical/search metadata generation and again after deploy-time metadata post-processing. `scripts/apply-image-discovery.mjs` aligns unique canonical bias assets with `og:image`, `twitter:image`, `WebPage.primaryImageOfPage` and image sitemap entries. `scripts/check-image-discovery.mjs` verifies the final artifact; `scripts/check-live-image-discovery.mjs` checks a bounded representative live cohort after deployment.
- Keep general image Search eligibility, preferred Search thumbnail metadata, Google Images indexing and Discover suitability as separate outcomes. Image metadata/sitemaps do not prove any of them. Discover-oriented image-size guidance is a separate quality watch, not a universal image-indexing gate.
- Do not mass-generate visual descriptions from slugs, filenames or keywords. `data/image-metadata.json` is the reviewed override source; unreviewed images retain conservative generator fallbacks. Do not add deprecated image sitemap `caption`, `geo_location`, `title` or `license` fields.
- Field Core Web Vitals are owner/provider evidence. Do not relabel Lighthouse/lab measurements as field LCP/INP/CLS, and leave missing field data unknown.
- Pagination is applicability-gated. Do not create pagination work when the site does not expose a pagination URL family. Same for faceted/query-state controls: surface the state space when it exists rather than manufacturing a generic SEO task.
- Site Focus, Site Readiness Gate, Technical Integrity, Technical SEO Critic and Image Discovery are bounded implementation checks. A pass is not evidence of ranking, indexing, Google Images inclusion, Discover placement, AI citation, traffic, educational effect or business impact.
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

For Search/discovery changes, also run:

```bash
npm run check:technical-seo-critic
npm run check:image-discovery
```

Use repository skills and focused checks for research, content review, or translation work when relevant. Do not claim a check passed unless it ran for the changed revision.

For public Search/AI structure, inspect the post-deploy `AWRP Site Quality` artifact plus the live Technical SEO Critic and live Image Discovery check after Pages deploys the target revision. Treat P0 findings as review/fix signals and preserve the raw reports.
