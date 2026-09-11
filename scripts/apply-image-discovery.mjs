import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const IMAGE_NS = "http://www.google.com/schemas/sitemap-image/1.1";
const metadata = JSON.parse(await readFile("data/image-metadata.json", "utf8"));
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((record) => record.published);
const duplicates = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const canonicalBiases = biases.filter((record) => !duplicateIds.has(record.id));

const escapeAttr = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

const absoluteImage = (slug) => `${SITE}/assets/editorial/biases/${slug}.webp`;
const pageUrl = (slug) => `${SITE}/biases/${slug}/`;
const pageFile = (slug) => join(OUT, "biases", slug, "index.html");

function setMeta(html, key, value, content) {
  const pattern = new RegExp(`<meta\\b(?=[^>]*\\b${key}=["']${value}["'])[^>]*>`, "i");
  const replacement = `<meta ${key}="${value}" content="${escapeAttr(content)}">`;
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace("</head>", `${replacement}</head>`);
}

function imageObject(url) {
  return {
    "@type": "ImageObject",
    "@id": `${url}#primary`,
    url,
    contentUrl: url
  };
}

function typeIncludes(node, type) {
  const types = Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]].filter(Boolean);
  return types.includes(type);
}

function addPrimaryImage(value, url) {
  if (Array.isArray(value)) return value.map((item) => addPrimaryImage(item, url));
  if (!value || typeof value !== "object") return value;
  if (typeIncludes(value, "WebPage")) value.primaryImageOfPage = imageObject(url);
  for (const [key, child] of Object.entries(value)) {
    if (key === "primaryImageOfPage") continue;
    value[key] = addPrimaryImage(child, url);
  }
  return value;
}

function alignStructuredData(html, url) {
  return html.replace(/(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi, (whole, open, json, close) => {
    try {
      const parsed = JSON.parse(json);
      return `${open}${JSON.stringify(addPrimaryImage(parsed, url))}${close}`;
    } catch {
      return whole;
    }
  });
}

function applyCuratedAlt(html, slug) {
  const alt = metadata.entries?.[slug]?.reviewed ? metadata.entries[slug].alt : null;
  if (!alt) return html;
  return html.replace(
    /(<figure class="article-visual"><img\b[^>]*\balt=")[^"]*(")/i,
    `$1${escapeAttr(alt)}$2`
  );
}

const records = [];
for (const bias of canonicalBiases) {
  const file = pageFile(bias.slug);
  const image = absoluteImage(bias.slug);
  await Promise.all([
    access(file),
    access(join(OUT, "assets", "editorial", "biases", `${bias.slug}.webp`))
  ]);

  let html = await readFile(file, "utf8");
  html = setMeta(html, "property", "og:image", image);
  html = setMeta(html, "name", "twitter:image", image);
  html = alignStructuredData(html, image);
  html = applyCuratedAlt(html, bias.slug);
  await writeFile(file, html);

  const altMatch = html.match(/<figure class="article-visual"><img\b[^>]*\balt="([^"]*)"/i);
  records.push({
    page: pageUrl(bias.slug),
    image,
    alt: altMatch?.[1] || "",
    altSource: metadata.entries?.[bias.slug]?.reviewed ? "curated" : "generator-fallback"
  });
}

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
if (!sitemap.includes(`xmlns:image="${IMAGE_NS}"`)) {
  sitemap = sitemap.replace(/<urlset\b([^>]*)>/, `<urlset$1 xmlns:image="${IMAGE_NS}">`);
}
const imageByPage = new Map(records.map((record) => [record.page, record.image]));
sitemap = sitemap.replace(/<url>([\s\S]*?)<\/url>/g, (whole, inner) => {
  const loc = inner.match(/<loc>([^<]+)<\/loc>/)?.[1];
  const image = imageByPage.get(loc);
  if (!image) return whole;
  const cleaned = inner.replace(/<image:image>[\s\S]*?<\/image:image>/g, "");
  return `<url>${cleaned}<image:image><image:loc>${image}</image:loc></image:image></url>`;
});
await writeFile(sitemapPath, sitemap);

await writeFile(join(OUT, "data", "image-discovery.json"), `${JSON.stringify({
  version: "0.1",
  site: `${SITE}/`,
  scope: "canonical bias pages with unique editorial assets",
  records
}, null, 2)}\n`);

console.log(`Image Discovery applied to ${records.length} canonical bias pages; ${records.filter((record) => record.altSource === "curated").length} image descriptions use reviewed visual-specific metadata.`);
