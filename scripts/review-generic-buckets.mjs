import { readFile, readdir } from "node:fs/promises";

const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const taxonomy = JSON.parse(await readFile("data/taxonomy-v2.json", "utf8"));
const kinds = JSON.parse(await readFile("data/kinds-v2.json", "utf8"));
const evidenceFiles = (await readdir("data"))
  .filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name))
  .sort();
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(`data/${name}`, "utf8"))));
const evidenceBySlug = new Map(evidenceDocs.flatMap((document) => document.reviews || []).map((review) => [review.slug, review]));
const targetCategories = new Set(["Cognitive Bias", "Decision Making", "Heuristic Bias", "Human-Robot Interaction"]);
const overrides = taxonomy.recordFamilyOverrides || {};
const kindOverrides = kinds.recordKindOverrides || {};
const canonicalName = (bias) => String(bias.canonicalName || bias.title || "").split(/\s+[–—]\s+|\s+-\s+/)[0].trim();
const normalizeText = (value = "") => String(value).normalize("NFKD").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const kindFor = (bias) => {
  if (kindOverrides[String(bias.id)]) return kindOverrides[String(bias.id)];
  const normalized = normalizeText(canonicalName(bias));
  if (/\bheuristic\b/.test(normalized)) return "heuristic";
  if (/\bfallacy\b/.test(normalized)) return "fallacy";
  if (/\bprinciple\b|\blaw\b/.test(normalized)) return "principle";
  if (/\beffect\b/.test(normalized)) return "effect";
  if (/\bbias\b/.test(normalized)) return "bias";
  if (/\billusion\b|\bsyndrome\b|\bphenomenon\b|\bparadox\b/.test(normalized)) return "phenomenon";
  return null;
};
const rows = biases
  .filter((bias) => targetCategories.has(bias.typeOfBias) && !overrides[String(bias.id)])
  .sort((a, b) => a.typeOfBias.localeCompare(b.typeOfBias) || a.id - b.id);

const firstSentence = (value = "") => String(value).split(/\n|(?<=[.!?])\s+/)[0].trim().replace(/\s+/g, " ");
const reviewedCount = rows.filter((bias) => evidenceBySlug.has(bias.slug)).length;
const typedCount = rows.filter((bias) => kindFor(bias)).length;

console.log(`Unresolved generic-family queue: ${rows.length} records (${reviewedCount} evidence-reviewed, ${typedCount} kind-resolved).`);
let current = null;
for (const bias of rows) {
  if (bias.typeOfBias !== current) {
    current = bias.typeOfBias;
    console.log(`\n[${current}]`);
  }
  const review = evidenceBySlug.get(bias.slug);
  const kind = kindFor(bias) || "unassigned";
  const evidence = review ? review.evidenceStatus : "not reviewed";
  console.log(`#${bias.id} | ${bias.slug} | ${bias.title}`);
  console.log(`  kind=${kind} | evidence=${evidence}`);
  console.log(`  ${firstSentence(bias.description)}`);
}
