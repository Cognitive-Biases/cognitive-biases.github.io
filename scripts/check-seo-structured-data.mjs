import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

async function walkHtml(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walkHtml(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

const robots = await readFile(join(OUT, "robots.txt"), "utf8");
if (!robots.includes("User-agent: OAI-SearchBot\nAllow: /")) throw new Error("robots.txt must explicitly allow OAI-SearchBot.");
if (!robots.includes(`Sitemap: ${SITE}/sitemap.xml`)) throw new Error("robots.txt must advertise the canonical sitemap.");

const htmlFiles = await walkHtml(OUT);
let previewControlled = 0;
for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  if (html.includes('meta name="keywords"')) throw new Error(`${file}: obsolete meta keywords are not allowed.`);
  if (html.includes("max-image-preview:large")) previewControlled += 1;
}
if (previewControlled < Math.floor(htmlFiles.length * 0.9)) throw new Error(`Only ${previewControlled}/${htmlFiles.length} HTML pages allow large search previews.`);

const biases = (await readJson("data/biases.json")).filter((item) => item.published);
const duplicates = await readJson("data/duplicate-dispositions.json");
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const canonicalBiases = biases.filter((item) => !duplicateIds.has(item.id));
const evidence = await readJson("dist/data/evidence.json");
const evidenceBySlug = new Map((evidence.reviews || []).map((review) => [review.slug, review]));

for (const bias of canonicalBiases) {
  const file = join(OUT, "biases", bias.slug, "index.html");
  const html = await readFile(file, "utf8");
  if (!html.includes('data-seo-schema="defined-term"')) throw new Error(`${bias.slug}: missing DefinedTerm SEO graph.`);
  if (!html.includes('"@type":"DefinedTerm"')) throw new Error(`${bias.slug}: DefinedTerm type missing.`);
  if (!html.includes('"@type":"BreadcrumbList"')) throw new Error(`${bias.slug}: BreadcrumbList missing.`);
  if (!html.includes(`"termCode":"${bias.id}"`)) throw new Error(`${bias.slug}: stable termCode missing.`);
  if (!html.includes(`"inDefinedTermSet":"${SITE}/explore/#bias-library"`)) throw new Error(`${bias.slug}: DefinedTermSet link missing.`);
  const review = evidenceBySlug.get(bias.slug);
  const firstSource = review?.sources?.[0]?.url;
  if (firstSource && !html.includes(firstSource)) throw new Error(`${bias.slug}: reviewed source provenance is missing from structured data.`);
}

const dataHtml = await readFile(join(OUT, "data", "index.html"), "utf8");
for (const required of ['data-seo-schema="dataset"','"@type":"Dataset"','"@type":"DataDownload"','"contentUrl":"https://cognitive-biases.github.io/data/biases.json"','"license":"https://creativecommons.org/licenses/by-nc-sa/4.0/"']) {
  if (!dataHtml.includes(required)) throw new Error(`Data page structured metadata is missing: ${required}`);
}
const downloadCount = (dataHtml.match(/"@type":"DataDownload"/g) || []).length;
if (downloadCount < 5) throw new Error(`Data page exposes only ${downloadCount} structured distributions.`);

const notes = await readJson("data/research-notes.json");
for (const note of notes.entries || []) {
  const file = join(OUT, "research", note.slug, "index.html");
  const html = await readFile(file, "utf8");
  for (const required of ['data-seo-schema="research-article"','"@type":"Article"','"@type":"BreadcrumbList"','"author":{"@id":"https://cognitive-biases.github.io/#organization"}','"publisher":{"@id":"https://cognitive-biases.github.io/#organization"}']) {
    if (!html.includes(required)) throw new Error(`${note.slug}: missing research Article metadata: ${required}`);
  }
  for (const source of note.sources || []) if (!html.includes(source.url)) throw new Error(`${note.slug}: structured citation missing ${source.url}`);
}

const researchHtml = await readFile(join(OUT, "research", "index.html"), "utf8");
if (!researchHtml.includes('data-seo-schema="research-collection"') || !researchHtml.includes('"@type":"CollectionPage"')) throw new Error("Research index needs CollectionPage structured data.");

console.log(`SEO structured-data checks passed: ${canonicalBiases.length} DefinedTerm pages, ${(notes.entries || []).length} research Articles, ${downloadCount} Dataset distributions, ${previewControlled}/${htmlFiles.length} preview-enabled HTML pages.`);
