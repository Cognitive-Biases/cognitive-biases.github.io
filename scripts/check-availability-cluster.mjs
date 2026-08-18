import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const ID = 166;
const SLUG = "heuristic-bias-availability-bias";
const TRUTH = "truth-judgment-illusory-truth-effect";
const COMPARISON = "availability-heuristic-vs-illusory-truth-effect";
const RESEARCH = "availability-heuristic-vivid-does-not-mean-common";
const json = async (path) => JSON.parse(await readFile(path, "utf8"));

const biases = await json("data/biases.json");
const availability = biases.find((entry) => entry.id === ID);
if (!availability || availability.slug !== SLUG) throw new Error("Availability #166 must remain the canonical record.");
if (!/^Availability Heuristic\b/.test(availability.title || "")) throw new Error("Availability public title must identify the construct as a heuristic.");
if (/🔍|💡/u.test(availability.description || "")) throw new Error("Availability reviewed top copy must stay plain and marker-free.");
if (!/This shortcut can be useful when accessible examples really track frequency/i.test(availability.description || "")) throw new Error("Availability top copy lost the adaptive boundary condition.");
if (!/Do not assume that every vivid risk is systematically overestimated/i.test(availability.description || "")) throw new Error("Availability top copy lost the dramatic-risk qualification.");

const evidence = await json("dist/data/evidence.json");
const review = (evidence.reviews || []).find((entry) => entry.slug === SLUG);
if (!review) throw new Error("Availability evidence review is missing.");
if (!/heuristic; bias is context-dependent/i.test(review.evidenceStatus || "")) throw new Error("Availability evidence status must preserve heuristic/bias distinction.");
if (!review.sources?.some((source) => source.doi === "10.1016/0010-0285(73)90033-9")) throw new Error("Availability review is missing the foundational source.");

const contexts = await json("data/contexts.json");
for (const contextSlug of ["checking-claims-misinformation", "presenting-risk-options"]) {
  const context = (contexts.entries || []).find((entry) => entry.slug === contextSlug);
  if (!context?.lenses?.some((lens) => lens.slug === SLUG)) throw new Error(`${contextSlug}: Availability lens is missing.`);
}

const comparisons = await json("data/comparisons.json");
const comparison = (comparisons.entries || []).find((entry) => entry.slug === COMPARISON);
if (!comparison || comparison.leftSlug !== SLUG || comparison.rightSlug !== TRUTH) throw new Error("Availability vs Illusory Truth comparison was not merged correctly.");
if (!/frequency or probability/i.test(comparison.summary || "") || !/true/i.test(comparison.summary || "")) throw new Error("Availability comparison lost the frequency-versus-truth distinction.");

const notes = await json("data/research-notes.json");
const note = (notes.entries || []).find((entry) => entry.slug === RESEARCH);
if (!note || note.sources?.length < 5 || !note.related?.includes(SLUG) || !note.related?.includes(TRUTH)) throw new Error("Availability research synthesis was not merged correctly.");
if (!note.sources.some((source) => source.url === "https://pubmed.ncbi.nlm.nih.gov/38368678/")) throw new Error("Availability research synthesis is missing the 2024 dramatic-risk reanalysis.");
if (!note.sources.some((source) => source.doi === "10.1080/09658211.2021.1882502")) throw new Error("Availability research synthesis is missing the ease-of-retrieval replication test.");

const availabilityHtml = await readFile(resolve("dist", "biases", SLUG, "index.html"), "utf8");
for (const required of [
  'class="evidence-review"',
  'data-seo-schema="defined-term"',
  `"termCode":"${ID}"`,
  `/compare/${COMPARISON}/`,
  '/contexts/checking-claims-misinformation/',
  '/contexts/presenting-risk-options/'
]) if (!availabilityHtml.includes(required)) throw new Error(`Availability page is missing ${required}.`);

const truthHtml = await readFile(resolve("dist", "biases", TRUTH, "index.html"), "utf8");
if (!truthHtml.includes(`/compare/${COMPARISON}/`)) throw new Error("Illusory Truth page is missing reciprocal Availability comparison link.");

const comparisonHtml = await readFile(resolve("dist", "compare", COMPARISON, "index.html"), "utf8");
if (!comparisonHtml.includes(`/biases/${SLUG}/#evidence`) || !comparisonHtml.includes(`/biases/${TRUTH}/#evidence`)) throw new Error("Availability comparison does not link both evidence reviews.");

const researchHtml = await readFile(resolve("dist", "research", RESEARCH, "index.html"), "utf8");
if (!researchHtml.includes('data-seo-schema="research-article"') || !researchHtml.includes("https://pubmed.ncbi.nlm.nih.gov/38368678/")) throw new Error("Availability research page is missing Article metadata or 2024 source.");

const publicBiases = await json("dist/data/biases.json");
const publicComparisons = await json("dist/data/comparisons.json");
const publicResearch = await json("dist/data/research-notes.json");
const publicAvailability = publicBiases.find((entry) => entry.slug === SLUG);
if (!publicAvailability || !/^Availability Heuristic\b/.test(publicAvailability.title || "")) throw new Error("Public dataset does not expose corrected Availability title.");
if (!(publicComparisons.entries || []).some((entry) => entry.slug === COMPARISON)) throw new Error("Public dataset is missing Availability comparison.");
if (!(publicResearch.entries || []).some((entry) => entry.slug === RESEARCH)) throw new Error("Public dataset is missing Availability research note.");

const sitemap = await readFile("dist/sitemap.xml", "utf8");
for (const url of [
  `${SITE}/biases/${SLUG}/`,
  `${SITE}/compare/${COMPARISON}/`,
  `${SITE}/research/${RESEARCH}/`
]) if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`Sitemap is missing ${url}.`);

console.log("Availability cluster check passed: heuristic/bias distinction, evidence, information contexts, Illusory Truth comparison, research synthesis, structured data and exports are aligned.");
