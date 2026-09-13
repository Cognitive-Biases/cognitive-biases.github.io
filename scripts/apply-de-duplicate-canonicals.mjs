import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((entry) => entry.published !== false);
const dispositions = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const byId = new Map(biases.map((entry) => [entry.id, entry]));
const aliases = [];

for (const group of dispositions.groups || []) {
  const primary = byId.get(group.primaryId);
  if (!primary) throw new Error(`${group.concept}: missing published primary ${group.primaryId}.`);
  for (const duplicateId of group.duplicateIds || []) {
    const duplicate = byId.get(duplicateId);
    if (!duplicate) throw new Error(`${group.concept}: missing published duplicate ${duplicateId}.`);
    aliases.push({ concept: group.concept, primary, duplicate });
  }
}

const publicDataPath = join(OUT, "data", "de", "biases.json");
const publicData = JSON.parse(await readFile(publicDataPath, "utf8"));
const germanBySlug = new Map((publicData.entries || []).map((entry) => [entry.slug, entry]));
const duplicateBySlug = new Map(aliases.map(({ primary, duplicate }) => [duplicate.slug, primary]));
const duplicateUrls = new Set(aliases.map(({ duplicate }) => `${SITE}/de/biases/${duplicate.slug}/`));

for (const { primary, duplicate } of aliases) {
  const germanFile = join(OUT, "de", "biases", duplicate.slug, "index.html");
  let germanHtml = await readFile(germanFile, "utf8");
  const duplicateDe = `${SITE}/de/biases/${duplicate.slug}/`;
  const primaryDe = `${SITE}/de/biases/${primary.slug}/`;
  const duplicateEn = `${SITE}/biases/${duplicate.slug}/`;
  const primaryEn = `${SITE}/biases/${primary.slug}/`;
  const germanPrimaryTitle = germanBySlug.get(primary.slug)?.title || primary.title;

  germanHtml = germanHtml.replace(`<link rel="canonical" href="${duplicateDe}">`, `<link rel="canonical" href="${primaryDe}">`);
  germanHtml = germanHtml.replace(`<meta property="og:url" content="${duplicateDe}">`, `<meta property="og:url" content="${primaryDe}">`);
  germanHtml = germanHtml.replace(`<link rel="alternate" hreflang="de" href="${duplicateDe}">`, `<link rel="alternate" hreflang="de" href="${primaryDe}">`);
  germanHtml = germanHtml.replace(`<link rel="alternate" hreflang="en" href="${duplicateEn}">`, `<link rel="alternate" hreflang="en" href="${primaryEn}">`);
  germanHtml = germanHtml.replace(`<link rel="alternate" hreflang="x-default" href="${duplicateEn}">`, `<link rel="alternate" hreflang="x-default" href="${primaryEn}">`);
  const notice = `<aside class="consolidation-note"><strong>Zusammengeführter Eintrag.</strong> Diese URL bleibt für bestehende Links erhalten. Der kanonische deutsche Eintrag ist <a href="/de/biases/${primary.slug}/">${germanPrimaryTitle}</a>.</aside>`;
  if (!germanHtml.includes('class="consolidation-note"')) germanHtml = germanHtml.replace("</h1>", `</h1>${notice}`);
  await writeFile(germanFile, germanHtml);

  const englishFile = join(OUT, "biases", duplicate.slug, "index.html");
  let englishHtml = await readFile(englishFile, "utf8");
  englishHtml = englishHtml.replace(`<link rel="alternate" hreflang="de" href="${duplicateDe}">`, `<link rel="alternate" hreflang="de" href="${primaryDe}">`);
  await writeFile(englishFile, englishHtml);
}

publicData.entries = (publicData.entries || []).map((entry) => {
  const primary = duplicateBySlug.get(entry.slug);
  if (!primary) return { ...entry, isCanonical: true, canonicalGermanUrl: entry.germanUrl };
  return { ...entry, isCanonical: false, primarySlug: primary.slug, canonicalGermanUrl: `${SITE}/de/biases/${primary.slug}/` };
});
const canonicalCount = publicData.entries.filter((entry) => entry.isCanonical).length;
publicData.coverage = { ...(publicData.coverage || {}), duplicateAliasPages: aliases.length, canonicalGermanEntities: canonicalCount };
await writeFile(publicDataPath, JSON.stringify(publicData, null, 2) + "\n");

const indexPath = join(OUT, "de", "biases", "index.html");
let indexHtml = await readFile(indexPath, "utf8");
indexHtml = indexHtml.replace(/<article class="practice-set-card"[\s\S]*?<\/article>/g, (block) => {
  return aliases.some(({ duplicate }) => block.includes(`href="/de/biases/${duplicate.slug}/"`)) ? "" : block;
});
indexHtml = indexHtml.replace(/Insgesamt:\s*\d+/, `Insgesamt: ${canonicalCount}`);
indexHtml = indexHtml.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (full, raw) => {
  try {
    const schema = JSON.parse(raw);
    if (schema?.["@type"] !== "CollectionPage" || !schema.mainEntity) return full;
    const items = (schema.mainEntity.itemListElement || []).filter((item) => !duplicateUrls.has(item.url));
    schema.mainEntity.numberOfItems = canonicalCount;
    schema.mainEntity.itemListElement = items.map((item, index) => ({ ...item, position: index + 1 }));
    return `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>`;
  } catch {
    return full;
  }
});
await writeFile(indexPath, indexHtml);

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
sitemap = sitemap.split("\n").filter((line) => ![...duplicateUrls].some((url) => line.includes(`<loc>${url}</loc>`))).join("\n");
await writeFile(sitemapPath, sitemap);

console.log(`German duplicate canonicalization applied: ${aliases.length} alias page(s) retained; ${canonicalCount} canonical German entities remain discoverable.`);
