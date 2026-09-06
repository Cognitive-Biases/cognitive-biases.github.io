# Search Console appearance probe — 2026-09-06

Scope: authenticated, read-only Google Search Console Search Analytics API probe for `https://cognitive-biases.github.io/`.

## Result

- Window checked: 2026-06-07 through 2026-09-04.
- Web Search exposed the `TRANSLATED_RESULT` search-appearance value.
- Discover exposed no search-appearance value in the checked window.
- No dedicated generative-AI search-appearance value was exposed by this API query.

## Interpretation

This is an API-capability observation, not a traffic conclusion. Absence of a generative-AI search-appearance value must **not** be interpreted as zero AI Overview / AI Mode visibility or citations. The dedicated Google generative-AI performance surface remains separate owner-side evidence; ordinary Search Analytics cannot substitute for it or justify guessing an undocumented `searchAppearance` enum.

The current ARWP owner-data contract therefore keeps the remaining authenticated gates explicit instead of turning them into code tasks:

- Google Generative AI performance: authenticated report/export (`ui-export`).
- Bing AI Performance: authenticated report/export (`ui-export`).
- Google Generative AI inclusion setting: authenticated Search Console setting (`ui`).

Google platform properties and Preferred Sources are conditional opportunities, not active defects for this site.

The probe does not publish query strings, page-level Search Console data, clicks, impressions, account identifiers, credentials, or the raw owner report.

Evidence source: GitHub Actions workflow `Google Search Pipeline`, run `34031806783`, artifact `google-search-appearance-probe`. ARWP owner-gate contract revision: `46e7cd6260482945e3eec5838baf4c8abbaf1a6b`.
