# Design QA — Homepage screenshot match

## Comparison target

- Source visual truth: `/private/var/folders/7l/0b29717566jghtwgm8kj7gww0000gn/T/codex-clipboard-1661b504-1d25-47d3-a106-ba8a49f562c9.png`
- Browser-rendered implementation: `/Users/dzmitryikharlanau/.codex/visualizations/2026/08/22/01a02a38-4b19-75a3-bb9b-b73fd1ee1bab/home-exact-final.png`
- Combined full-view comparison: `/Users/dzmitryikharlanau/.codex/visualizations/2026/08/22/01a02a38-4b19-75a3-bb9b-b73fd1ee1bab/home-exact-final-comparison.png`
- Focused title comparison: `/Users/dzmitryikharlanau/.codex/visualizations/2026/08/22/01a02a38-4b19-75a3-bb9b-b73fd1ee1bab/home-exact-focus-title.png`
- Mobile evidence: `/Users/dzmitryikharlanau/.codex/visualizations/2026/08/22/01a02a38-4b19-75a3-bb9b-b73fd1ee1bab/home-exact-final-mobile.png`
- Local URL: `http://127.0.0.1:4173/`
- State: English homepage at scroll position 0; desktop navigation closed; mobile menu tested open and closed.
- Requested CSS viewport: 1488 × 1059 at device scale 1. Browser content capture: 1473 × 1048 pixels because browser chrome and scrollbar are excluded.
- Source pixels: 1487 × 1058. The implementation was normalized to 1488 × 1058 for the combined comparison. No density-only mismatch was filed.

## Full-view comparison evidence

The source and implementation were placed in one side-by-side image. Both show the same first-view composition: transparent navigation inside a cobalt hero, staggered four-line white headline, yellow quote, cat collage, filter diagram, paper notes, two CTAs, and three illustrated bias panels starting at the same vertical boundary. The three lower panels use source-derived discrete raster assets but remain separate semantic links.

## Focused region evidence

The focused title comparison covers the headline, handwritten underline, technical notes, subtitle, and CTAs at equal scale. It verifies the staggered line indents, display weight, line height, button positions, and live copy. The implementation keeps the headline and controls as HTML for accessibility and future localization; the paper notes and decorative marks remain raster artwork as in the source.

## Required fidelity surfaces

- Fonts and typography: Archivo Black closely matches the dense display face; DM Sans covers navigation and UI. The four title lines use source-matched indentation, size, line height, and optical width. Copy remains selectable and localizable.
- Spacing and layout rhythm: logo, navigation, headline, cat, notes, CTAs, hero boundary, and three card tracks align with the source at the target viewport. Mobile has zero horizontal overflow.
- Colors and tokens: deep cobalt, paper white, yellow, cyan, pink, coral, and electric blue match the source hierarchy and keep readable contrast.
- Image quality and asset fidelity: the cat, quote, diagrams, paper notes, underline, and three bias cards are discrete high-quality raster assets derived from the supplied visual. No CSS drawings, emoji, placeholder shapes, or improvised SVGs replace source artwork.
- Copy and content: headline, subtitle, button labels, navigation labels, and destinations match the source. Semantic names are present on all three bias cards.
- Accessibility and behavior: the H1 reads “Your brain edits reality.” with spaces, navigation and CTAs are real links, the mobile drawer reports `aria-expanded`, Escape/outside-click behavior remains wired, and decorative art is hidden from assistive technology.

## Comparison history

### Iteration 1

- [P1] The original implementation used a separate dark sticky bar, a three-line heading, a taller hero, and generic cards.
  - Fix: introduced a homepage-only transparent header, four staggered title lines, exact hero height, reference-matched decorative assets, and three source-matched linked panels.
  - Post-fix evidence: `home-exact-pass1-top.png`.

### Iteration 2

- [P2] All heading lines shared one left edge; subtitle and CTAs did not align with the source; the search icon retained a dark rectangular background.
  - Fix: added per-line optical offsets and width tuning, aligned lower copy to the fourth line, and keyed the search icon background to transparency.
  - Post-fix evidence: `home-exact-pass2.png`.

### Iteration 3

- [P2] The source's pink underline and lower-left technical notes were missing; the primary CTA wrapped at the normalized comparison size.
  - Fix: added discrete underline and note assets and tightened CTA typography and spacing.
  - Post-fix evidence: `home-exact-final-comparison.png` and `home-exact-focus-title.png`.

### Iteration 4

- [P1] Re-running the theme generator duplicated the menu bootstrap and caused a browser syntax error; transforming the whole navigation also moved the fixed mobile drawer off-canvas.
  - Fix: made menu injection idempotent and moved the optical navigation offset to the desktop core links only.
  - Post-fix evidence: a fresh browser tab reported zero console errors; the 390 × 844 mobile state measured zero horizontal overflow, and the open drawer occupied x=16…374.

## Primary interactions tested

- Mobile menu opened with `aria-expanded=true`, closed correctly, and introduced zero horizontal overflow.
- “Browse the visual atlas” navigated to `/explore/` and browser back returned to the homepage.
- Both hero CTAs, five desktop navigation links, and all three bias-card destinations were verified in the rendered DOM.
- Fresh browser tab console: 0 warnings and 0 errors.
- `npm run build:site`: passed.
- `npm run check:editorial-art`: passed, 219/219 unique published bias images with zero duplicate hashes.
- `node scripts/check.mjs`: passed, 219 bias pages and all static metadata verified.

## Follow-up polish

- [P3] The live Archivo Black headline is cleaner than the paper-grain texture baked into the supplied raster reference. This is intentional so the title remains accessible, selectable, and translation-ready.

## Final result

final result: passed
