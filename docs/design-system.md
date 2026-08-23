# Electric Editorial Collage design system

The site uses an editorial collage language: saturated cobalt and ultraviolet fields, torn-paper imagery, halftone texture, vivid yellow/cyan/pink accents, strong typography, and the Cognitive Biases cat as the host.

## Principles

- Keep the content readable first. Images carry mood and metaphor; factual labels and navigation remain live HTML.
- Show uncertainty. Bright color is for orientation and energy, not for inventing confidence.
- Use one dominant visual per hero or story group. Avoid decorating every surface.
- Prefer spacing, type, and solid color over nested cards.
- Keep actions rectangular, high contrast, and plainly labeled.

## Tokens

- Deep ink: `#09094a`
- Cobalt: `#1515a8`
- Paper: `#fff8ea`
- Yellow: `#ffd900`
- Pink: `#ff2a9b`
- Coral: `#ff554d`
- Cyan: `#16d8e6`
- Violet: `#6827d9`
- Display type: Inter Tight, 800–900. Its broad, heavy grotesk shapes keep the energy of the selected visual reference while remaining readable in long titles and future translations.
- Body and interface type: DM Sans, 400–800. It keeps navigation, cards, and long-form reading calm and highly legible beside the expressive display face.

## Heading scale

- Homepage `h1`: up to 132px on desktop and about 70px on a 390px mobile viewport. It is the only intentionally poster-scale heading.
- Page-hero `h1`: 44–72px on desktop and 38–51px on mobile.
- Article, Everyday, and Experiment `h1`: 40–76px on desktop and 36–51px on mobile.
- Long headings use balanced wrapping, a readable line height near `1`, and no fixed height. At 390px, all audited heading templates fit without horizontal overflow.

## Internationalization rules

- Do not bake required copy into images.
- Let headings wrap and balance; never set a fixed height for translated text.
- Use logical properties for layout and spacing.
- Keep cards content-driven so new entries can be added without manual row sizing.
- German and Russian headings may be longer; responsive type and `overflow-wrap` are part of the shared theme.

## Editorial assets

- `hero-collage.webp`: homepage brand world with a quiet area for live copy.
- `anchoring.webp`: first-value / anchoring metaphor.
- `confirmation.webp`: selective-evidence lens metaphor.
- `sunk-cost.webp`: looping commitment metaphor.
- `evidence.webp`: evidence sorting, comparison, and uncertainty metaphor.

Fifteen mechanism-family masters live under `public/assets/editorial/families/`. Every published bias is mapped through `data/taxonomy-v2.json`, with keyword inference only for intentionally unassigned records. This keeps imagery conceptually relevant while allowing new cards and translations to inherit a stable visual language automatically.

The final build step applies the shared header, footer, page visuals, article visuals, responsive navigation, search behavior, and theme CSS to every generated HTML page.
