# Editorial image prompt set

Mode: built-in ImageGen. Use case: `stylized-concept`. Each output is a 4:3 cognitive-bias article cover.

## Shared art direction

Electric editorial collage with torn paper, risograph grain, tactile print texture, one surreal 3D centerpiece, neon accents, and a deep cobalt field. Palette: cobalt, midnight blue, acid yellow, hot pink, coral, cyan, and paper cream. Use a full-bleed 4:3 composition with a strong centered silhouette and depth. Do not include words, letters, numbers, logos, watermarks, UI, or borders.

## Family subjects

- `memory-retrieval`: a translucent head made from photographic fragments; memories drift out and reassemble incorrectly.
- `belief-updating`: opposing lenses filter mixed evidence, saturating matches and bending contradictions away.
- `probability-risk`: a roulette world under storm clouds with oversized dice and small islands of certainty.
- `attention-information`: one object is caught by a huge spotlight while equally important objects disappear into darkness.
- `perception-patterns`: random dots and paper scraps become a face and constellation through a neon magnifying lens.
- `valuation-choice`: a neon balance holds a glowing prize against a loss-shaped void while surrounding options change scale.
- `reasoning-flexibility`: a rigid chrome maze turns into a fluid ribbon while a familiar tool remains trapped in glass.
- `self-metacognition`: one figure examines several mirrors that return conflicting levels of confidence.
- `social-judgment`: a crowd pulls a bright central figure through overlapping speech and projection beams.
- `time-commitment`: an impossible staircase loops through accumulating coins and calendar pages beside an open exit.
- `future-state-forecasting`: a present self looks through a portal at contradictory future selves and emotional weather.
- `retrospective-evaluation`: a rear-view mirror makes an uncertain road appear straight after the outcome is known.
- `measurement-methods`: transparent measuring instruments produce different versions of the same changing object.
- `goals-proxies-incentives`: a giant target pulls people away from a small living tree representing the real goal.
- `past-present-comparison`: a nostalgic past and electric present sit on a warped balance under a selective memory lens.

The family masters remain as a fallback for future records while they await bespoke art.

## Unique bias-image production prompt

All 219 published entries now have an independently generated image at `public/assets/editorial/biases/{slug}.webp`. Each file was created with a separate built-in ImageGen call using the title and the first concise portion of the entry description.

```text
Use case: stylized-concept
Asset type: unique 4:3 cognitive-bias article illustration
Input image: hero-collage.webp as a style reference only
Primary request: create one concrete, memorable visual metaphor for the supplied cognitive pattern. Make the focal objects and scene specific to this concept, not a generic psychology illustration.
Style/medium: premium electric editorial collage matching the reference—deep cobalt paper, torn cream graph paper, tactile halftone ink, cut-paper edges, photoreal or sculptural focal object, neon cyan/magenta/coral/yellow accents
Composition/framing: landscape 4:3, strong central silhouette, readable at thumbnail size, safe margins
Constraints: visually distinct; no cat; no brain icon; no text, letters, labels, numbers, logos, watermark, UI or outer border
Concept: {record.title}
Meaning: {first concise portion of record.description}
```

The build prefers the slug-specific asset and falls back to its semantic family only for a future record without bespoke art. The auditable result is published at `dist/data/editorial-art-map.json`.

## Product hub illustrations

Twenty-one major product hubs and three interactive tools also receive route-specific illustrations in `public/assets/editorial/pages/`. Legal and utility pages intentionally stay text-led when decorative art would not improve comprehension.
