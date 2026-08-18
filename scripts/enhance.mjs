import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const biases = JSON.parse(await readFile("data/biases.json", "utf8"))
  .filter((bias) => bias.published)
  .sort((a, b) => a.title.localeCompare(b.title));

const categories = [...new Set(biases.map((bias) => bias.typeOfBias))].sort();
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
})[character]);
const escapeXml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
})[character]);
const categorySlug = (value = "") => String(value)
  .normalize("NFKD")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "") || "other";

async function replaceFile(path, transform) {
  const fullPath = join(OUT, path);
  const source = await readFile(fullPath, "utf8");
  const next = transform(source);
  if (next !== source) await writeFile(fullPath, next);
}

// Give every category a stable, crawlable fragment and repair bias-page breadcrumbs.
await replaceFile("explore/index.html", (source) => {
  let html = source;
  for (const category of categories) {
    const heading = `<section class="category"><h2>${escapeHtml(category)}</h2>`;
    const anchored = `<section class="category" id="${categorySlug(category)}"><h2>${escapeHtml(category)}</h2>`;
    html = html.replace(heading, anchored);
  }

  const definedTermSet = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": `${SITE}/explore/#bias-library`,
    name: "Cognitive Biases library",
    url: `${SITE}/explore/`,
    description: "A browsable educational collection of cognitive biases, effects, heuristics, and related thinking patterns.",
  };
  const script = `<script type="application/ld+json">${JSON.stringify(definedTermSet)}</script>`;
  if (!html.includes(`${SITE}/explore/#bias-library`)) html = html.replace("</head>", `${script}</head>`);
  return html;
});

for (const bias of biases) {
  const path = join("biases", bias.slug, "index.html");
  await replaceFile(path, (source) => source.replace(
    `href="/explore/#${encodeURIComponent(bias.typeOfBias)}"`,
    `href="/explore/#${categorySlug(bias.typeOfBias)}"`,
  ));
}

// Use record-level update dates instead of pretending every page changed on every build.
const staticPaths = ["/", "/explore/", "/how-it-works/", "/about/", "/privacy/", "/terms/", "/support/"];
const sitemapEntries = [
  ...staticPaths.map((path) => ({ path })),
  ...biases.map((bias) => ({
    path: `/biases/${bias.slug}/`,
    lastmod: /^\d{4}-\d{2}-\d{2}/.test(bias.updatedAt || "") ? bias.updatedAt.slice(0, 10) : undefined,
  })),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.map(({ path, lastmod }) => `  <url><loc>${escapeXml(`${SITE}${path}`)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>\n`;
await mkdir(dirname(join(OUT, "sitemap.xml")), { recursive: true });
await writeFile(join(OUT, "sitemap.xml"), sitemap);

console.log(`Enhanced ${biases.length} bias pages, ${categories.length} category anchors, structured data, and sitemap metadata.`);
