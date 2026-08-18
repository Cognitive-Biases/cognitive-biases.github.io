import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const SLUG = "cognitive-bias-anchoring-effect";
const ID = 222;
const COMPARISON = "anchoring-effect-vs-automation-bias";
const RESEARCH = "anchoring-ai-assisted-decisions-first-number";

const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const curated = await json("data/curated-concepts.json");
const curatedAnchoring = (curated.entries || []).find((entry) => entry.slug === SLUG);
if (!curatedAnchoring || curatedAnchoring.id !== ID || curatedAnchoring.status !== "reviewed") throw new Error("Anchoring must exist as reviewed curated concept #222.");
if (/[🔍💡]/u.test(curatedAnchoring.description || "")) throw new Error("Anchoring public top copy must stay plain and marker-free.");
if (!curatedAnchoring.description.includes("Do not assume every number creates the same effect")) throw new Error("Anchoring top copy lost its boundary condition.");

const biases = await json("data/biases.json");
const matching = biases.filter((entry) => entry.slug === SLUG || /^Anchoring (Effect|Bias)\b/i.test(entry.title || ""));
if (matching.length !== 1 || matching[0].id !== ID) throw new Error(`Prepared corpus must contain exactly one canonical Anchoring record #${ID}; found ${matching.length}.`);
if (biases.some((entry) => entry.id === 221)) throw new Error("Retired Automation Bias id #221 must remain unused.");

const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map((name) => json(`data/${name}`)));
const review = evidenceDocs.flatMap((document) => document.reviews || []).find((entry) => entry.slug === SLUG);
if (!review || review.sources?.length < 4) throw new Error("Anchoring needs a source-grounded evidence review with at least four sources.");
if (!review.sources.some((source) => source.doi === "10.1287/mnsc.2023.03238")) throw new Error("Anchoring review must include the 2026 fifty-year meta-analysis.");
if (!/smaller or null effects/i.test(review.qualification || "")) throw new Error("Anchoring evidence review must preserve important boundary conditions.");

const taxonomy = await json("data/taxonomy-v2.json");
if (taxonomy.recordFamilyOverrides?.[String(ID)] !== "valuation-choice") throw new Error("Anchoring must map to Valuation & choice.");

const contexts = await json("data/contexts.json");
for (const slug of ["ai-assisted-decisions", "project-estimation-delivery"]) {
  const context = (contexts.entries || []).find((entry) => entry.slug === slug);
  if (!context?.lenses?.some((lens) => lens.slug === SLUG)) throw new Error(`${slug}: Anchoring lens is missing.`);
}

const comparisons = await json("data/comparisons.json");
const comparison = (comparisons.entries || []).find((entry) => entry.slug === COMPARISON);
if (!comparison || comparison.leftSlug !== SLUG || comparison.rightSlug !== "false-priors-automation-bias") throw new Error("Anchoring vs Automation Bias comparison was not merged into the prepared collection.");

const notes = await json("data/research-notes.json");
const note = (notes.entries || []).find((entry) => entry.slug === RESEARCH);
if (!note || note.sources?.length < 4 || !note.related?.includes(SLUG)) throw new Error("Anchoring AI research synthesis was not merged correctly.");

const biasUrl = `${SITE}/biases/${SLUG}/`;
const biasHtml = await readFile(resolve("dist", "biases", SLUG, "index.html"), "utf8");
for (const required of [
  'class="evidence-review"',
  'data-seo-schema="defined-term"',
  `"termCode":"${ID}"`,
  '/contexts/ai-assisted-decisions/',
  '/contexts/project-estimation-delivery/',
  `/compare/${COMPARISON}/`
]) if (!biasHtml.includes(required)) throw new Error(`Anchoring page is missing ${required}.`);

const comparisonHtml = await readFile(resolve("dist", "compare", COMPARISON, "index.html"), "utf8");
if (!comparisonHtml.includes(`/biases/${SLUG}/#evidence`) || !comparisonHtml.includes('/biases/false-priors-automation-bias/#evidence')) throw new Error("Anchoring comparison does not link both evidence reviews.");

const researchHtml = await readFile(resolve("dist", "research", RESEARCH, "index.html"), "utf8");
if (!researchHtml.includes('data-seo-schema="research-article"') || !researchHtml.includes("10.1007/s42001-025-00435-2")) throw new Error("Anchoring research page is missing Article metadata or the peer-reviewed LLM source.");

const publicBiases = await json("dist/data/biases.json");
const publicComparisons = await json("dist/data/comparisons.json");
const publicResearch = await json("dist/data/research-notes.json");
if (!publicBiases.some((entry) => entry.slug === SLUG)) throw new Error("Public dataset is missing Anchoring.");
if (!(publicComparisons.entries || []).some((entry) => entry.slug === COMPARISON)) throw new Error("Public dataset is missing Anchoring comparison.");
if (!(publicResearch.entries || []).some((entry) => entry.slug === RESEARCH)) throw new Error("Public dataset is missing Anchoring research note.");

const sitemap = await readFile("dist/sitemap.xml", "utf8");
for (const url of [biasUrl, `${SITE}/compare/${COMPARISON}/`, `${SITE}/research/${RESEARCH}/`]) {
  if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`Sitemap is missing ${url}.`);
}

console.log("Anchoring cluster check passed: canonical concept, evidence, taxonomy, AI/project contexts, comparison, research synthesis, structured data and public exports are aligned.");
