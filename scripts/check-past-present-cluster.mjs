import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const DECLINISM = { id: 94, slug: "cognitive-bias-declinism" };
const FADING = { id: 178, slug: "memory-bias-fading-affect-bias" };
const ROSY = { id: 204, slug: "memory-bias-rosy-retrospection" };
const FAMILY = "past-present-comparison";
const CONTEXT = "comparing-past-present";
const COMPARISON = "declinism-vs-rosy-retrospection";
const RESEARCH = "why-the-past-can-look-better-than-it-was";
const INTENT = "past-present-comparison";
const json = async (path) => JSON.parse(await readFile(path, "utf8"));

const biases = await json("data/biases.json");
for (const expected of [DECLINISM, FADING, ROSY]) {
  const item = biases.find((entry) => entry.id === expected.id);
  if (!item || item.slug !== expected.slug) throw new Error(`${expected.slug}: historical canonical identity is missing.`);
  if (/🔍|💡/u.test(item.description || "")) throw new Error(`${expected.slug}: reviewed top copy must stay plain and marker-free.`);
  if (!/A better check/i.test(item.description || "")) throw new Error(`${expected.slug}: reviewed top copy lost its practical check.`);
}
const declinism = biases.find((entry) => entry.id === DECLINISM.id);
if (!/not proof that a reported decline is imaginary/i.test(declinism.description || "")) throw new Error("Declinism lost the real-decline boundary.");
if (!/Do not use the label to dismiss criticism/i.test(declinism.description || "")) throw new Error("Declinism lost the anti-dismissal rule.");

const evidence = await json("dist/data/evidence.json");
const byReviewSlug = new Map((evidence.reviews || []).map((entry) => [entry.slug, entry]));
for (const expected of [DECLINISM, FADING, ROSY]) if (!byReviewSlug.has(expected.slug)) throw new Error(`${expected.slug}: evidence review is missing.`);
for (const doi of ["10.1006/jesp.1997.1333", "10.1037/1528-3542.6.4.596"]) {
  if (!byReviewSlug.get(ROSY.slug).sources?.some((source) => source.doi === doi)) throw new Error(`Rosy Retrospection evidence is missing ${doi}.`);
}
for (const doi of ["10.1016/B978-0-12-800052-6.00003-2", "10.3389/fpsyg.2025.1608751"]) {
  if (!byReviewSlug.get(FADING.slug).sources?.some((source) => source.doi === doi)) throw new Error(`Fading Affect Bias evidence is missing ${doi}.`);
}

const taxonomy = await json("data/taxonomy-v2.json");
if (!taxonomy.families?.[FAMILY] || taxonomy.families[FAMILY].label !== "Past & present comparison") throw new Error("Past & present comparison family is missing.");
for (const expected of [DECLINISM, FADING, ROSY]) {
  if (taxonomy.recordFamilyOverrides?.[String(expected.id)] !== FAMILY) throw new Error(`${expected.slug}: family mapping is missing.`);
  if (!(taxonomy.recordContexts?.[String(expected.id)] || []).includes(CONTEXT)) throw new Error(`${expected.slug}: past-present context mapping is missing.`);
}

const kinds = await json("data/kinds-v2.json");
if (kinds.recordKindOverrides?.[String(ROSY.id)] !== "phenomenon") throw new Error("Rosy Retrospection must have an explicit controlled kind.");

const contexts = await json("data/contexts.json");
const context = (contexts.entries || []).find((entry) => entry.slug === CONTEXT);
if (!context || context.lenses?.length !== 3) throw new Error("Past-versus-present Decision Guide is missing or has unexpected lens count.");
for (const expected of [DECLINISM, ROSY, FADING]) if (!context.lenses.some((lens) => lens.slug === expected.slug)) throw new Error(`${expected.slug}: missing from past-present guide.`);

const comparisons = await json("data/comparisons.json");
const comparison = (comparisons.entries || []).find((entry) => entry.slug === COMPARISON);
if (!comparison || comparison.leftSlug !== DECLINISM.slug || comparison.rightSlug !== ROSY.slug) throw new Error("Declinism vs Rosy Retrospection comparison is missing.");
if (!/broad trend across time/i.test(comparison.keyDifference || "") || !/personally experienced event/i.test(comparison.keyDifference || "")) throw new Error("Declinism/Rosy comparison lost its level-of-analysis distinction.");

const notes = await json("data/research-notes.json");
const note = (notes.entries || []).find((entry) => entry.slug === RESEARCH);
if (!note || note.sources?.length < 5) throw new Error("Past-versus-present research synthesis is missing or too thin.");
for (const expected of [DECLINISM, FADING, ROSY]) if (!note.related?.includes(expected.slug)) throw new Error(`${expected.slug}: research-note relation is missing.`);
for (const doi of ["10.1038/s41586-023-06137-x", "10.31234/osf.io/32xvw", "10.3389/fpsyg.2025.1608751"]) {
  if (!note.sources?.some((source) => source.doi === doi)) throw new Error(`Past-versus-present research note is missing ${doi}.`);
}

const intents = await json("data/search-intents.json");
const intent = (intents.intents || []).find((entry) => entry.slug === INTENT);
if (!intent || intent.minimumReviewedConcepts !== 3 || !/past only looks better in memory/i.test(intent.question || "")) throw new Error("Past-versus-present search intent is missing or too weak.");

for (const expected of [DECLINISM, FADING, ROSY]) {
  const html = await readFile(resolve("dist", "biases", expected.slug, "index.html"), "utf8");
  for (const required of ['class="evidence-review"', 'data-seo-schema="defined-term"', `/contexts/${CONTEXT}/`, `/research/${RESEARCH}/`]) {
    if (!html.includes(required)) throw new Error(`${expected.slug}: rendered page is missing ${required}.`);
  }
  if (!html.includes(`/tools/decision-audit/?bias=${expected.slug}`)) throw new Error(`${expected.slug}: audit-eligible reviewed page lost its Decision Audit route.`);
}
const declinismHtml = await readFile(resolve("dist", "biases", DECLINISM.slug, "index.html"), "utf8");
if (!declinismHtml.includes(`/compare/${COMPARISON}/`)) throw new Error("Declinism page is missing comparison discovery.");

const contextHtml = await readFile(resolve("dist", "contexts", CONTEXT, "index.html"), "utf8");
if (!contextHtml.includes("Was the past really better?") || !contextHtml.includes(`/biases/${ROSY.slug}/#evidence`) || !contextHtml.includes(`/biases/${FADING.slug}/#evidence`)) throw new Error("Past-versus-present guide is missing visible reviewed links.");
const comparisonHtml = await readFile(resolve("dist", "compare", COMPARISON, "index.html"), "utf8");
if (!comparisonHtml.includes(`/biases/${DECLINISM.slug}/#evidence`) || !comparisonHtml.includes(`/biases/${ROSY.slug}/#evidence`)) throw new Error("Declinism/Rosy comparison does not link both evidence reviews.");
const researchHtml = await readFile(resolve("dist", "research", RESEARCH, "index.html"), "utf8");
if (!researchHtml.includes('data-seo-schema="research-article"') || !researchHtml.includes("10.31234/osf.io/32xvw")) throw new Error("Past-versus-present research page is missing Article metadata or replication DOI.");

const publicBiases = await json("dist/data/biases.json");
const publicContexts = await json("dist/data/contexts.json");
const publicComparisons = await json("dist/data/comparisons.json");
const publicResearch = await json("dist/data/research-notes.json");
for (const expected of [DECLINISM, FADING, ROSY]) if (!publicBiases.some((entry) => entry.id === expected.id && entry.slug === expected.slug)) throw new Error(`${expected.slug}: public concept export is missing.`);
if (!(publicContexts.entries || []).some((entry) => entry.slug === CONTEXT)) throw new Error("Public contexts export is missing the past-present guide.");
if (!(publicComparisons.entries || []).some((entry) => entry.slug === COMPARISON)) throw new Error("Public comparisons export is missing Declinism/Rosy.");
if (!(publicResearch.entries || []).some((entry) => entry.slug === RESEARCH)) throw new Error("Public research export is missing past-present synthesis.");

const sitemap = await readFile("dist/sitemap.xml", "utf8");
for (const url of [`${SITE}/contexts/${CONTEXT}/`, `${SITE}/compare/${COMPARISON}/`, `${SITE}/research/${RESEARCH}/`]) {
  if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`Sitemap is missing ${url}.`);
}

console.log("Past-present cluster check passed: Declinism, Rosy Retrospection and Fading Affect Bias are evidence-reviewed, family-linked, searchable, contextualized and exported consistently.");
