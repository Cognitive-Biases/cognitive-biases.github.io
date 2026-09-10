import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const SITEMAP_PATH = join(OUT, "sitemap.xml");
const UNDATED_STATIC_ROUTES = ["/", "/explore/", "/how-it-works/", "/about/", "/privacy/", "/terms/", "/support/"];

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

let seoChanged = 0;
let brandChanged = 0;
for (const file of await walk(OUT)) {
  let html = await readFile(file, "utf8");
  const before = html;

  if (!html.includes("max-image-preview:large")) {
    const beforeSeo = html;
    html = html.replace(/<meta name="robots" content="([^"]*)">/i, (_match, content) => {
      const directives = content.split(",").map((item) => item.trim()).filter(Boolean);
      if (!directives.includes("max-image-preview:large")) directives.push("max-image-preview:large");
      return `<meta name="robots" content="${directives.join(",")}">`;
    });
    if (html === beforeSeo) html = html.replace("</head>", '<meta name="robots" content="max-image-preview:large"></head>');
    if (html !== beforeSeo) seoChanged += 1;
  }

  const beforeBrand = html;
  html = html
    .replaceAll('<img src="/assets/icon2.png" width="48"', '<img src="/assets/brand.webp" width="48"')
    .replaceAll('<img src="/assets/icon2.png" width="40"', '<img src="/assets/brand.webp" width="40"');
  if (html !== beforeBrand) brandChanged += 1;

  if (html !== before) await writeFile(file, html);
}

let sitemap = await readFile(SITEMAP_PATH, "utf8");
let freshnessChanged = 0;
for (const route of UNDATED_STATIC_ROUTES) {
  const url = `${SITE}${route}`;
  const pattern = new RegExp(`(<url><loc>${escapeRegExp(url)}</loc>)<lastmod>[^<]+</lastmod>(</url>)`, "g");
  const next = sitemap.replace(pattern, "$1$2");
  if (next !== sitemap) {
    sitemap = next;
    freshnessChanged += 1;
  }
}

let biasFreshnessChanged = 0;
sitemap = sitemap.replace(/(<url><loc>https:\/\/cognitive-biases\.github\.io\/biases\/[^<]+<\/loc>)<lastmod>[^<]+<\/lastmod>(<\/url>)/g, (_match, open, close) => {
  biasFreshnessChanged += 1;
  return `${open}${close}`;
});

const remainingSyntheticDates = UNDATED_STATIC_ROUTES.filter((route) => {
  const url = `${SITE}${route}`;
  return new RegExp(`<url><loc>${escapeRegExp(url)}</loc><lastmod>`, "i").test(sitemap);
});
if (remainingSyntheticDates.length) {
  throw new Error(`Sitemap still exposes build-time lastmod for static routes without reliable modification dates: ${remainingSyntheticDates.join(", ")}`);
}
if (/<url><loc>https:\/\/cognitive-biases\.github\.io\/biases\/[^<]+<\/loc><lastmod>/i.test(sitemap)) {
  throw new Error("Sitemap still exposes build-time lastmod for bias pages without per-page modification provenance.");
}
if (freshnessChanged || biasFreshnessChanged) await writeFile(SITEMAP_PATH, sitemap);

console.log(`Late finalizer: SEO metadata updated on ${seoChanged} page(s); optimized brand source repaired on ${brandChanged} page(s); sitemap lastmod removed from ${freshnessChanged} undated static route(s) and ${biasFreshnessChanged} bias page(s) without reliable per-page dates.`);
