import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const PLANNING = "egocentric-bias-planning-fallacy";
const ANCHORING = "cognitive-bias-anchoring-effect";
const COMPARISON = "planning-fallacy-vs-anchoring-effect";
const RESEARCH = "planning-fallacy-why-the-outside-view-needs-good-data";
const CONTEXT = "project-estimation-delivery";
const INTENT = "forecasting-estimation";
const json = async (path) => JSON.parse(await readFile(path, "utf8"));

const evidence = await json("dist/data/evidence.json");
const planningReview = (evidence.reviews || []).find((entry) => entry.slug === PLANNING);
if (!planningReview || !/well-supported for time estimates/i.test(planningReview.evidenceStatus || "")) throw new Error("Planning Fallacy evidence review is missing or too broad.");
for (const doi of ["10.1037/0022-3514.67.3.366", "10.1016/S0065-2601(10)43001-4", "10.1016/j.plas.2023.100103", "10.1080/09537287.2025.2578708"]) {
  if (!planningReview.sources?.some((source) => source.doi === doi)) throw new Error(`Planning Fallacy evidence is missing ${doi}.`);
}
if (!/genuinely relevant class/i.test(planningReview.practical || "") || !/trustworthy historical data/i.test(planningReview.practical || "")) throw new Error("Planning Fallacy practical guidance lost the reference-class quality boundary.");
if (/multiply by 1\.5/i.test(planningReview.practical || "")) throw new Error("Planning Fallacy regressed to a universal fixed buffer.");

const comparisons = await json("data/comparisons.json");
const comparison = (comparisons.entries || []).find((entry) => entry.slug === COMPARISON);
if (!comparison || comparison.leftSlug !== PLANNING || comparison.rightSlug !== ANCHORING) throw new Error("Planning Fallacy vs Anchoring comparison is missing.");
if (!/current plan receives more weight/i.test(comparison.keyDifference || "") || !/starting number is pulling/i.test(comparison.keyDifference || "")) throw new Error("Planning/Anchoring comparison lost its inside-view versus starting-number distinction.");
if (!comparison.sources?.some((source) => source.doi === "10.2466/pr0.96.2.253-256")) throw new Error("Planning/Anchoring comparison is missing the verified task-duration anchoring source.");
if (comparison.sources?.some((source) => source.doi === "10.1006/obhd.1996.0047")) throw new Error("Planning/Anchoring comparison contains the unrelated negotiation sunk-cost DOI.");

const notes = await json("data/research-notes.json");
const note = (notes.entries || []).find((entry) => entry.slug === RESEARCH);
if (!note || note.sources?.length < 5) throw new Error("Planning outside-view research note is missing or too thin.");
for (const slug of [PLANNING, ANCHORING]) if (!note.related?.includes(slug)) throw new Error(`Planning research note is missing related concept ${slug}.`);
for (const doi of ["10.1080/09537287.2025.2578708", "10.2466/pr0.96.2.253-256"]) {
  if (!note.sources?.some((source) => source.doi === doi)) throw new Error(`Planning research note is missing ${doi}.`);
}

const intents = await json("data/search-intents.json");
const intent = (intents.intents || []).find((entry) => entry.slug === INTENT);
if (!intent || intent.minimumReviewedConcepts < 3) throw new Error("Forecasting-estimation intent is missing or too weak.");
for (const term of ["planning fallacy", "reference class", "outside view", "base rate", "anchor"]) if (!intent.terms?.includes(term)) throw new Error(`Forecasting-estimation intent is missing term ${term}.`);

const contexts = await json("data/contexts.json");
const context = (contexts.entries || []).find((entry) => entry.slug === CONTEXT);
if (!context || !context.lenses?.some((lens) => lens.slug === PLANNING) || !context.lenses?.some((lens) => lens.slug === ANCHORING)) throw new Error("Project estimation context must contain both Planning Fallacy and Anchoring.");

for (const slug of [PLANNING, ANCHORING]) {
  const html = await readFile(resolve("dist", "biases", slug, "index.html"), "utf8");
  for (const required of ['class="evidence-review"', `/research/${RESEARCH}/`, `/compare/${COMPARISON}/`, `/contexts/${CONTEXT}/`]) {
    if (!html.includes(required)) throw new Error(`${slug}: rendered page is missing ${required}.`);
  }
}

const comparisonHtml = await readFile(resolve("dist", "compare", COMPARISON, "index.html"), "utf8");
if (!comparisonHtml.includes(`/biases/${PLANNING}/#evidence`) || !comparisonHtml.includes(`/biases/${ANCHORING}/#evidence`)) throw new Error("Planning/Anchoring comparison does not link both evidence reviews.");
const researchHtml = await readFile(resolve("dist", "research", RESEARCH, "index.html"), "utf8");
if (!researchHtml.includes('data-seo-schema="research-article"') || !researchHtml.includes("10.1080/09537287.2025.2578708")) throw new Error("Planning research page is missing Article metadata or current RCF review.");

const publicComparisons = await json("dist/data/comparisons.json");
const publicResearch = await json("dist/data/research-notes.json");
if (!(publicComparisons.entries || []).some((entry) => entry.slug === COMPARISON)) throw new Error("Public comparisons export is missing Planning/Anchoring.");
if (!(publicResearch.entries || []).some((entry) => entry.slug === RESEARCH)) throw new Error("Public research export is missing Planning outside-view note.");

const sitemap = await readFile("dist/sitemap.xml", "utf8");
for (const url of [`${SITE}/compare/${COMPARISON}/`, `${SITE}/research/${RESEARCH}/`]) {
  if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`Sitemap is missing ${url}.`);
}

console.log("Planning outside-view check passed: current evidence, reference-class limits, Planning-vs-Anchoring distinction, search intent, research discovery and exports are aligned.");
