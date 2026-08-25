import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const source = JSON.parse(await readFile("data/everyday-guides.json", "utf8"));
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const evidenceIds = new Set(evidenceDocs.flatMap((document) => document.reviews || []).map((review) => review.slug));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const guides = source.entries || [];
assert(guides.length >= 10, `Everyday layer needs at least 10 launch guides, found ${guides.length}`);
assert(/^\d{4}-\d{2}-\d{2}$/.test(String(source.updatedAt || "")), "Everyday guide data needs a stable updatedAt date");

const slugs = new Set();
for (const guide of guides) {
  assert(guide.slug && !slugs.has(guide.slug), `duplicate everyday guide slug: ${guide.slug}`);
  slugs.add(guide.slug);
  for (const field of ["title", "category", "summary", "situation", "explanation", "whyItMatters", "tryThis", "takeaway", "biasSlug"]) {
    assert(String(guide[field] || "").trim(), `${guide.slug}: missing ${field}`);
  }
  assert(bySlug.has(guide.biasSlug), `${guide.slug}: unknown published bias ${guide.biasSlug}`);
  assert(evidenceIds.has(guide.biasSlug), `${guide.slug}: guide must point to an evidence-reviewed bias`);
  assert(guide.summary.length <= 190, `${guide.slug}: summary is too long for metadata`);
}

const publicData = JSON.parse(await readFile(join(OUT, "data", "everyday-guides.json"), "utf8"));
assert(publicData.guides?.length === guides.length, "public everyday data count drift");
assert(publicData.canonicalUrl === `${SITE}/everyday/`, "public everyday data canonical URL drift");

const hub = await readFile(join(OUT, "everyday", "index.html"), "utf8");
assert(hub.includes("<h1>Why do we make these decisions?</h1>"), "Everyday hub headline missing");
assert(hub.includes('"@type":"CollectionPage"'), "Everyday hub is missing CollectionPage structured data");
for (const guide of guides) assert(hub.includes(`/everyday/${guide.slug}/`), `Everyday hub missing ${guide.slug}`);

for (const guide of guides) {
  const path = join(OUT, "everyday", guide.slug, "index.html");
  await access(path);
  const html = await readFile(path, "utf8");
  assert(html.includes(`<link rel="canonical" href="${SITE}/everyday/${guide.slug}/">`), `${guide.slug}: canonical missing`);
  assert(html.includes('"@type":"Article"'), `${guide.slug}: Article structured data missing`);
  assert(html.includes(`<h1>${guide.title.replaceAll("&", "&amp;").replaceAll("'", "&#39;")}</h1>`) || html.includes("<h1>"), `${guide.slug}: H1 missing`);
  assert(html.includes(`/biases/${guide.biasSlug}/`), `${guide.slug}: canonical bias link missing`);
  assert(html.includes("Try this next time"), `${guide.slug}: practical action missing`);
  assert(html.includes("This does not prove that one bias caused the decision."), `${guide.slug}: non-diagnostic framing missing`);
  assert(html.includes('/assets/brand.webp'), `${guide.slug}: optimized brand asset missing`);
}

const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
assert(sitemap.includes(`<loc>${SITE}/everyday/</loc>`), "sitemap missing everyday hub");
for (const guide of guides) assert(sitemap.includes(`<loc>${SITE}/everyday/${guide.slug}/</loc>`), `sitemap missing ${guide.slug}`);

const homepage = await readFile(join(OUT, "index.html"), "utf8");
assert(homepage.includes("everyday-home") && homepage.includes('href="/everyday/"'), "homepage does not surface Everyday life");
const explorePage = await readFile(join(OUT, "explore", "index.html"), "utf8");
const primaryNav = explorePage.match(/<nav aria-label="Primary">([\s\S]*?)<\/nav>/i)?.[1] || "";
assert(primaryNav.includes('href="/everyday/"'), "primary navigation drawer missing Everyday life");

const llms = await readFile(join(OUT, "llms.txt"), "utf8");
assert(llms.includes("https://cognitive-biases.github.io/everyday/"), "llms.txt does not expose Everyday life");
assert(llms.includes("https://cognitive-biases.github.io/data/everyday-guides.json"), "llms.txt does not expose everyday guide data");

const uniqueBiasSlugs = [...new Set(guides.map((guide) => guide.biasSlug))];
for (const biasSlug of uniqueBiasSlugs) {
  const html = await readFile(join(OUT, "biases", biasSlug, "index.html"), "utf8");
  assert(html.includes('class="everyday-teaser"'), `${biasSlug}: everyday cross-link teaser missing`);
}

console.log(`Everyday life check passed: ${guides.length} guides across ${new Set(guides.map((guide) => guide.category)).size} categories and ${uniqueBiasSlugs.length} reviewed concepts.`);
