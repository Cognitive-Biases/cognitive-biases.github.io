# Cognitive Biases — non-commodity content review

Reviewed: 2026-09-06  
Scope: priority Search / generative-search / citation surfaces  
Decision: `keep`

This is the manual editorial judgment required by the ARWP `growth:non-commodity-review` action. It is not an automated quality score and it does not claim ranking or citation gains.

## Review criteria

Priority pages should add at least one of the following beyond a generic definition: reviewed evidence, original synthesis, decision context, comparison, reproducible data, research method/result, or a concrete practice workflow. Material factual claims should remain traceable to sources or an explicit project-status label. Pages should route users to stronger evidence rather than multiplying thin query variants.

## Priority surfaces

| Surface | Why it is non-commodity | Decision | Guardrail |
| --- | --- | --- | --- |
| `/` | Routes into a maintained knowledge system rather than a single SEO landing page: concepts, decision use, research/data and the product surface coexist under one canonical entity. | keep | Homepage copy should stay concise and route to stronger evidence instead of accumulating generic keyword sections. |
| `/explore/` | Canonical concept library with duplicate handling, stable taxonomy/family navigation and machine-readable term semantics. | keep | Do not create near-duplicate keyword variants of concept pages. |
| `/evidence/` | Exposes reviewed evidence state, sources and limitations rather than presenting every legacy explanation as equally established. | keep | Review status and source provenance must remain visible. |
| `/research/` | Publishes project research notes, protocols, benchmark methods and monthly evidence deltas with explicit maturity. | keep | Distinguish project interpretation from established findings and preserve negative/null results. |
| `/contexts/` | Starts from real decision situations and routes to a bounded set of relevant lenses instead of requiring the reader to guess a bias label. | keep | Situation-first routing must not become a thin query-page factory. |
| `/compare/` | Resolves commonly confused concepts with reviewed distinctions and direct routing to canonical concepts. | keep | Comparisons need a real conceptual distinction, not title-level keyword substitution. |
| `/data/` | Provides versioned machine-readable releases, provenance and distributions that can be reused and checked independently of prose pages. | keep | Dataset metadata must reflect actual release state and licence boundaries. |
| `/about/editorial/` | Makes maintainer identity, review semantics, automation boundaries, corrections and third-party editorial policy explicit. | keep | Trust language must describe process, not imply certification or scientific authority. |

## Findings

The strongest growth surface is the combination of reviewed evidence + situation-first decision routes + original research/data. That combination is harder to commoditize than generic “what is bias X?” copy and should remain the center of future expansion.

The current library already has enough route breadth. The next content iteration should deepen evidence, examples, comparison quality and original research before adding new landing-page families. New pages should be rejected when their only distinction is a query wording change.

## Re-review trigger

Repeat this review when a new page family, partner/contributor section, commercialization layer, or large generated-content expansion is introduced. Search/AI performance changes alone are not sufficient reason to weaken the editorial criteria above.
