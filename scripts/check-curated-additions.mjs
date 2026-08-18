import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const additions = JSON.parse(await readFile("data/curated-additions.json", "utf8"));
const biases = JSON.parse(await readFile("data/biases.json", "utf8"));
const byId = new Map(biases.map((bias) => [bias.id, bias]));
const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(`data/${name}`, "utf8"))));
const reviewedSlugs = new Set(evidenceDocs.flatMap((document) => document.reviews || []).map((review) => review.slug));
const taxonomy = JSON.parse(await readFile("data/taxonomy-v2.json", "utf8"));
const sitemap = await readFile("dist/sitemap.xml", "utf8");
const explore = await readFile(resolve("dist", "explore", "index.html"), "utf8");
const seenIds = new Set();
const seenSlugs = new Set();

for (const entry of additions.entries || []) {
  if (seenIds.has(entry.id)) throw new Error(`Duplicate curated addition id ${entry.id}.`);
  if (seenSlugs.has(entry.slug)) throw new Error(`Duplicate curated addition slug ${entry.slug}.`);
  seenIds.add(entry.id);
  seenSlugs.add(entry.slug);

  const record = byId.get(entry.id);
  if (!record || record.slug !== entry.slug) throw new Error(`${entry.slug}: curated addition missing from prepared corpus.`);
  if (record.status !== "curated" || record.published !== true) throw new Error(`${entry.slug}: curated status/published contract is missing.`);
  if (!reviewedSlugs.has(entry.slug)) throw new Error(`${entry.slug}: every curated addition must have an evidence review before publication.`);
  if (!taxonomy.recordFamilyOverrides?.[String(entry.id)]) throw new Error(`${entry.slug}: curated addition requires an explicit reviewed family mapping.`);

  const url = `${SITE}/biases/${entry.slug}/`;
  const html = await readFile(resolve("dist", "biases", entry.slug, "index.html"), "utf8");
  if (!html.includes(`<link rel="canonical" href="${url}">`)) throw new Error(`${entry.slug}: canonical page missing.`);
  if (!html.includes('class="evidence-review"')) throw new Error(`${entry.slug}: evidence layer missing from rendered page.`);
  if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`${entry.slug}: missing from sitemap.`);
  if (!explore.includes(`/biases/${entry.slug}/`)) throw new Error(`${entry.slug}: missing from Explore discovery.`);
  if (!explore.includes(record.title.replaceAll("&", "&amp;"))) throw new Error(`${entry.slug}: Explore does not render the curated title.`);
  for (const relatedId of entry.related || []) {
    if (!byId.has(relatedId)) throw new Error(`${entry.slug}: missing related record ${relatedId}.`);
  }
}

console.log(`Curated addition check passed: ${seenIds.size} source-controlled additions are canonical, evidence-reviewed, family-mapped, rendered, discoverable, and present in sitemap.`);
