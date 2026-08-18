import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const duplicates = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const canonicalBiases = biases.filter((bias) => !duplicateIds.has(bias.id));
const taxonomy = JSON.parse(await readFile("data/taxonomy-v2.json", "utf8"));
const contexts = JSON.parse(await readFile("data/contexts.json", "utf8"));
const comparisons = JSON.parse(await readFile("data/comparisons.json", "utf8"));
const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(`data/${name}`, "utf8"))));
const reviews = evidenceDocs.flatMap((document) => document.reviews || []);
const auditEligible = reviews.filter((review) => review.auditEligible !== false);
const familyFor = (bias) => taxonomy.recordFamilyOverrides?.[String(bias.id)] || taxonomy.directCategoryFamily?.[bias.typeOfBias] || null;
const familyCounts = new Map();
for (const bias of canonicalBiases) {
  const family = familyFor(bias);
  if (!family) continue;
  familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
}
const familyHubCount = [...familyCounts.values()].filter((count) => count >= taxonomy.hubMinimumRecords).length;
const html = await readFile(resolve("dist", "index.html"), "utf8");

if (html.includes("Educational mobile app + public reference")) throw new Error("Homepage regressed to the legacy app-first positioning.");
if (!html.includes("Decision tools + evidence-reviewed reference") || !html.includes("Notice the pattern.<br>Test the decision.")) {
  throw new Error("Homepage decision-system hero is missing.");
}
for (const route of ["/tools/decision-audit/", "/contexts/", "/evidence/", "/compare/", "/explore/", "/kinds/"]) {
  if (!html.includes(`href="${route}"`)) throw new Error(`Homepage is missing product route ${route}.`);
}
if (!html.includes("play.google.com/store/apps/details?id=cognitivebiases.thinking.psychology")) {
  throw new Error("Homepage no longer exposes the mobile app as a secondary companion.");
}

const expectedStrings = [
  `${auditEligible.length} reviewed lenses`,
  `${contexts.entries.length} curated starting points`,
  `${reviews.length} source-grounded reviews`,
  `${comparisons.entries.length} reviewed comparisons`,
  `<strong>${canonicalBiases.length}</strong><span>canonical entries</span>`,
  `<strong>${reviews.length}</strong><span>evidence-reviewed</span>`,
  `<strong>${familyHubCount}</strong><span>mechanism families</span>`,
];
for (const expected of expectedStrings) {
  if (!html.includes(expected)) throw new Error(`Homepage live metric/content is stale: ${expected}`);
}

if (!html.includes("Recognize → Test → Counter → Decide.")) throw new Error("Homepage is missing the product decision loop.");
if (!html.includes("Drafts stay in your browser")) throw new Error("Homepage is missing the local-first Audit disclosure.");
if (!html.includes("<title>Cognitive Biases | Decision tools, evidence & bias reference</title>")) throw new Error("Homepage title is not aligned to the decision-system positioning.");
if (!html.includes('meta name="description"') || !html.includes("local-first Decision Audit")) throw new Error("Homepage meta description is not aligned to the decision-system positioning.");

console.log(`Homepage positioning check passed: ${canonicalBiases.length} canonical entries, ${reviews.length} evidence reviews, ${auditEligible.length} audit lenses, ${contexts.entries.length} contexts, ${comparisons.entries.length} comparisons, ${familyHubCount} family hubs.`);
