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
- Cloudflare `Content-Signal`: not applied because the canonical site is served by GitHub Pages. ARWP `ca5320c06c2d3fe2cc5fa7df96bd9fb67c60b447` scopes this provider-specific recommendation to public applicability evidence.

## Selected hypotheses

| Hypothesis ID | Baseline observation | Action | Verification | Outcome signal / owner-data gate |
| --- | --- | --- | --- | --- |
| `search-foundation-first` | Canonicals, sitemap, crawl access and search checks already exist. | Preserve those foundations and keep the site's own build/test gate authoritative. | `npm run check`; deployed sitemap/robots; ARWP Growth audit. | Search Console crawl/indexing and query visibility. |
| `non-commodity-evidence` | The site publishes reviewed evidence, research notes, decision contexts, comparisons, datasets and research deltas. | Keep original/evidence-backed material as the growth surface; reject thin query-variant page families. The manual review is recorded in `growth/content-quality-review-2026-09-06.md` and exposed as owner-controlled workflow evidence in `/ai/growth-review.json`. | Existing evidence/research/search-quality checks plus the dated manual review artifact and ARWP owner-review receipt validation. | Impressions/clicks and cited landing pages, without assuming causality. |
| `answer-addressability` | Situation-first routes, concept pages, research pages and stable internal navigation are already present. | Preserve deep-linkable answer/evidence routes and internal links rather than adding generic SEO pages. | Site build plus search/discovery checks. | Landing-page/query coverage and observable AI citations. |
| `identity-and-provenance` | The first live Growth scanner found no external `sameAs` identity and no primary-entity logo. | Add the authoritative GitHub organization profile to Organization `sameAs` and expose an absolute logo. Do not fabricate optional app JSON-LD. | Production rollout applicator + verifier; later live audits report `sameAs=1` and `hasLogoOrImage=true`. | Fewer ambiguous entity/source resolutions; no ranking inference. |
| `discover-visual-preview` | Pages already opt into `max-image-preview:large`; research Article/WebPage schema exposes representative imagery. | Retain large-preview eligibility and image/schema consistency; do not treat markup as a distribution guarantee. | Build/search metadata checks and deployed HTML. | Discover/image visibility where owner data exposes it. |
| `chatgpt-search-access` | `OAI-SearchBot` is explicitly allowed. | Preserve Search access separately from GPTBot/training policy. | Deployed `robots.txt` and ARWP audit. | Observable ChatGPT citations/referrals only. |
| `freshness-without-fake-recency` | Bias/research resources use content-backed dates, but base static routes previously inherited the build date. | Remove `lastmod` from static routes without a reliable modification date; retain content-backed dates. | `scripts/finalize-late-seo.mjs` plus sitemap checks. | Cleaner freshness semantics; no synthetic recency claim. |
| `platform-ai-measurement` | Google Search measurement exists; Bing AI and Google generative Search visibility require authenticated owner data. | Run current ARWP Growth audits after successful production deploys and weekly, storing site and ARWP revisions. | `.github/workflows/arwp-growth.yml` artifact: `arwp-growth.json`, `site-revision.txt`, `arwp-revision.txt`. | Search, AI citations/referrals and product outcomes remain separate; missing data stays missing. |

## Governance actions from the live Growth loop

- `growth:entity-sameas`: implemented using the real `Cognitive-Biases` GitHub organization profile. It disappeared from the second live audit after ARWP observed `sameAs=1` and a primary-entity logo.
- `growth:cloudflare-content-signals`: resolved as non-applicable for GitHub Pages and generalized back into ARWP in `ca5320c06c2d3fe2cc5fa7df96bd9fb67c60b447`.
- `growth:non-commodity-review`: completed manually and recorded in `/ai/growth-review.json` as `owner-controlled` evidence. This prevents repetitive manual backlog work but is explicitly not independent evidence or a quality/ranking certification.
- `growth:site-reputation-policy`: completed manually and recorded in the same owner-controlled receipt. Human and machine-readable trust surfaces publish the editorial-purpose-first boundary.
- ARWP `254cf2e9d78523f681a21df0e167bb5679b88013` introduced the generic owner-review receipt contract. It can close only matching `status=manual` actions; external owner-data, technical failures and independent-evidence requirements cannot be self-attested away.
- `growth:preferred-source-acquisition`: deferred until repeat-reader value is supported by owner-side behavior data or a deliberate product decision.
- `growth:bing-ai-citation-measurement`, `growth:google-generative-ai-measurement-global`, `growth:google-platform-properties`, `trend-owner:google-generative-ai-control-global`: remain external owner-data gates.

## Build / CI evidence

- Site build/tests: `npm run check` remains the first authority.
- Production Growth patch: `scripts/apply-growth-rollout.mjs` runs after normal build + ARWP publication, then `scripts/check-growth-rollout.mjs` must pass before Pages upload.
- `/ai/growth-review.json` is published by `scripts/apply-arwp.mjs` and checked by `scripts/check-arwp-layers.mjs` for exact site binding, `owner-controlled` evidence class, guardrails, scope/evidence URLs and the two expected manual actions.
- Recurring Growth audits follow current ARWP `main` and store its exact revision.
- Live audit progression:
  - audit 1: 9 actions (5 P1 / 4 P2);
  - audit 2: 8 actions (5 P1 / 3 P2) after entity identity was made resolvable;
  - audit 3: 7 actions (5 P1 / 2 P2) after ARWP correctly recognized `hosting.provider=github-pages` and removed the Cloudflare-only action;
  - next acceptance target: 5 actions after the two completed manual reviews are consumed as owner-controlled receipts. The remaining actions must be external owner-data or deliberately deferred opportunity work.

## Measurement window

Before: latest owner-side data available before the 2026-09-06 rollout.  
After: compare only after a meaningful observation window.  
Metrics: Search visibility, landing pages/queries, Discover/image visibility where available, AI citations/referrals, and site-specific engagement.  
Missing metrics remain missing rather than being inferred as zero.

## Decision

`keep` for the implementation baseline and iterative Growth loop; longitudinal outcome evidence remains pending.

Reason: the loop has reduced actionable technical/editorial backlog through observed fixes and bounded owner-controlled review evidence while preserving external measurement gates, crawler-training boundaries, licence boundaries and the distinction between self-attestation and independent evidence.
