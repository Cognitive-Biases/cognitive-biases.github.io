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

for (const { primary, duplicate } of aliases) {
  const germanFile = join(OUT, "de", "biases", duplicate.slug, "index.html");
  let germanHtml = await readFile(germanFile, "utf8");
  const duplicateDe = `${SITE}/de/biases/${duplicate.slug}/`;
  const primaryDe = `${SITE}/de/biases/${primary.slug}/`;
  const duplicateEn = `${SITE}/biases/${duplicate.slug}/`;
  const primaryEn = `${SITE}/biases/${primary.slug}/`;
  germanHtml = germanHtml.replace(`<link rel="canonical" href="${duplicateDe}">`, `<link rel="canonical" href="${primaryDe}">`);
  germanHtml = germanHtml.replace(`<meta property="og:url" content="${duplicateDe}">`, `<meta property="og:url" content="${primaryDe}">`);
  germanHtml = germanHtml.replace(`<link rel="alternate" hreflang="de" href="${duplicateDe}">`, `<link rel="alternate" hreflang="de" href="${primaryDe}">`);
  germanHtml = germanHtml.replace(`<link rel="alternate" hreflang="en" href="${duplicateEn}">`, `<link rel="alternate" hreflang="en" href="${primaryEn}">`);
  germanHtml = germanHtml.replace(`<link rel="alternate" hreflang="x-default" href="${duplicateEn}">`, `<link rel="alternate" hreflang="x-default" href="${primaryEn}">`);
  const notice = `<aside class="consolidation-note"><strong>Zusammengeführter Eintrag.</strong> Diese URL bleibt für bestehende Links erhalten. Der kanonische deutsche Eintrag ist <a href="/de/biases/${primary.slug}/">${primary.title}</a>.</aside>`;
  if (!germanHtml.includes('class="consolidation-note"')) germanHtml = germanHtml.replace("</h1>", `</h1>${notice}`);
  await writeFile(germanFile, germanHtml);

  const englishFile = join(OUT, "biases", duplicate.slug, "index.html");
  let englishHtml = await readFile(englishFile, "utf8");
  englishHtml = englishHtml.replace(`<link rel="alternate" hreflang="de" href="${duplicateDe}">`, `<link rel="alternate" hreflang="de" href="${primaryDe}">`);
  await writeFile(englishFile, englishHtml);
}

const publicDataPath = join(OUT, "data", "de", "biases.json");
const publicData = JSON.parse(await readFile(publicDataPath, "utf8"));
const duplicateBySlug = new Map(aliases.map(({ primary, duplicate }) => [duplicate.slug, primary]));
publicData.entries = (publicData.entries || []).map((entry) => {
  const primary = duplicateBySlug.get(entry.slug);
  if (!primary) return { ...entry, isCanonical: true, canonicalGermanUrl: entry.germanUrl };
  return { ...entry, isCanonical: false, primarySlug: primary.slug, canonicalGermanUrl: `${SITE}/de/biases/${primary.slug}/` };
});
publicData.coverage = { ...(publicData.coverage || {}), duplicateAliasPages: aliases.length, canonicalGermanEntities: publicData.entries.filter((entry) => entry.isCanonical).length };
await writeFile(publicDataPath, JSON.stringify(publicData, null, 2) + "\n");

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
const duplicateUrls = new Set(aliases.map(({ duplicate }) => `${SITE}/de/biases/${duplicate.slug}/`));
sitemap = sitemap.split("\n").filter((line) => ![...duplicateUrls].some((url) => line.includes(`<loc>${url}</loc>`))).join("\n");
await writeFile(sitemapPath, sitemap);

console.log(`German duplicate canonicalization applied: ${aliases.length} alias page(s) retained and canonicalized to primary German entries.`);
