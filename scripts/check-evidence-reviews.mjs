import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const evidence = JSON.parse(await readFile("data/evidence-reviews.json", "utf8"));
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
const duplicateDispositions = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicateDispositions.groups || []).flatMap((group) => group.duplicateIds || []));
const sitemap = await readFile("dist/sitemap.xml", "utf8");
const seen = new Set();

for (const review of evidence.reviews || []) {
  if (seen.has(review.slug)) throw new Error(`${review.slug}: duplicate evidence review.`);
  seen.add(review.slug);
  const bias = bySlug.get(review.slug);
  if (!bias) throw new Error(`${review.slug}: evidence review has no published bias.`);
  if (duplicateIds.has(bias.id)) throw new Error(`${review.slug}: evidence review targets a duplicate alias.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(review.reviewedAt || "")) throw new Error(`${review.slug}: invalid reviewedAt date.`);
  if (!Array.isArray(review.sources) || review.sources.length < 2) throw new Error(`${review.slug}: fewer than two sources.`);
  for (const source of review.sources) {
    if (!/^https:\/\//.test(source.url || "")) throw new Error(`${review.slug}: source URL must use https.`);
    if (!source.title || !source.year || !source.type) throw new Error(`${review.slug}: incomplete source metadata.`);
  }

  const html = await readFile(resolve("dist", "biases", review.slug, "index.html"), "utf8");
  if (!html.includes('class="evidence-review"') || !html.includes(escapeForCheck(review.evidenceStatus))) {
    throw new Error(`${review.slug}: rendered evidence section is missing.`);
  }
  const pageUrl = `${SITE}/biases/${review.slug}/`;
  if (!html.includes(`${pageUrl}#evidence-review`) || !html.includes('"citation"')) {
    throw new Error(`${review.slug}: evidence Article structured data is missing.`);
  }
  for (const source of review.sources) {
    if (!html.includes(source.url.replaceAll("&", "&amp;")) && !html.includes(source.url)) {
      throw new Error(`${review.slug}: rendered page is missing source ${source.url}.`);
    }
  }
  if (!sitemap.includes(`<loc>${pageUrl}</loc>`)) throw new Error(`${review.slug}: reviewed canonical page is missing from sitemap.`);
}

function escapeForCheck(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

console.log(`Evidence review check passed: ${seen.size} canonical pilot entries with reviewed sources and structured data.`);
