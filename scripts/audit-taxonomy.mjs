import { readFile, writeFile } from "node:fs/promises";

const biases = JSON.parse(await readFile("data/biases.json", "utf8"));
const published = biases.filter((bias) => bias.published);
const byId = new Map(biases.map((bias) => [bias.id, bias]));

const normalizeText = (value = "") => String(value)
  .normalize("NFKD")
  .toLowerCase()
  .replace(/[’']/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");

const canonicalName = (bias) => String(bias.canonicalName || bias.title || "")
  .split(/\s+[–—]\s+|\s+-\s+/)[0]
  .trim();

const conceptKey = (bias) => normalizeText(canonicalName(bias));
const tokens = (value) => new Set(normalizeText(value).split(" ").filter((token) => token.length > 2));
const jaccard = (left, right) => {
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
};

const candidateKind = (name) => {
  const normalized = normalizeText(name);
  if (/\bheuristic\b/.test(normalized)) return "heuristic";
  if (/\bfallacy\b/.test(normalized)) return "fallacy";
  if (/\bprinciple\b|\blaw\b/.test(normalized)) return "principle";
  if (/\beffect\b/.test(normalized)) return "effect";
  if (/\bbias\b/.test(normalized)) return "bias";
  if (/\billusion\b|\bsyndrome\b|\bphenomenon\b|\bparadox\b/.test(normalized)) return "phenomenon";
  return "unclassified";
};

const groupBy = (items, keyFn) => {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
};

const categoryCounts = [...groupBy(published, (bias) => bias.typeOfBias).entries()]
  .map(([category, records]) => ({ category, count: records.length }))
  .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

const kindCandidates = [...groupBy(published, (bias) => candidateKind(canonicalName(bias))).entries()]
  .map(([kind, records]) => ({ kind, count: records.length }))
  .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));

const exactConceptDuplicates = [...groupBy(published, conceptKey).entries()]
  .filter(([key, records]) => key && records.length > 1)
  .map(([key, records]) => ({
    key,
    records: records.map((bias) => ({ id: bias.id, title: bias.title, slug: bias.slug, category: bias.typeOfBias })),
  }))
  .sort((a, b) => a.key.localeCompare(b.key));

const duplicatePairs = new Set(exactConceptDuplicates.flatMap((group) => group.records.flatMap((left, index) =>
  group.records.slice(index + 1).map((right) => `${Math.min(left.id, right.id)}:${Math.max(left.id, right.id)}`),
)));

const nearDuplicateCandidates = [];
for (let leftIndex = 0; leftIndex < published.length; leftIndex += 1) {
  const left = published[leftIndex];
  const leftName = canonicalName(left);
  const leftTokens = tokens(leftName);
  for (let rightIndex = leftIndex + 1; rightIndex < published.length; rightIndex += 1) {
    const right = published[rightIndex];
    const pairKey = `${Math.min(left.id, right.id)}:${Math.max(left.id, right.id)}`;
    if (duplicatePairs.has(pairKey)) continue;
    const score = jaccard(leftTokens, tokens(canonicalName(right)));
    if (score < 0.72) continue;
    nearDuplicateCandidates.push({
      score: Number(score.toFixed(3)),
      left: { id: left.id, title: left.title, slug: left.slug, category: left.typeOfBias },
      right: { id: right.id, title: right.title, slug: right.slug, category: right.typeOfBias },
    });
  }
}
nearDuplicateCandidates.sort((a, b) => b.score - a.score || a.left.id - b.left.id || a.right.id - b.right.id);

const missingRelations = [];
const selfRelations = [];
const asymmetricRelations = [];
for (const bias of published) {
  const related = [...new Set(bias.related || [])];
  for (const relatedId of related) {
    if (relatedId === bias.id) selfRelations.push({ id: bias.id, relatedId });
    const target = byId.get(relatedId);
    if (!target) {
      missingRelations.push({ id: bias.id, relatedId });
      continue;
    }
    if (!(target.related || []).includes(bias.id)) asymmetricRelations.push({ id: bias.id, relatedId });
  }
}

const noRelations = published
  .filter((bias) => !(bias.related || []).length)
  .map((bias) => ({ id: bias.id, title: bias.title, slug: bias.slug }));

const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    records: biases.length,
    published: published.length,
    categories: categoryCounts.length,
    exactConceptDuplicateGroups: exactConceptDuplicates.length,
    nearDuplicateCandidates: nearDuplicateCandidates.length,
    missingRelations: missingRelations.length,
    selfRelations: selfRelations.length,
    asymmetricRelations: asymmetricRelations.length,
    recordsWithoutRelations: noRelations.length,
  },
  categoryCounts,
  kindCandidates,
  exactConceptDuplicates,
  nearDuplicateCandidates,
  relationHealth: { missingRelations, selfRelations, asymmetricRelations, noRelations },
};

const args = new Set(process.argv.slice(2));
if (args.has("--write")) {
  const json = `${JSON.stringify(report, null, 2)}\n`;
  await writeFile("docs/taxonomy-audit.json", json);
  console.log("Wrote docs/taxonomy-audit.json");
}

console.log(`Taxonomy audit: ${report.totals.published} published records across ${report.totals.categories} categories.`);
console.log(`Kind candidates: ${kindCandidates.map(({ kind, count }) => `${kind}=${count}`).join(", ")}.`);
console.log(`Exact concept duplicate groups: ${report.totals.exactConceptDuplicateGroups}.`);
for (const group of exactConceptDuplicates.slice(0, 20)) {
  console.log(`- duplicate: ${group.records.map((record) => `#${record.id} ${record.title}`).join(" | ")}`);
}
console.log(`Near-duplicate candidates (Jaccard >= 0.72): ${report.totals.nearDuplicateCandidates}.`);
for (const pair of nearDuplicateCandidates.slice(0, 20)) {
  console.log(`- candidate ${pair.score}: #${pair.left.id} ${pair.left.title} <> #${pair.right.id} ${pair.right.title}`);
}
console.log(`Relations: missing=${report.totals.missingRelations}, self=${report.totals.selfRelations}, asymmetric=${report.totals.asymmetricRelations}, no-related=${report.totals.recordsWithoutRelations}.`);
console.log(`Largest categories: ${categoryCounts.slice(0, 12).map(({ category, count }) => `${category}=${count}`).join(", ")}.`);
