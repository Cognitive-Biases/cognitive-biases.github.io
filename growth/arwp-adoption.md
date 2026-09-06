# Cognitive Biases — ARWP Growth adoption record

Baseline: 2026-09-06  
Site: https://cognitive-biases.github.io/  
Repository: `Cognitive-Biases/cognitive-biases.github.io`  
Verticals: editorial / research-dataset  
Goals: Search / generative Search / AI citations / measurement / agent discovery

This record documents the site-specific adoption of the current Agent-Ready Web Profile Growth loop. It is implementation evidence, not a claim that ARWP changes guarantee indexing, ranking, Discover distribution, AI citations, traffic or conversion.

## Publisher policy

- Public Search crawling: allowed.
- Search/answer crawler policy: `OAI-SearchBot` is explicitly allowed by the generated `robots.txt`.
- Model-training crawlers: unchanged by this rollout. No GPTBot or other training/reuse permission is inferred from Search access.
- Public reuse boundary: site content remains governed by the repository's CC BY-NC-SA 4.0 terms; this rollout does not broaden commercial or model-training rights.
- Cloudflare `Content-Signal`: not applied because the canonical site is served by GitHub Pages. ARWP `ca5320c06c2d3fe2cc5fa7df96bd9fb67c60b447` now scopes this provider-specific recommendation to public applicability evidence instead of emitting it for GitHub Pages or unknown hosting.

## Selected hypotheses

| Hypothesis ID | Baseline observation | Action | Verification | Outcome signal / owner-data gate |
| --- | --- | --- | --- | --- |
| `search-foundation-first` | Canonicals, sitemap, crawl access and search checks already exist. | Preserve those foundations and keep the site's own build/test gate authoritative. | `npm run check`; deployed sitemap/robots; ARWP Growth audit. | Search Console crawl/indexing and query visibility. |
| `non-commodity-evidence` | The site publishes reviewed evidence, research notes, decision contexts, comparisons, datasets and research deltas. | Keep original/evidence-backed material as the growth surface; reject thin query-variant page families. The manual review is recorded in `growth/content-quality-review-2026-09-06.md`. | Existing evidence/research/search-quality checks plus the dated manual review artifact. | Impressions/clicks and cited landing pages, without assuming causality. |
| `answer-addressability` | Situation-first routes, concept pages, research pages and stable internal navigation are already present. | Preserve deep-linkable answer/evidence routes and internal links rather than adding generic SEO pages. | Site build plus search/discovery checks. | Landing-page/query coverage and observable AI citations. |
| `identity-and-provenance` | Canonical Organization identity, trust, corrections, citations and knowledge graph are active, but the first live Growth scanner found no external `sameAs` identity and no primary-entity logo. | Add the authoritative GitHub organization profile to Organization `sameAs` and expose an absolute logo. If a canonical app JSON-LD node is actually published, enrich it with the real Google Play and App Store profiles; do not fabricate an app node merely to satisfy a checklist. | Production rollout applicator + verifier in `.github/workflows/deploy-pages.yml`; second live audit reports `sameAs=1` and `hasLogoOrImage=true`. | Fewer ambiguous entity/source resolutions; no ranking inference. |
| `discover-visual-preview` | Pages already opt into `max-image-preview:large`; research Article/WebPage schema exposes a representative image. | Retain large-preview eligibility and image/schema consistency; do not treat markup as a distribution guarantee. | Build/search metadata checks and deployed HTML. | Discover/image visibility where owner data exposes it. |
| `chatgpt-search-access` | `OAI-SearchBot` is explicitly allowed. | Preserve Search access separately from GPTBot/training policy. | Deployed `robots.txt` and ARWP audit. | Observable ChatGPT citations/referrals only. |
| `freshness-without-fake-recency` | Bias/research resources use content-backed dates, but base static sitemap routes inherited the build date on every build. | Remove `lastmod` from static routes that have no reliable modification date; keep content-backed dates for dated resources. | `scripts/finalize-late-seo.mjs` rewrites and asserts the policy during every site build. | Cleaner crawl/freshness semantics; no synthetic recency claim. |
| `platform-ai-measurement` | Google Search measurement exists; Bing AI and Google generative Search visibility require authenticated owner data. | Run the current ARWP Growth audit after successful production deploys and weekly, storing both site and ARWP revisions. Keep owner-only visibility controls as explicit external gates. | `.github/workflows/arwp-growth.yml` artifact: `arwp-growth.json`, `site-revision.txt`, `arwp-revision.txt`. | Search, generative/AI citations, referrals and product outcomes remain separate metrics; missing data stays missing. |

## Governance actions from live Growth audit

- `growth:site-reputation-policy`: implemented. The editorial trust model now states that third-party, partner, sponsored or contributed material must serve the project's real educational/research purpose, disclose commercial/control relationships, and cannot be hosted primarily to borrow site reputation. Human and machine-readable trust surfaces expose the same rule.
- `growth:entity-sameas`: implemented using the real `Cognitive-Biases` GitHub organization profile; no synthetic profiles were created. The second live audit removed this action after observing `sameAs=1` and a primary-entity logo.
- `growth:cloudflare-content-signals`: resolved as non-applicable for this deployment. The finding was promoted back into ARWP as a general provider-applicability rule in `ca5320c06c2d3fe2cc5fa7df96bd9fb67c60b447`, with regression cases for GitHub Pages, Cloudflare Pages and unknown hosting.
- `growth:preferred-source-acquisition`: deferred. The feature is not added until repeat-reader value can be supported by owner-side behavior data or a deliberate product decision.
- `growth:bing-ai-citation-measurement`, `growth:google-generative-ai-measurement-global`, `growth:google-platform-properties`, `trend-owner:google-generative-ai-control-global`: external owner-data gates; public crawling cannot close them honestly.

## Build / CI evidence

- Site build and tests: `npm run check` remains the first authority in `Deploy GitHub Pages`.
- Production-only Growth patch: `scripts/apply-growth-rollout.mjs` runs after the normal build + ARWP publication, then `scripts/check-growth-rollout.mjs` must pass before the Pages artifact is uploaded.
- The Growth verifier requires only capabilities that the final build actually publishes. Optional app identity is validated when present, not synthesized when absent.
- ARWP profile validation baseline: `0d60109d0986d1f15fa30cce7bbdaec36ceb108f`; recurring Growth audits intentionally follow current ARWP `main` and store its exact revision.
- First live Growth audit: 9 actions (5 P1 / 4 P2).
- Second live Growth audit after entity/governance rollout: 8 actions (5 P1 / 3 P2); `growth:entity-sameas` disappeared and entity observations became `sameAs=1`, `hasLogoOrImage=true`.
- ARWP provider-scoping correction: `ca5320c06c2d3fe2cc5fa7df96bd9fb67c60b447`; full ARWP validation and Growth Profile suites passed before this adoption record was advanced.
- Remaining external gates: Search Console/analytics windows, Bing AI Performance, Google generative Search owner reports/settings, Discover/image data where available, and observable AI citation/referral evidence.

## Measurement window

Before: latest owner-side data available before the 2026-09-06 rollout.  
After: begin after the corresponding production deployment; compare only after a meaningful observation window.  
Metrics: Search visibility, landing pages/queries, Discover/image visibility where available, AI citations/referrals, and site-specific engagement.  
Missing metrics remain missing rather than being inferred as zero.

## Decision

`keep` for the implementation baseline and iterative Growth loop; longitudinal outcome evidence remains pending.

Reason: the loop has corrected synthetic freshness, made the primary entity more resolvable, published an explicit site-reputation boundary, recorded a manual non-commodity content review, added reproducible Growth measurement, and fed a provider-specific false positive back into ARWP so the standard itself improved rather than forcing a site-specific workaround.
