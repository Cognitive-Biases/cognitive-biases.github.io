# Cognitive Biases

The public website for the Cognitive Biases educational mobile app: [cognitive-biases.github.io](https://cognitive-biases.github.io).

## Local development

```bash
npm install
npm run build
npm run dev
```

`npm run build` creates a complete static site in `dist/`, including one permanent page for every published bias. GitHub Actions builds and deploys that directory to GitHub Pages; no secrets or server runtime are required.

## Content

Bias content is centralized in [`data/biases.json`](data/biases.json), migrated from the existing Cognitive Biases content library. The build derives the catalogue, category pages, individual pages, sitemap, JSON-LD, and navigation from that file.

## Migration

Former MetalHatsCats URLs are redirected permanently to their equivalent pages here. See [`docs/migration-map.md`](docs/migration-map.md).

## License

The original Cognitive Biases website content is licensed under [CC BY-NC-SA 4.0](LICENSE): attribution and the same license are required for sharing or adaptations, and commercial use is not permitted without prior written permission from MetalHatsCats. Cognitive Biases names and logos are not licensed for reuse.
