import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const ID = 93;
const SLUG = "cognitive-bias-curse-of-knowledge";
const DUNNING = "self-assessment-dunning";
const COMPARISON = "curse-of-knowledge-vs-dunning-kruger-effect";
const RESEARCH = "curse-of-knowledge-experts-beginners-feedback";
const json = async (path) => JSON.parse(await readFile(path, "utf8"));

const biases = await json("data/biases.json");
const curse = biases.find((entry) => entry.id === ID);
if (!curse || curse.slug !== SLUG) throw new Error("Curse of Knowledge #93 canonical record is missing.");
if (!/what you know distorts what you expect others to know/i.test(curse.title || "")) throw new Error("Curse of Knowledge reviewed title is missing.");
if (/🔍|💡/u.test(curse.description || "")) throw new Error("Curse of Knowledge top copy must stay plain and marker-free.");
if (!/perspective-taking bias/i.test(curse.description || "")) throw new Error("Curse of Knowledge top copy lost the perspective-taking definition.");
if (!/does not mean experts cannot teach beginners/i.test(curse.description || "")) throw new Error("Curse of Knowledge top copy lost its expertise qualification.");

const evidence = await json("dist/data/evidence.json");
const review = (evidence.reviews || []).find((entry) => entry.slug === SLUG);
if (!review || !/supported across several perspective-taking tasks/i.test(review.evidenceStatus || "")) throw new Error("Curse of Knowledge evidence review/status is missing.");
for (const doi of ["10.1086/261651", "10.1016/j.cognition.2017.04.015", "10.1177/1747021820987080"]) {
  if (!review.sources?.some((source) => source.doi === doi)) throw new Error(`Curse of Knowledge evidence review is missing ${doi}.`);
}

const taxonomy = await json("data/taxonomy-v2.json");
if (taxonomy.recordFamilyOverrides?.[String(ID)] !== "social-judgment") throw new Error("Curse of Knowledge #93 must map to Social judgment.");

const comparisons = await json("data/comparisons.json");
const comparison = (comparisons.entries || []).find((entry) => entry.slug === COMPARISON);
if (!comparison || comparison.leftSlug !== SLUG || comparison.rightSlug !== DUNNING) throw new Error("Curse of Knowledge vs Dunning-Kruger comparison is missing.");
if (!/another person's perspective/i.test(comparison.keyDifference || "") || !/own performance/i.test(comparison.keyDifference || "")) throw new Error("Curse/Dunning comparison lost its target-of-judgment distinction.");

const notes = await json("data/research-notes.json");
const note = (notes.entries || []).find((entry) => entry.slug === RESEARCH);
if (!note || note.sources?.length < 3) throw new Error("Curse of Knowledge research synthesis is missing or too thin.");
for (const slug of [SLUG, DUNNING]) if (!note.related?.includes(slug)) throw new Error(`Curse research note is missing related concept ${slug}.`);
if (!note.sources.some((source) => source.doi === "10.1177/1747021820987080")) throw new Error("Curse research note is missing the perspective-feedback experiments.");

const curseHtml = await readFile(resolve("dist", "biases", SLUG, "index.html"), "utf8");
for (const required of ['class="evidence-review"', 'data-seo-schema="defined-term"', `"termCode":"${ID}"`, 'class="research-teaser"', `/research/${RESEARCH}/`, `/compare/${COMPARISON}/`]) {
  if (!curseHtml.includes(required)) throw new Error(`Curse of Knowledge canonical page is missing ${required}.`);
}
const dunningHtml = await readFile(resolve("dist", "biases", DUNNING, "index.html"), "utf8");
if (!dunningHtml.includes(`/compare/${COMPARISON}/`)) throw new Error("Dunning-Kruger page is missing reciprocal Curse comparison link.");

const comparisonHtml = await readFile(resolve("dist", "compare", COMPARISON, "index.html"), "utf8");
if (!comparisonHtml.includes(`/biases/${SLUG}/#evidence`) || !comparisonHtml.includes(`/biases/${DUNNING}/#evidence`)) throw new Error("Curse/Dunning comparison does not link both evidence reviews.");
const researchHtml = await readFile(resolve("dist", "research", RESEARCH, "index.html"), "utf8");
if (!researchHtml.includes('data-seo-schema="research-article"') || !researchHtml.includes("10.1177/1747021820987080")) throw new Error("Curse research page is missing Article metadata or feedback source.");

const publicBiases = await json("dist/data/biases.json");
const publicComparisons = await json("dist/data/comparisons.json");
const publicResearch = await json("dist/data/research-notes.json");
if (!publicBiases.some((entry) => entry.id === ID && entry.slug === SLUG && /distorts what you expect others to know/i.test(entry.title || ""))) throw new Error("Public dataset is missing corrected Curse of Knowledge #93.");
if (!(publicComparisons.entries || []).some((entry) => entry.slug === COMPARISON)) throw new Error("Public dataset is missing Curse/Dunning comparison.");
if (!(publicResearch.entries || []).some((entry) => entry.slug === RESEARCH)) throw new Error("Public dataset is missing Curse research note.");

const sitemap = await readFile("dist/sitemap.xml", "utf8");
for (const url of [`${SITE}/biases/${SLUG}/`, `${SITE}/compare/${COMPARISON}/`, `${SITE}/research/${RESEARCH}/`]) {
  if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`Sitemap is missing ${url}.`);
}

console.log("Curse of Knowledge cluster check passed: plain top copy, Social judgment family, evidence, Dunning comparison, reciprocal research discovery, exports and sitemap are aligned.");
