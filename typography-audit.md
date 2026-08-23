# Typography and readability audit

## Audit scope

Rendered audit of the homepage, product hubs, guides, evidence, about, research, a long bias article, Decision Audit, Everyday guide, Experiment, and legal page. Desktop was checked at 1440 × 1000; mobile at 390 × 844. Generated output was also audited across all 366 HTML pages.

User goal: headings should keep the bold editorial character of the supplied reference without dominating the page, breaking long titles, or making mobile use difficult.

## Outcome

- Display family changed from Archivo Black to Inter Tight 800–900.
- Internal page `h1` reduced from 86.4px to about 60–63px at 1440px.
- Internal mobile `h1` now resolve to 39px at 390px.
- Homepage `h1` reduced from about 156px to 132px desktop and 70px mobile.
- Everyday and Experiment templates now use the same heading tokens instead of their separate 86.4px rule.
- All audited pages have zero horizontal overflow.
- All 366 generated HTML files contain exactly one non-empty `h1` and no inline heading-size overrides.

## Steps and evidence

### 1. Homepage — healthy

- Desktop: `typography-audit/01-home-final.png`
- Mobile: `typography-audit/09-home-mobile.png`
- The homepage remains poster-like, but the title no longer crowds the cat or CTAs. Decorative crops that interfered with the smaller live heading were removed or narrowed.

### 2. Product hubs and long page heroes — healthy

- Explore: `typography-audit/02-explore-after.png`
- Guides: `typography-audit/03-guides-after.png`
- Evidence: `typography-audit/04-evidence-after.png`
- About: `typography-audit/05-about-after.png`
- Research: `typography-audit/08-research-after.png`
- Page-hero headings reduced from 86.4px and 3–5 lines to about 60.5px and 2–3 lines. Images and descriptive copy now enter the first viewport sooner.

### 3. Bias article — healthy

- Desktop: `typography-audit/06-article-after.png`
- Mobile: `typography-audit/11-article-mobile.png`
- The 76-character Anchoring title fell from 331.8px to 190.1px high on desktop. On mobile it is 39px with a 1.02 line height and no horizontal overflow.

### 4. Interactive tool — healthy

- Desktop: `typography-audit/07-decision-tool-after.png`
- Mobile: `typography-audit/13-tool-mobile.png`
- The task description, privacy notice, and first visual now appear earlier. The title remains clearly dominant without occupying most of the screen.

### 5. Alternate article templates — healthy after fix

- Everyday desktop: `typography-audit/14-everyday-after.png`
- Everyday mobile: `typography-audit/14-everyday-mobile.png`
- Experiment desktop: `typography-audit/15-experiment-after.png`
- Experiment mobile: `typography-audit/15-experiment-mobile.png`
- These templates initially escaped the shared heading selector and still rendered at 86.4px. They now use Inter Tight 900 at about 63px desktop and 39px mobile.

## UX and accessibility notes

Strengths:

- The new family keeps the broad, heavy grotesk silhouette of the reference while giving long lowercase titles more regular rhythm.
- Heading line height is near 1, wrapping is balanced, and `overflow-wrap` remains available for long translated words.
- Mobile navigation opens inside the viewport, reports `aria-expanded=true`, and creates zero horizontal overflow.
- A fresh browser pass reported no console errors.

Remaining limits:

- Screenshots and computed styles do not prove full WCAG compliance or screen-reader pronunciation across every future language.
- Russian and German production translations are not present yet, so their exact line breaks could not be rendered. The shared scale, maximum widths, logical layout, and overflow handling are prepared for them.

## Validation

- `npm run build:site`: passed.
- `node scripts/check.mjs`: passed.
- `npm run check:editorial-art`: passed; 219/219 published bias images remain unique.
- Generated heading audit: 366 HTML pages, 0 missing `h1`, 0 multiple `h1`, 0 empty `h1`, and 0 inline heading-style overrides.
