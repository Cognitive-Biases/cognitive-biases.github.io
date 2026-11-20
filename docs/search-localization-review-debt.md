# Search/localization manual verification — evidence boundary (2026-11-07)

Two items in data/search-localization-debt.json have remained due since 2026-11-04. Neither is closed by this change; no reviewBy value or manual-verification state is modified.

## What was observed

| Obligation | Available evidence | Not established |
| --- | --- | --- |
| Search Console / Generative AI | PR #191 records an owner-facing report and inclusion-control check on 2026-10-28. The observations/export are private, so the repository only has the author's bounded attestation. The 2026-09-06 Search Analytics API probe did not expose a dedicated Generative AI search-appearance value. Google Search Pipeline #42223798746 succeeded on 2026-11-06, but ordinary indexing/appearance reports do not substitute for the owner-only report or inclusion setting. | Current authenticated Generative AI report/export, current inclusion setting, or search outcomes. |
| Browser / accessibility | PR #191 records an October 28 non-pinned representative audit and a cramped German mobile header. Later pinned Playwright 1.55.0 production Chromium workflow #41642640473 (2026-11-03; SHA 6ea30b4) checked en/de/ru/fr/pt-BR/es/it at 320/375/430/768/1366px. Its calibrated gate found 0 blocking high/critical, 4108 advisory highs and 0 medium/low. PR workflow #41846786335 (2026-11-04) found 0 blocking highs and 2632 advisory highs on its separate local PR artifact. | Exact 390px viewport, a reviewed resolution of the DE mobile-header complaint and advisory classifications, current production behavior after the failed 2026-11-06 Pages run. PR results are not production proof. |

Sources:
- https://github.com/Cognitive-Biases/cognitive-biases.github.io/pull/191
- https://github.com/Cognitive-Biases/cognitive-biases.github.io/blob/main/docs/growth-evidence/2026-09-06-search-appearance-probe.md
- https://github.com/Cognitive-Biases/cognitive-biases.github.io/actions/runs/42223798746
- https://github.com/Cognitive-Biases/cognitive-biases.github.io/actions/runs/41642640473
- https://github.com/Cognitive-Biases/cognitive-biases.github.io/actions/runs/41846786335
- https://github.com/Cognitive-Biases/cognitive-biases.github.io/actions/runs/42223889390

## Actions required to close, not merely postpone

1. **Owner-only Google review:** In the authenticated Search Console UI for the verified site, recheck the dedicated Generative AI performance surface and inclusion control. Preserve a dated private receipt with observed state, report coverage and limitations. Do not publish personal queries, credentials, page-level private export or inferred zero impressions. API Search Analytics success is insufficient.
2. **Rendered-browser review:** Reuse the pinned Localization Browser Verification workflow and its screenshot/DOM/ARIA/AX-tree artifacts. Reproduce and evaluate the German mobile header, inspect the calibrated advisory categories, test around 390px specifically and verify keyboard/focus/accessible names. Record the exact tested SHA and viewport matrix. Do not treat a successful PR-local audit as a deployed production audit.
3. **Evidence-backed debt update:** Only after the relevant actual review, record its date, evidence location (private for owner data), findings, remaining gaps and a justified new review deadline. Keep an item open if the wider matrix or owner surface is still unconfirmed.

## CI separation

- The Pages Search/localization gate still validates source policy, debt schema/required entries, locale eligibility, final HTML hreflang and sitemap. It writes warnings and an Actions job summary for overdue manual items but does not fail a release solely because an owner/browser review deadline elapsed.
- The independent weekly/manual Search Localization Manual Review Debt workflow fails while reviews are overdue. It has read-only permissions and no Pages upload/deploy step. Red review governance is intentional; it is not evidence of a broken site.
- Regression tests verify that expiry remains reported, deadlines are not mutated, fake closure is rejected and malformed/omitted obligations still fail. These tests do not simulate owner access or replace Chromium.

Images returning 404 through the separate Vedokrok delivery route are a distinct incident. This review-debt change neither diagnoses nor fixes that delivery problem.
