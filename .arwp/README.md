# Cite Goose / ARWP adoption

This directory contains publisher-authored Agent-Ready Web Profile contracts for Cognitive Biases. They describe product intent, adoption state and verification policy. They are not ranking, indexing, citation, diagnostic or efficacy certification.

Contract refresh: 2026-09-11. General ARWP validation/Growth revision: `793483e3404a97f7892e86bcda3fd317d5c7427c`. The completed Technical SEO Critic review remains pinned to its reviewed source revision `28c9cc9b75fa2b17791b7b294b4249fa28496445`; the completed Image Discovery review remains pinned to `73bd2a64e2e746deeb8de792ca01f654f0a7d33a`; the Internal Discovery & Distribution review is pinned to `793483e3404a97f7892e86bcda3fd317d5c7427c`. The Site Focus v0.3 schema remains pinned to its separately reviewed compatible revision until that contract itself requires migration.

## Current contracts

- `adoption.json` — discoverability/adoption experiment contract.
- `site-focus.json` — Cite Goose Site Focus v0.3 problem, scope, navigation and experience contract.
- `technical-seo-critic.json` — second-pass adversarial technical Search review and applicability record for TSC-01 through TSC-09.
- `image-discovery.json` — image discovery, preferred-image, image sitemap, alt/context, preview-control and Discover-specific applicability record for IDL-01 through IDL-08.
- `internal-discovery.json` — canonical internal-link, anchor, semantic relation, breadcrumb, continuation, page-utility and graph-regression applicability record for IDD-01 through IDD-10.
- `../ai/site-profile.json` — machine/agent service map for real published interfaces.

The Site Focus contract keeps the project centered on evidence-backed decision understanding rather than catalog growth. A longer list of bias names is not itself a product improvement.

## Product boundary

IN: cognitive biases, evidence, comparisons, real decision contexts and bounded decision practices.

ADJACENT: research methodology, quality governance, datasets, schemas and AI/agent retrieval surfaces.

OUT: diagnosis/treatment, personality typing, generic self-help, claims of becoming bias-free and Search/AI guarantees.

## Verification chain

Repository checks stay fast and deterministic. Public ARWP checks run after a successful GitHub Pages deployment so they do not block the deployment path or confuse source consistency with production behavior.

The release and post-deploy chain now records or verifies:

1. Site Focus v0.3 — declared purpose, scope, navigation and observed page roles.
2. Site Readiness Gate — bounded public Search/AI implementation evidence for a large knowledge site.
3. Technical Integrity — robots/indexability, canonical consistency, snippet controls, crawlable links, bounded internal-link target health and related technical checks.
4. Technical SEO Critic — effective head parsing, field-CWV evidence boundary, pagination/query-state applicability, HTTP revalidation, internal followability, obsolete SEO metadata, HTTP/HTML canonical parity and negative Search-serving directives.
5. Image Discovery — canonical bias-image crawlability, preferred-image convergence, image sitemap coverage, contextual alt semantics, preview controls and a separate Discover-quality watch.
6. Internal Discovery & Distribution — canonical inbound/contextual discovery for priority pages, descriptive controlled anchors, reciprocal reviewed relations, visible/schema breadcrumbs, data-aware continuation, canonical Share/Copy/Cite and local Save utilities.
7. Deployment lineage — deployed commit, deploy workflow run and the exact ARWP revision.
8. SHA-256 digests for generated ARWP reports where applicable.

The Technical SEO Critic runs against the final generated sitemap cohort before release, then a bounded live check reviews response headers after deployment. Field Core Web Vitals remain owner/provider data: Lighthouse or repository evidence is not silently converted into field performance evidence.

Image Discovery also runs against the final generated artifact after later deploy-time metadata post-processing. Its live check then verifies a bounded representative set of unique bias images, page metadata, preview policy and live image fetchability. Image sitemap/metadata correctness is implementation evidence only; it does not prove Google Images indexing, thumbnail selection, Discover placement or traffic uplift. Discover's current image-size guidance is kept separate from general image Search eligibility.

Internal Discovery & Distribution is applied late in the generated artifact so it can reuse the canonical sitemap, reviewed relations, contexts, comparisons and evidence state that already exist. Bias pages receive canonical utility controls and improved visible/schema breadcrumb convergence. A `Continue from here` block is generated only for a curated priority cohort with real context, comparison, evidence or reviewed-relation data; pages without that evidence keep their existing related-entry navigation instead of receiving the same generic block merely to increase link counts. The build gate checks inbound/contextual discovery for canonical bias/context pages and preserves Share/Save/Cite as user-distribution utilities rather than ranking signals. Preferred Sources remains applicability-gated until availability is verified in Google's source-preferences tool.

These reports are evidence for the observed implementation state, not proof of Search ranking, AI citation, traffic, shares, return visits, learning outcomes or user adoption.

## URL moves

Do not treat a URL rename as finished because the new page renders.

For an intentional rename, consolidation or origin move, add `.arwp/url-migrations.json` with explicit absolute HTTPS `oldUrl` → `newUrl` pairs before the release. The post-deploy workflow detects a non-empty manifest and runs AWRP URL Migration Integrity against the live site and live sitemap.

No manifest is kept for a release with no URL moves. Missing migration evidence must not be converted into a pass.

## Remediation receipts

When a Site Focus finding causes a direct repository patch, a formal Site Focus Remediation Receipt may be created only after:

- the finding was reviewed;
- source checks passed;
- the exact target commit was deployed successfully;
- production Site Focus ran after that deployment;
- before/after diagnostics exist;
- important unmeasured outcomes remain explicit known unknowns.

Do not fabricate a receipt from intent alone, and do not relabel a direct patch as SignalBraid transformation lineage.

## Agent rule

Do not weaken the declared boundary or technical checks merely to make a report green. Review whether a page has a legitimate product, proof, trust or technical-reference role, fix the canonical source or generator, and keep uncertainty visible.

For image work, prefer the source asset mapping and generator over hand-editing `dist/`. Preserve empty alt for decorative imagery, use reviewed visual-specific descriptions only when grounded, and do not add deprecated image sitemap caption/title/license fields as SEO cargo cult.

For internal-discovery work, preserve the reviewed `relations-v2`, context and comparison sources rather than generating arbitrary keyword relationships. Share/Save/Copy/Cite controls must derive from the canonical page URL; local Save must stay local unless a future product explicitly adds authenticated persistence. Do not publish a Google Preferred Sources control merely because the feature exists—verify applicability first.

A clean AWRP/ARWP report means only that the bounded checks did not observe the covered problem. Provider-native owner data and longitudinal evidence are required for outcome claims.
