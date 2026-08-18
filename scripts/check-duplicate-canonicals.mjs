import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const dispositions = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const byId = new Map(biases.map((bias) => [bias.id, bias]));
const sitemap = await readFile("dist/sitemap.xml", "utf8");
let checked = 0;

for (const group of dispositions.groups || []) {
  const primary = byId.get(group.primaryId);
  if (!primary) throw new Error(`${group.concept}: missing primary ${group.primaryId}.`);
  for (const duplicateId of group.duplicateIds || []) {
    const duplicate = byId.get(duplicateId);
    if (!duplicate) throw new Error(`${group.concept}: missing duplicate ${duplicateId}.`);
    const html = await readFile(resolve("dist", "biases", duplicate.slug, "index.html"), "utf8");
    const primaryUrl = `${SITE}/biases/${primary.slug}/`;
    const duplicateUrl = `${SITE}/biases/${duplicate.slug}/`;
    if (!html.includes(`<link rel="canonical" href="${primaryUrl}">`)) {
      throw new Error(`${duplicate.slug}: canonical does not point to ${primary.slug}.`);
    }
    if (!html.includes('class="consolidation-note"') || !html.includes(`/biases/${primary.slug}/`)) {
      throw new Error(`${duplicate.slug}: missing visible consolidation notice.`);
    }
    if (sitemap.includes(`<loc>${duplicateUrl}</loc>`)) throw new Error(`${duplicate.slug}: duplicate URL must not be in sitemap.`);
    if (!sitemap.includes(`<loc>${primaryUrl}</loc>`)) throw new Error(`${primary.slug}: canonical URL is missing from sitemap.`);
    checked += 1;
  }
  for (const separateId of group.separateIds || []) {
    const separate = byId.get(separateId);
    if (!separate) throw new Error(`${group.concept}: missing separate record ${separateId}.`);
    const html = await readFile(resolve("dist", "biases", separate.slug, "index.html"), "utf8");
    const selfUrl = `${SITE}/biases/${separate.slug}/`;
    if (!html.includes(`<link rel="canonical" href="${selfUrl}">`)) {
      throw new Error(`${separate.slug}: explicitly separate homonym must remain self-canonical.`);
    }
  }
}

console.log(`Duplicate canonical check passed: ${checked} alias pages point to reviewed canonical records.`);
