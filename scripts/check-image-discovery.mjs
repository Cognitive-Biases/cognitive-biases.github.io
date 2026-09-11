import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const IMAGE_NS = "http://www.google.com/schemas/sitemap-image/1.1";
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((record) => record.published);
const duplicates = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const metadata = JSON.parse(await readFile("data/image-metadata.json", "utf8"));
const discovery = JSON.parse(await readFile(join(OUT, "data", "image-discovery.json"), "utf8"));
const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const canonicalBiases = biases.filter((record) => !duplicateIds.has(record.id));

assert(sitemap.includes(`xmlns:image="${IMAGE_NS}"`), "sitemap is missing the Google image namespace");
assert(!/<image:(caption|geo_location|title|license)>/i.test(sitemap), "sitemap contains deprecated Google image sitemap fields");

const urlBlocks = new Map();
for (const match of sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
  const loc = match[1].match(/<loc>([^<]+)<\/loc>/)?.[1];
  if (loc) urlBlocks.set(loc, match[1]);
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

function metaContent(html, key, value) {
  const tag = html.match(new RegExp(`<meta\\b(?=[^>]*\\b${key}=["']${value}["'])[^>]*>`, "i"))?.[0] || "";
  return tag.match(/\bcontent=["']([^"']*)["']/i)?.[1] || "";
}

function walk(value, visitor) {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visitor);
    return;
  }
  if (!value || typeof value !== "object") return;
  visitor(value);
  for (const child of Object.values(value)) walk(child, visitor);
}

function primaryImages(html) {
  const urls = [];
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1]);
      walk(parsed, (node) => {
        const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]].filter(Boolean);
        if (!types.includes("WebPage")) return;
        const image = node.primaryImageOfPage;
        const url = typeof image === "string" ? image : image?.contentUrl || image?.url;
        if (url) urls.push(url);
      });
    } catch {
      // Other checks own malformed JSON-LD. This gate only evaluates parseable image declarations.
    }
  }
  return urls;
}

assert(discovery.version === "0.1", "image discovery manifest version must remain 0.1");
assert(discovery.site === `${SITE}/`, "image discovery manifest must bind to the canonical site");
assert(discovery.records?.length === canonicalBiases.length, "image discovery manifest coverage does not match the canonical bias cohort");
const recordByPage = new Map((discovery.records || []).map((record) => [record.page, record]));

let curated = 0;
let unique = 0;
let fallbacks = 0;
for (const bias of canonicalBiases) {
  const page = `${SITE}/biases/${bias.slug}/`;
  const record = recordByPage.get(page);
  assert(record, `image discovery manifest is missing ${page}`);
  const image = record.image;
  const block = urlBlocks.get(page);
  assert(block, `canonical bias is missing from sitemap: ${page}`);
  assert(block.includes(`<image:image><image:loc>${image}</image:loc></image:image>`), `sitemap image entry is missing or wrong for ${page}`);

  const uniqueLocal = join(OUT, "assets", "editorial", "biases", `${bias.slug}.webp`);
  const hasUniqueImage = await exists(uniqueLocal);
  if (hasUniqueImage) {
    unique += 1;
    assert(image === `${SITE}/assets/editorial/biases/${bias.slug}.webp`, `unique bias art is not the preferred image for ${page}`);
    assert(record.imageSource === "unique-bias", `image source classification is wrong for ${page}`);
  } else {
    fallbacks += 1;
    assert(image.startsWith(`${SITE}/assets/editorial/families/`), `missing unique art must resolve to a semantic family image for ${page}`);
    assert(record.imageSource === "semantic-family-fallback", `fallback image source classification is wrong for ${page}`);
  }

  const imageUrl = new URL(image);
  assert(imageUrl.origin === SITE && imageUrl.pathname.startsWith("/assets/editorial/"), `unexpected preferred image URL for ${page}: ${image}`);
  await access(join(OUT, imageUrl.pathname.replace(/^\//, "")));

  const html = await readFile(join(OUT, "biases", bias.slug, "index.html"), "utf8");
  assert(metaContent(html, "property", "og:image") === image, `og:image does not match the preferred editorial asset for ${page}`);
  assert(metaContent(html, "name", "twitter:image") === image, `twitter:image does not align with og:image for ${page}`);
  assert(/max-image-preview:large/i.test(html), `large image previews are not permitted on ${page}`);
  assert(!/\bnoimageindex\b/i.test(metaContent(html, "name", "robots")), `noimageindex unexpectedly suppresses ${page}`);
  assert(primaryImages(html).includes(image), `WebPage.primaryImageOfPage does not converge with og:image for ${page}`);

  const alt = html.match(/<figure class="article-visual"><img\b[^>]*\balt="([^"]*)"/i)?.[1] || "";
  assert(alt.trim().length >= 8, `informative editorial image has weak/empty alt text for ${page}`);
  assert(record.alt === alt, `image discovery manifest alt does not match the final HTML for ${page}`);
  const curatedEntry = metadata.entries?.[bias.slug];
  if (curatedEntry?.reviewed) {
    curated += 1;
    assert(alt === curatedEntry.alt, `curated image description was not applied for ${page}`);
    assert(record.altSource === "curated", `curated alt source classification is wrong for ${page}`);
  }
}

for (const record of discovery.records || []) {
  assert(record.page.startsWith(`${SITE}/biases/`), `unexpected image discovery page: ${record.page}`);
  assert(record.image.startsWith(`${SITE}/assets/editorial/`), `unexpected preferred image origin/path: ${record.image}`);
  assert(["unique-bias", "semantic-family-fallback"].includes(record.imageSource), `unexpected image source classification for ${record.page}`);
  assert(record.alt?.trim(), `image discovery manifest has empty alt for ${record.page}`);
}

const allImageLocs = [...sitemap.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map((match) => match[1]);
assert(allImageLocs.length >= canonicalBiases.length, "sitemap image coverage is smaller than the canonical bias cohort");
for (const image of allImageLocs) {
  const url = new URL(image);
  assert(url.origin === SITE, `image sitemap URL uses an unexpected origin: ${image}`);
  await access(join(OUT, url.pathname.replace(/^\//, "")));
}

console.log(`Image Discovery check passed: ${canonicalBiases.length} canonical bias pages expose crawlable image sitemap entries and converged og/schema preferred-image signals (${unique} unique bias assets, ${fallbacks} semantic family fallback(s)); ${curated} visual descriptions are explicitly reviewed. Discover's 1200px guidance remains a separate WATCH/optimization concern, not an indexing failure.`);
