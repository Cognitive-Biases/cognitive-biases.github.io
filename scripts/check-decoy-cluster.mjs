import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const ID = 220;
const SLUG = "framing-effect-decoy-effect";
const DEFAULT = "framing-effect-default-effect";
const ANCHORING = "cognitive-bias-anchoring-effect";
const FRAMING = "framing-effect-core";
const CONTEXT = "comparing-plans-pricing";
const COMPARISON = "decoy-effect-vs-default-effect";
const RESEARCH = "decoy-effect-pricing-choice-sets";
const json = async (path) => JSON.parse(await readFile(path, "utf8"));

const biases = await json("data/biases.json");
const decoy = biases.find((entry) => entry.id === ID);
if (!decoy || decoy.slug !== SLUG) throw new Error("Decoy Effect must resolve to repaired canonical #220.");
if (!/^Decoy Effect\b/.test(decoy.title || "")) throw new Error("Decoy Effect reviewed title is missing.");
if (/🔍|💡/u.test(decoy.description || "")) throw new Error("Decoy reviewed top copy must stay plain and marker-free.");
if (/marketing trick designed/i.test(decoy.description || "")) throw new Error("Decoy top copy regressed to the legacy marketing-trick claim.");
if (!/Do not assume that every three-tier price table creates a decoy effect/i.test(decoy.description || "")) throw new Error("Decoy top copy lost its context-dependent boundary.");

const evidence = await json("dist/data/evidence.json");
const review = (evidence.reviews || []).find((entry) => entry.slug === SLUG);
if (!review || !/well documented, context-dependent/i.test(review.evidenceStatus || "")) throw new Error("Decoy evidence review/status is missing.");
for (const doi of ["10.1177/002224379202900301", "10.1016/j.joep.2019.05.007", "10.1080/23743603.2021.1878340", "10.1002/mar.22076"]) {
  if (!review.sources?.some((source) => source.doi === doi)) throw new Error(`Decoy evidence review is missing ${doi}.`);
}

const taxonomy = await json("data/taxonomy-v2.json");
for (const id of [58, 220, 222, 224]) {
  if (!(taxonomy.recordContexts?.[String(id)] || []).includes(CONTEXT)) throw new Error(`#${id}: plans/pricing context link is missing from taxonomy.`);
}

const contexts = await json("data/contexts.json");
const context = (contexts.entries || []).find((entry) => entry.slug === CONTEXT);
if (!context) throw new Error("Comparing plans & pricing context is missing.");
for (const slug of [SLUG, DEFAULT, ANCHORING, FRAMING]) {
  if (!context.lenses?.some((lens) => lens.slug === slug)) throw new Error(`${CONTEXT}: missing reviewed lens ${slug}.`);
}
if (!/Remove any suspected decoy/i.test(context.workflow?.join(" ") || "")) throw new Error("Pricing context lost the remove-the-decoy diagnostic.");

const comparisons = await json("data/comparisons.json");
const comparison = (comparisons.entries || []).find((entry) => entry.slug === COMPARISON);
if (!comparison || comparison.leftSlug !== SLUG || comparison.rightSlug !== DEFAULT) throw new Error("Decoy vs Default comparison was not merged correctly.");
if (!/inferior comparison option/i.test(comparison.keyDifference || "") || !/automatic outcome/i.test(comparison.keyDifference || "")) throw new Error("Decoy/Default comparison lost its core distinction.");

const notes = await json("data/research-notes.json");
const note = (notes.entries || []).find((entry) => entry.slug === RESEARCH);
if (!note || note.sources?.length < 4) throw new Error("Decoy pricing research synthesis is missing or too thin.");
for (const slug of [SLUG, DEFAULT, ANCHORING, FRAMING]) {
  if (!note.related?.includes(slug)) throw new Error(`Decoy research synthesis is missing related concept ${slug}.`);
}
if (!note.sources.some((source) => source.doi === "10.1002/mar.22076")) throw new Error("Decoy research synthesis is missing the 2024 integrative review.");
if (!note.sources.some((source) => source.doi === "10.1080/23743603.2021.1878340")) throw new Error("Decoy research synthesis is missing the preregistered replication.");

const decoyHtml = await readFile(resolve("dist", "biases", SLUG, "index.html"), "utf8");
for (const required of [
  'class="evidence-review"',
  'data-seo-schema="defined-term"',
  `"termCode":"${ID}"`,
  `/compare/${COMPARISON}/`,
  `/contexts/${CONTEXT}/`
]) if (!decoyHtml.includes(required)) throw new Error(`Decoy page is missing ${required}.`);

const defaultHtml = await readFile(resolve("dist", "biases", DEFAULT, "index.html"), "utf8");
if (!defaultHtml.includes(`/compare/${COMPARISON}/`)) throw new Error("Default Effect page is missing reciprocal Decoy comparison link.");
if (!defaultHtml.includes(`/contexts/${CONTEXT}/`)) throw new Error("Default Effect page is missing pricing context link.");

const contextHtml = await readFile(resolve("dist", "contexts", CONTEXT, "index.html"), "utf8");
for (const slug of [SLUG, DEFAULT, ANCHORING, FRAMING]) {
  if (!contextHtml.includes(`/biases/${slug}/#evidence`)) throw new Error(`${CONTEXT}: rendered context does not link ${slug} evidence.`);
}
if (!contextHtml.includes('data-seo-schema="decision-context"')) throw new Error("Pricing context is missing structured data.");

const comparisonHtml = await readFile(resolve("dist", "compare", COMPARISON, "index.html"), "utf8");
if (!comparisonHtml.includes(`/biases/${SLUG}/#evidence`) || !comparisonHtml.includes(`/biases/${DEFAULT}/#evidence`)) throw new Error("Decoy/Default comparison does not link both evidence reviews.");

const researchHtml = await readFile(resolve("dist", "research", RESEARCH, "index.html"), "utf8");
if (!researchHtml.includes('data-seo-schema="research-article"') || !researchHtml.includes("10.1002/mar.22076")) throw new Error("Decoy research page is missing Article metadata or 2024 review source.");

const publicBiases = await json("dist/data/biases.json");
const publicContexts = await json("dist/data/contexts.json");
const publicComparisons = await json("dist/data/comparisons.json");
const publicResearch = await json("dist/data/research-notes.json");
if (!publicBiases.some((entry) => entry.id === ID && entry.slug === SLUG && /^Decoy Effect\b/.test(entry.title || ""))) throw new Error("Public dataset is missing corrected Decoy Effect #220.");
if (!(publicContexts.entries || []).some((entry) => entry.slug === CONTEXT)) throw new Error("Public dataset is missing plans/pricing context.");
if (!(publicComparisons.entries || []).some((entry) => entry.slug === COMPARISON)) throw new Error("Public dataset is missing Decoy/Default comparison.");
if (!(publicResearch.entries || []).some((entry) => entry.slug === RESEARCH)) throw new Error("Public dataset is missing Decoy research note.");

const sitemap = await readFile("dist/sitemap.xml", "utf8");
for (const url of [
  `${SITE}/biases/${SLUG}/`,
  `${SITE}/contexts/${CONTEXT}/`,
  `${SITE}/compare/${COMPARISON}/`,
  `${SITE}/research/${RESEARCH}/`
]) if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`Sitemap is missing ${url}.`);

console.log("Decoy/pricing cluster check passed: canonical #220, evidence, pricing context, Default comparison, research, structured data, exports and sitemap are aligned.");
