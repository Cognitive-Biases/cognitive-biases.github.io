const SITE = "https://cognitive-biases.github.io";
const SAMPLE_SLUGS = [
  "cognitive-bias-anchoring-effect",
  "confirmation-bias-congruence-bias",
  "cognitive-bias-sunk-cost-effect"
];
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function fetchOk(url, options = {}) {
  let last;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "follow", ...options });
      if (response.ok) return response;
      last = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      last = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
  }
  throw last || new Error(`Unable to fetch ${url}`);
}

function metaContent(html, key, value) {
  const tag = html.match(new RegExp(`<meta\\b(?=[^>]*\\b${key}=["']${value}["'])[^>]*>`, "i"))?.[0] || "";
  return tag.match(/\bcontent=["']([^"']*)["']/i)?.[1] || "";
}

function hasPrimaryImage(html, expected) {
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const text = JSON.stringify(JSON.parse(match[1]));
      if (text.includes('"primaryImageOfPage"') && text.includes(expected)) return true;
    } catch {
      // Malformed structured data is handled by deterministic repository checks.
    }
  }
  return false;
}

const sitemapResponse = await fetchOk(`${SITE}/sitemap.xml`);
const sitemap = await sitemapResponse.text();
assert(sitemap.includes("http://www.google.com/schemas/sitemap-image/1.1"), "live sitemap is missing the image namespace");
assert(!/<image:(caption|geo_location|title|license)>/i.test(sitemap), "live sitemap contains deprecated image sitemap fields");

for (const slug of SAMPLE_SLUGS) {
  const page = `${SITE}/biases/${slug}/`;
  const image = `${SITE}/assets/editorial/biases/${slug}.webp`;
  assert(sitemap.includes(`<loc>${page}</loc>`) && sitemap.includes(`<image:loc>${image}</image:loc>`), `live sitemap does not expose ${image}`);

  const pageResponse = await fetchOk(page);
  const html = await pageResponse.text();
  assert(metaContent(html, "property", "og:image") === image, `live og:image does not use the unique asset for ${page}`);
  assert(metaContent(html, "name", "twitter:image") === image, `live twitter:image does not align for ${page}`);
  assert(/max-image-preview:large/i.test(html), `live page does not permit large image previews: ${page}`);
  const robots = `${metaContent(html, "name", "robots")},${pageResponse.headers.get("x-robots-tag") || ""}`.toLowerCase();
  assert(!robots.includes("noimageindex"), `live page unexpectedly suppresses image indexing: ${page}`);
  assert(hasPrimaryImage(html, image), `live structured data does not converge on ${image}`);

  const imageResponse = await fetchOk(image, { method: "HEAD" }).catch(() => fetchOk(image));
  const type = (imageResponse.headers.get("content-type") || "").toLowerCase();
  assert(type.startsWith("image/"), `preferred image has unexpected content type ${type || "(missing)"}: ${image}`);
}

console.log(`Live Image Discovery check passed for ${SAMPLE_SLUGS.length} representative unique bias assets: sitemap discovery, preferred-image metadata, preview policy and image fetchability are aligned.`);
