import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const ID = 224;
const SLUG = "framing-effect-core";
const CONTEXT = "presenting-risk-options";
const COMPARISON = "framing-effect-vs-anchoring-effect";
const RESEARCH = "framing-effect-not-all-frames-are-the-same";
const json = async (path) => JSON.parse(await readFile(path, "utf8"));

const curatedFiles = (await readdir("data")).filter((name) => /^curated-concepts(?:-[a-z0-9-]+)?\.json$/i.test(name));
const curatedDocs = await Promise.all(curatedFiles.map((name) => json(`data/${name}`)));
const framing = curatedDocs.flatMap((document) => document.entries || []).find((entry) => entry.slug === SLUG);
if (!framing || framing.id !== ID || framing.status !== "reviewed") throw new Error("Framing Effect must exist as reviewed curated concept #224.");
if (/[🔍💡]/u.test(framing.description || "")) throw new Error("Framing top copy must stay plain and marker-free.");
if (!/Risky-choice, attribute, and goal framing are different research traditions/i.test(framing.description || "")) throw new Error("Framing top copy lost the distinction between framing paradigms.");

const biases = await json("data/biases.json");
const titleMatches = biases.filter((entry) => /^Framing Effect\b/i.test(entry.title || ""));
if (titleMatches.length !== 1 || titleMatches[0].id !== ID) throw new Error(`Prepared corpus must contain exactly one canonical Framing Effect #${ID}; found ${titleMatches.length}.`);

const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map((name) => json(`data/${name}`)));
const review = evidenceDocs.flatMap((document) => document.reviews || []).find((entry) => entry.slug === SLUG);
if (!review || review.sources?.length < 5) throw new Error("Framing Effect needs a source-grounded review with at least five sources.");
if (!review.sources.some((source) => source.doi === "10.1126/science.7455683")) throw new Error("Framing review is missing the foundational 1981 source.");
if (!review.sources.some((source) => source.doi === "10.3758/s13423-025-02771-w")) throw new Error("Framing review is missing the 2026 complete-description replication.");
if (!/goal or message framing is less consistently established/i.test(review.qualification || "")) throw new Error("Framing evidence review lost its evidence-strength qualification.");

const taxonomy = await json("data/taxonomy-v2.json");
if (taxonomy.directCategoryFamily?.["Framing Effect"] !== "valuation-choice") throw new Error("Framing Effect category must map to Valuation & choice.");
if (!taxonomy.recordContexts?.[String(ID)]?.includes(CONTEXT)) throw new Error("Framing Effect taxonomy context is missing.");

const contexts = await json("data/contexts.json");
const context = (contexts.entries || []).find((entry) => entry.slug === CONTEXT);
if (!context) throw new Error("Presenting risk & options context was not merged.");
for (const slug of [SLUG, "cognitive-bias-anchoring-effect", "probability-bias-subadditivity-effect", "heuristic-bias-availability-bias"]) {
  if (!context.lenses?.some((lens) => lens.slug === slug)) throw new Error(`${CONTEXT}: missing reviewed lens ${slug}.`);
}

const comparisons = await json("data/comparisons.json");
const comparison = (comparisons.entries || []).find((entry) => entry.slug === COMPARISON);
if (!comparison || comparison.leftSlug !== SLUG || comparison.rightSlug !== "cognitive-bias-anchoring-effect") throw new Error("Framing vs Anchoring comparison was not merged correctly.");

const notes = await json("data/research-notes.json");
const note = (notes.entries || []).find((entry) => entry.slug === RESEARCH);
if (!note || note.sources?.length < 6 || !note.related?.includes(SLUG)) throw new Error("Framing research synthesis was not merged correctly.");
if (!note.sources.some((source) => source.doi === "10.3758/s13423-025-02771-w")) throw new Error("Framing research synthesis is missing the 2026 replication.");

const framingHtml = await readFile(resolve("dist", "biases", SLUG, "index.html"), "utf8");
for (const required of [
  'class="evidence-review"',
  'data-seo-schema="defined-term"',
  `"termCode":"${ID}"`,
  `/contexts/${CONTEXT}/`,
  `/compare/${COMPARISON}/`
]) if (!framingHtml.includes(required)) throw new Error(`Framing page is missing ${required}.`);

const anchorHtml = await readFile(resolve("dist", "biases", "cognitive-bias-anchoring-effect", "index.html"), "utf8");
if (!anchorHtml.includes(`/compare/${COMPARISON}/`) || !anchorHtml.includes(`/contexts/${CONTEXT}/`)) throw new Error("Anchoring page is missing reciprocal Framing links.");

const contextHtml = await readFile(resolve("dist", "contexts", CONTEXT, "index.html"), "utf8");
for (const slug of [SLUG, "cognitive-bias-anchoring-effect"]) if (!contextHtml.includes(`/biases/${slug}/#evidence`)) throw new Error(`Presentation context does not link ${slug} evidence.`);

const comparisonHtml = await readFile(resolve("dist", "compare", COMPARISON, "index.html"), "utf8");
if (!comparisonHtml.includes(`/biases/${SLUG}/#evidence`) || !comparisonHtml.includes('/biases/cognitive-bias-anchoring-effect/#evidence')) throw new Error("Framing comparison does not link both evidence pages.");

const researchHtml = await readFile(resolve("dist", "research", RESEARCH, "index.html"), "utf8");
if (!researchHtml.includes('data-seo-schema="research-article"') || !researchHtml.includes("10.3758/s13423-025-02771-w")) throw new Error("Framing research page is missing Article metadata or 2026 source.");

const publicBiases = await json("dist/data/biases.json");
const publicContexts = await json("dist/data/contexts.json");
const publicComparisons = await json("dist/data/comparisons.json");
const publicResearch = await json("dist/data/research-notes.json");
if (!publicBiases.some((entry) => entry.slug === SLUG)) throw new Error("Public dataset is missing Framing Effect.");
if (!(publicContexts.entries || []).some((entry) => entry.slug === CONTEXT)) throw new Error("Public dataset is missing presentation context.");
if (!(publicComparisons.entries || []).some((entry) => entry.slug === COMPARISON)) throw new Error("Public dataset is missing Framing comparison.");
if (!(publicResearch.entries || []).some((entry) => entry.slug === RESEARCH)) throw new Error("Public dataset is missing Framing research note.");

const sitemap = await readFile("dist/sitemap.xml", "utf8");
for (const url of [
  `${SITE}/biases/${SLUG}/`,
  `${SITE}/contexts/${CONTEXT}/`,
  `${SITE}/compare/${COMPARISON}/`,
  `${SITE}/research/${RESEARCH}/`
]) if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`Sitemap is missing ${url}.`);

console.log("Framing cluster check passed: canonical concept, differentiated evidence, presentation context, Anchoring comparison, research synthesis, structured data and public exports are aligned.");
