import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const ALLOWED_TYPES = new Set(["often-confused-with", "overlaps-with"]);
const config = JSON.parse(await readFile("data/relations-v2.json", "utf8"));
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
const duplicates = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(`data/${name}`, "utf8"))));
const reviewedSlugs = new Set(evidenceDocs.flatMap((document) => document.reviews || []).map((review) => review.slug));
const seen = new Set();
const endpoints = new Set();
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

const actualTypes = Object.keys(config.relationTypes || {}).sort();
if (JSON.stringify(actualTypes) !== JSON.stringify([...ALLOWED_TYPES].sort())) {
  throw new Error(`Relations v2 vocabulary changed unexpectedly: ${actualTypes.join(", ")}.`);
}
for (const type of ALLOWED_TYPES) {
  if (!config.relationTypes[type]?.label || !config.relationTypes[type]?.description) throw new Error(`${type}: relation type metadata is incomplete.`);
}

for (const relation of config.relations || []) {
  if (!ALLOWED_TYPES.has(relation.type)) throw new Error(`${relation.type}: uncontrolled relation type.`);
  if (relation.leftSlug === relation.rightSlug) throw new Error(`${relation.leftSlug}: self relation is not allowed.`);
  const left = bySlug.get(relation.leftSlug);
  const right = bySlug.get(relation.rightSlug);
  if (!left || !right) throw new Error(`${relation.leftSlug} ↔ ${relation.rightSlug}: unpublished endpoint.`);
  if (duplicateIds.has(left.id) || duplicateIds.has(right.id)) throw new Error(`${relation.leftSlug} ↔ ${relation.rightSlug}: duplicate alias endpoint.`);
  if (!reviewedSlugs.has(left.slug) || !reviewedSlugs.has(right.slug)) throw new Error(`${relation.leftSlug} ↔ ${relation.rightSlug}: both endpoints must be evidence-reviewed.`);
  if (!relation.note || relation.note.length < 80) throw new Error(`${relation.leftSlug} ↔ ${relation.rightSlug}: relation note is too thin.`);

  const pair = [left.slug, right.slug].sort().join("::");
  const key = `${relation.type}::${pair}`;
  if (seen.has(key)) throw new Error(`${relation.leftSlug} ↔ ${relation.rightSlug}: duplicate unordered relation/type pair.`);
  seen.add(key);
  endpoints.add(left.slug);
  endpoints.add(right.slug);

  for (const [source, target] of [[left, right], [right, left]]) {
    const html = await readFile(resolve("dist", "biases", source.slug, "index.html"), "utf8");
    if (!html.includes('class="evidence-relations"')) throw new Error(`${source.slug}: evidence-linked concepts section missing.`);
    if (!html.includes(`data-relation-type="${relation.type}"`)) throw new Error(`${source.slug}: relation type ${relation.type} not rendered.`);
    if (!html.includes(`/biases/${target.slug}/#evidence`)) throw new Error(`${source.slug}: reciprocal relation to ${target.slug} missing.`);
    if (!html.includes(escapeHtml(relation.note))) throw new Error(`${source.slug}: relation note for ${target.slug} missing from rendered page.`);
  }
}

for (const bias of biases) {
  const html = await readFile(resolve("dist", "biases", bias.slug, "index.html"), "utf8");
  if (html.includes('<section class="related">')) throw new Error(`${bias.slug}: raw legacy related section is still unlabeled.`);
  if (html.includes('class="legacy-related"') && !html.includes('class="legacy-related__label"')) {
    throw new Error(`${bias.slug}: legacy related section is missing its trust/source label.`);
  }
  if (!endpoints.has(bias.slug) && html.includes('class="evidence-relations"')) {
    throw new Error(`${bias.slug}: relation UI rendered without a reviewed v2 edge.`);
  }
}

console.log(`Relations v2 check passed: ${seen.size} reviewed typed edges render reciprocally across ${endpoints.size} canonical evidence-reviewed entries; legacy related links are visually separated.`);
