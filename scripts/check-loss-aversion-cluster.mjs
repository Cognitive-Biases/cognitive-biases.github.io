import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const ID = 225;
const SLUG = "prospect-theory-loss-aversion";
const SUNK = "cognitive-bias-sunk-cost-effect";
const FRAMING = "framing-effect-core";
const COMPARISON = "loss-aversion-vs-sunk-cost-effect";
const RESEARCH = "loss-aversion-how-large-and-how-robust";
const CONTEXTS = ["presenting-risk-options", "continue-change-stop-project"];
const json = async (path) => JSON.parse(await readFile(path, "utf8"));

const biases = await json("data/biases.json");
const loss = biases.find((entry) => entry.id === ID);
if (!loss || loss.slug !== SLUG) throw new Error("Loss Aversion #225 canonical record is missing.");
if (!/^Loss Aversion\b/.test(loss.title || "")) throw new Error("Loss Aversion reviewed title is missing.");
if (/🔍|💡/u.test(loss.description || "")) throw new Error("Loss Aversion top copy must stay plain and marker-free.");
if (!/should not be treated as a universal rule/i.test(loss.description || "")) throw new Error("Loss Aversion top copy lost its robustness qualification.");
if (!/Do not apply one universal loss-aversion coefficient/i.test(loss.description || "")) throw new Error("Loss Aversion top copy regressed to a fixed-coefficient rule.");

const evidence = await json("dist/data/evidence.json");
const review = (evidence.reviews || []).find((entry) => entry.slug === SLUG);
if (!review || !/magnitude and robustness debated/i.test(review.evidenceStatus || "")) throw new Error("Loss Aversion evidence status is missing or too strong.");
for (const doi of ["10.2307/1914185", "10.1257/jel.20221698", "10.1016/j.joep.2024.102740", "10.1016/j.joep.2025.102801"]) {
  if (!review.sources?.some((source) => source.doi === doi)) throw new Error(`Loss Aversion evidence review is missing ${doi}.`);
}

const taxonomy = await json("data/taxonomy-v2.json");
if (taxonomy.recordFamilyOverrides?.[String(ID)] !== "valuation-choice") throw new Error("Loss Aversion #225 must map to Valuation & choice.");
for (const context of CONTEXTS) {
  if (!(taxonomy.recordContexts?.[String(ID)] || []).includes(context)) throw new Error(`Loss Aversion taxonomy is missing context ${context}.`);
}

const contexts = await json("data/contexts.json");
for (const slug of CONTEXTS) {
  const context = (contexts.entries || []).find((entry) => entry.slug === slug);
  if (!context || !context.lenses?.some((lens) => lens.slug === SLUG)) throw new Error(`${slug}: Loss Aversion lens is missing.`);
}

const comparisons = await json("data/comparisons.json");
const comparison = (comparisons.entries || []).find((entry) => entry.slug === COMPARISON);
if (!comparison || comparison.leftSlug !== SLUG || comparison.rightSlug !== SUNK) throw new Error("Loss Aversion vs Sunk Cost comparison is missing.");
if (!/possible loss from the current reference point/i.test(comparison.keyDifference || "") || !/already been spent/i.test(comparison.keyDifference || "")) throw new Error("Loss Aversion/Sunk Cost comparison lost its time-direction distinction.");

const notes = await json("data/research-notes.json");
const note = (notes.entries || []).find((entry) => entry.slug === RESEARCH);
if (!note || note.sources?.length < 4) throw new Error("Loss Aversion research synthesis is missing or too thin.");
for (const slug of [SLUG, SUNK, FRAMING]) if (!note.related?.includes(slug)) throw new Error(`Loss Aversion research note is missing related concept ${slug}.`);
for (const doi of ["10.1257/jel.20221698", "10.1016/j.joep.2024.102740", "10.1016/j.joep.2025.102801"]) {
  if (!note.sources?.some((source) => source.doi === doi)) throw new Error(`Loss Aversion research note is missing ${doi}.`);
}

const html = await readFile(resolve("dist", "biases", SLUG, "index.html"), "utf8");
for (const required of ['class="evidence-review"', 'data-seo-schema="defined-term"', `"termCode":"${ID}"`, 'class="research-teaser"', `/research/${RESEARCH}/`, `/compare/${COMPARISON}/`]) {
  if (!html.includes(required)) throw new Error(`Loss Aversion canonical page is missing ${required}.`);
}
for (const context of CONTEXTS) if (!html.includes(`/contexts/${context}/`)) throw new Error(`Loss Aversion page is missing context ${context}.`);

const comparisonHtml = await readFile(resolve("dist", "compare", COMPARISON, "index.html"), "utf8");
if (!comparisonHtml.includes(`/biases/${SLUG}/#evidence`) || !comparisonHtml.includes(`/biases/${SUNK}/#evidence`)) throw new Error("Loss Aversion/Sunk Cost comparison does not link both evidence reviews.");
const researchHtml = await readFile(resolve("dist", "research", RESEARCH, "index.html"), "utf8");
if (!researchHtml.includes('data-seo-schema="research-article"') || !researchHtml.includes("10.1016/j.joep.2025.102801")) throw new Error("Loss Aversion research page is missing Article metadata or re-meta-analysis source.");

const publicBiases = await json("dist/data/biases.json");
const publicComparisons = await json("dist/data/comparisons.json");
const publicResearch = await json("dist/data/research-notes.json");
if (!publicBiases.some((entry) => entry.id === ID && entry.slug === SLUG)) throw new Error("Public dataset is missing Loss Aversion #225.");
if (!(publicComparisons.entries || []).some((entry) => entry.slug === COMPARISON)) throw new Error("Public dataset is missing Loss Aversion/Sunk Cost comparison.");
if (!(publicResearch.entries || []).some((entry) => entry.slug === RESEARCH)) throw new Error("Public dataset is missing Loss Aversion research note.");

const sitemap = await readFile("dist/sitemap.xml", "utf8");
for (const url of [`${SITE}/biases/${SLUG}/`, `${SITE}/compare/${COMPARISON}/`, `${SITE}/research/${RESEARCH}/`]) {
  if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`Sitemap is missing ${url}.`);
}

console.log("Loss Aversion cluster check passed: core #225, competing meta-analyses, risk/project contexts, Sunk Cost comparison, reciprocal research discovery, exports and sitemap are aligned.");
