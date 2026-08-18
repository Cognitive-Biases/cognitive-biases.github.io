import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const duplicateDispositions = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicateDispositions.groups || []).flatMap((group) => group.duplicateIds || []));
const canonicalBiases = biases.filter((bias) => !duplicateIds.has(bias.id));
const evidenceFiles = (await readdir("data"))
  .filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name))
  .sort();
const documents = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const reviews = documents.flatMap((document) => document.reviews || []);
const hub = await readFile(resolve("dist", "evidence", "index.html"), "utf8");
const sitemap = await readFile("dist/sitemap.xml", "utf8");

if (!hub.includes(`<link rel="canonical" href="${SITE}/evidence/">`)) throw new Error("Evidence hub is missing its canonical URL.");
if (!hub.includes('"@type":"CollectionPage"') || !hub.includes('"@type":"ItemList"')) throw new Error("Evidence hub is missing CollectionPage/ItemList structured data.");
if (!hub.includes(`${reviews.length} of ${canonicalBiases.length} canonical entries currently include an editorial evidence review.`)) {
  throw new Error("Evidence hub coverage summary is stale.");
}
if (!sitemap.includes(`<loc>${SITE}/evidence/</loc>`)) throw new Error("Evidence hub is missing from sitemap.");

const seen = new Set();
for (const review of reviews) {
  if (seen.has(review.slug)) throw new Error(`${review.slug}: duplicated across evidence hub sources.`);
  seen.add(review.slug);
  if (!hub.includes(`/biases/${review.slug}/#evidence`)) throw new Error(`${review.slug}: missing from Evidence hub.`);
  if (!hub.includes(review.evidenceStatus.replaceAll("&", "&amp;"))) throw new Error(`${review.slug}: evidence status missing from hub.`);
}

for (const path of ["index.html", "explore/index.html", `biases/${reviews[0].slug}/index.html`]) {
  const html = await readFile(resolve("dist", path), "utf8");
  if (!html.includes('href="/evidence/"')) throw new Error(`${path}: primary navigation is missing Evidence.`);
}

console.log(`Evidence hub check passed: ${reviews.length} reviewed entries, ${canonicalBiases.length} canonical biases, sitemap and primary navigation verified.`);
