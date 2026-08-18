import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const CONFIRMATION = { id: 170, slug: "cognitive-bias-confirmation-bias" };
const CONGRUENCE = { id: 22, slug: "confirmation-bias-congruence-bias" };
const CONTEXT = "checking-claims-misinformation";
const COMPARISON = "confirmation-bias-vs-congruence-bias";
const RESEARCH = "confirmation-bias-is-more-than-seeking-agreeable-information";
const INTENT = "information-verification";
const json = async (path) => JSON.parse(await readFile(path, "utf8"));

const biases = await json("data/biases.json");
for (const expected of [CONFIRMATION, CONGRUENCE]) {
  const item = biases.find((entry) => entry.id === expected.id);
  if (!item || item.slug !== expected.slug) throw new Error(`${expected.slug}: canonical identity is missing.`);
  if (/🔍|💡/u.test(item.description || "")) throw new Error(`${expected.slug}: reviewed copy must stay plain and marker-free.`);
  if (!/A better check/i.test(item.description || "")) throw new Error(`${expected.slug}: practical check is missing.`);
}
const confirmation = biases.find((entry) => entry.id === CONFIRMATION.id);
const congruence = biases.find((entry) => entry.id === CONGRUENCE.id);
if (!/broad label/i.test(confirmation.description || "") || !/same evidence standard/i.test(confirmation.description || "")) throw new Error("Confirmation Bias lost its broad-construct or equal-standard boundary.");
if (!/weak diagnostic value/i.test(congruence.description || "") || !/not treat every positive-test strategy as an error/i.test(congruence.description || "")) throw new Error("Congruence Bias lost its diagnosticity or positive-test boundary.");

const evidence = await json("dist/data/evidence.json");
const reviews = new Map((evidence.reviews || []).map((entry) => [entry.slug, entry]));
for (const expected of [CONFIRMATION, CONGRUENCE]) if (!reviews.has(expected.slug)) throw new Error(`${expected.slug}: evidence review is missing.`);
if (!/broad construct/i.test(reviews.get(CONFIRMATION.slug).evidenceStatus || "")) throw new Error("Confirmation Bias evidence status must remain broad/qualified.");
for (const doi of ["10.1016/0749-5978(88)90012-2", "10.1037/0033-295X.94.2.211"]) {
  if (!reviews.get(CONGRUENCE.slug).sources?.some((source) => source.doi === doi)) throw new Error(`Congruence Bias evidence is missing ${doi}.`);
}

const taxonomy = await json("data/taxonomy-v2.json");
const familyFor = (item) => taxonomy.recordFamilyOverrides?.[String(item.id)] || taxonomy.directCategoryFamily?.[item.typeOfBias] || null;
if (familyFor(confirmation) !== "belief-updating" || familyFor(congruence) !== "belief-updating") throw new Error("Confirmation and Congruence must both resolve to Belief updating.");

const contexts = await json("data/contexts.json");
const context = (contexts.entries || []).find((entry) => entry.slug === CONTEXT);
if (!context) throw new Error("Checking claims context is missing.");
for (const expected of [CONFIRMATION, CONGRUENCE]) if (!context.lenses?.some((lens) => lens.slug === expected.slug)) throw new Error(`${expected.slug}: missing from checking-claims context.`);
if (!context.workflow?.some((step) => /alternative explanation/i.test(step) && /predictions differ/i.test(step))) throw new Error("Checking-claims workflow lost the diagnostic-alternatives step.");

const comparisons = await json("data/comparisons.json");
const comparison = (comparisons.entries || []).find((entry) => entry.slug === COMPARISON);
if (!comparison || comparison.leftSlug !== CONFIRMATION.slug || comparison.rightSlug !== CONGRUENCE.slug) throw new Error("Confirmation vs Congruence comparison is missing.");
if (!/broad evidence processing/i.test(comparison.keyDifference || "") || !/insufficiently diagnostic/i.test(comparison.keyDifference || "")) throw new Error("Confirmation/Congruence comparison lost its scope distinction.");

const notes = await json("data/research-notes.json");
const note = (notes.entries || []).find((entry) => entry.slug === RESEARCH);
if (!note || note.sources?.length < 4) throw new Error("Confirmation research synthesis is missing or too thin.");
for (const expected of [CONFIRMATION, CONGRUENCE]) if (!note.related?.includes(expected.slug)) throw new Error(`${expected.slug}: research relation is missing.`);
for (const doi of ["10.1080/17470216008416717", "10.1037/0033-295X.94.2.211", "10.1016/0749-5978(88)90012-2", "10.1037/1089-2680.2.2.175"]) {
  if (!note.sources?.some((source) => source.doi === doi)) throw new Error(`Confirmation research note is missing ${doi}.`);
}

const intents = await json("data/search-intents.json");
const intent = (intents.intents || []).find((entry) => entry.slug === INTENT);
if (!intent || intent.minimumReviewedConcepts < 3 || !intent.terms?.includes("congruence") || !intent.terms?.includes("hypothesis")) throw new Error("Information-verification intent does not expose diagnostic hypothesis testing.");

for (const expected of [CONFIRMATION, CONGRUENCE]) {
  const html = await readFile(resolve("dist", "biases", expected.slug, "index.html"), "utf8");
  for (const required of ['class="evidence-review"', 'data-seo-schema="defined-term"', `/contexts/${CONTEXT}/`, `/research/${RESEARCH}/`, `/compare/${COMPARISON}/`]) {
    if (!html.includes(required)) throw new Error(`${expected.slug}: rendered page is missing ${required}.`);
  }
  if (!html.includes(`/tools/decision-audit/?bias=${expected.slug}`)) throw new Error(`${expected.slug}: reviewed page lost its Decision Audit route.`);
}

const contextHtml = await readFile(resolve("dist", "contexts", CONTEXT, "index.html"), "utf8");
if (!contextHtml.includes(`/biases/${CONGRUENCE.slug}/#evidence`) || !contextHtml.includes(`/tools/decision-audit/?bias=${CONGRUENCE.slug}`)) throw new Error("Checking-claims page does not expose Congruence evidence and Audit route.");
const comparisonHtml = await readFile(resolve("dist", "compare", COMPARISON, "index.html"), "utf8");
if (!comparisonHtml.includes(`/biases/${CONFIRMATION.slug}/#evidence`) || !comparisonHtml.includes(`/biases/${CONGRUENCE.slug}/#evidence`)) throw new Error("Confirmation/Congruence comparison does not link both evidence reviews.");
const researchHtml = await readFile(resolve("dist", "research", RESEARCH, "index.html"), "utf8");
if (!researchHtml.includes('data-seo-schema="research-article"') || !researchHtml.includes("10.1016/0749-5978(88)90012-2")) throw new Error("Confirmation research page is missing Article metadata or Congruence source.");

const publicBiases = await json("dist/data/biases.json");
const publicContexts = await json("dist/data/contexts.json");
const publicComparisons = await json("dist/data/comparisons.json");
const publicResearch = await json("dist/data/research-notes.json");
for (const expected of [CONFIRMATION, CONGRUENCE]) if (!publicBiases.some((entry) => entry.id === expected.id && entry.slug === expected.slug)) throw new Error(`${expected.slug}: public concept export is missing.`);
if (!(publicContexts.entries || []).some((entry) => entry.slug === CONTEXT && entry.lenses?.some((lens) => lens.slug === CONGRUENCE.slug))) throw new Error("Public contexts export is missing Congruence in claim checking.");
if (!(publicComparisons.entries || []).some((entry) => entry.slug === COMPARISON)) throw new Error("Public comparisons export is missing Confirmation/Congruence.");
if (!(publicResearch.entries || []).some((entry) => entry.slug === RESEARCH)) throw new Error("Public research export is missing Confirmation synthesis.");

const sitemap = await readFile("dist/sitemap.xml", "utf8");
for (const url of [`${SITE}/compare/${COMPARISON}/`, `${SITE}/research/${RESEARCH}/`, `${SITE}/contexts/${CONTEXT}/`]) {
  if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`Sitemap is missing ${url}.`);
}

console.log("Confirmation/Congruence cluster check passed: broad confirmation, diagnostic hypothesis testing, claim-checking workflow, search intent, research, comparison and exports are aligned.");
