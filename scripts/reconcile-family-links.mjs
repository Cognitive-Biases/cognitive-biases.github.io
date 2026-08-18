import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const taxonomy = JSON.parse(await readFile("data/taxonomy-v2.json", "utf8"));
const overrides = taxonomy.recordFamilyOverrides || {};
const duplicateDispositions = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicateDispositions.groups || []).flatMap((group) => group.duplicateIds || []));
const canonicalBiases = biases.filter((bias) => !duplicateIds.has(bias.id));
const familyFor = (bias) => overrides[String(bias.id)] || taxonomy.directCategoryFamily[bias.typeOfBias] || null;
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

const counts = new Map();
for (const bias of canonicalBiases) {
  const family = familyFor(bias);
  if (!family) continue;
  counts.set(family, (counts.get(family) || 0) + 1);
}
const publishedFamilies = new Set([...counts.entries()]
  .filter(([, count]) => count >= taxonomy.hubMinimumRecords)
  .map(([family]) => family));

let added = 0;
for (const bias of biases) {
  const familySlug = familyFor(bias);
  if (!familySlug || !publishedFamilies.has(familySlug)) continue;
  const family = taxonomy.families[familySlug];
  if (!family) throw new Error(`${bias.slug}: missing family definition ${familySlug}.`);
  const path = join(OUT, "biases", bias.slug, "index.html");
  let html = await readFile(path, "utf8");
  if (html.includes(`href="/families/${familySlug}/"`)) continue;
  const marker = `<p class="eyebrow">${escapeHtml(bias.typeOfBias)} · Entry`;
  if (!html.includes(marker)) throw new Error(`${bias.slug}: cannot reconcile family link because the eyebrow marker was not found.`);
  html = html.replace(marker, `<p class="eyebrow"><a class="taxonomy-link" href="/families/${familySlug}/">${escapeHtml(family.label)}</a> · ${escapeHtml(bias.typeOfBias)} · Entry`);
  await writeFile(path, html);
  added += 1;
}

console.log(`Family-link reconciliation added ${added} missing links across ${publishedFamilies.size} published canonical family hubs.`);
