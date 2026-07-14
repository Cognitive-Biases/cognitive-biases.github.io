# MetalHatsCats migration map

| Former URL | New URL | Method |
| --- | --- | --- |
| `https://metalhatscats.com/cognitive-biases` | `https://cognitive-biases.github.io/explore/` | Vercel permanent redirect (308) |
| `https://metalhatscats.com/cognitive-biases/{bias-slug}` | `https://cognitive-biases.github.io/biases/{bias-slug}/` | Vercel permanent redirect (308), preserving the slug |
| `https://metalhatscats.com/cognitivebiases/{bias-slug}` | `https://cognitive-biases.github.io/biases/{bias-slug}/` | Vercel permanent redirect (308), preserving the slug |
| `https://metalhatscats.com/products/cognitive-biases` | `https://cognitive-biases.github.io/` | Vercel permanent redirect (308) |
| `https://metalhatscats.com/products/cognitive-biases/privacy` | `https://cognitive-biases.github.io/privacy/` | Vercel permanent redirect (308) |
| `https://metalhatscats.com/products/cognitive-biases/terms` | `https://cognitive-biases.github.io/terms/` | Vercel permanent redirect (308) |
| `https://metalhatscats.com/apps/cognitive-bias-explorer` | `https://cognitive-biases.github.io/explore/` | Vercel permanent redirect (308) |

The new site uses static canonical URLs with trailing slashes. The old Vercel routes redirect directly to those canonical destinations without chains.
