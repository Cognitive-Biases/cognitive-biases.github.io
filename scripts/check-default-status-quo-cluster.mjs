import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const DEFAULT_ID = 58;
const DEFAULT_SLUG = "framing-effect-default-effect";
const STATUS_ID = 78;
const STATUS_SLUG = "prospect-theory-status-quo-bias";
const CONTEXT = "defaults-settings-choice-architecture";
const COMPARISON = "default-effect-vs-status-quo-bias";
const RESEARCH = "defaults-status-quo-preference-choice-architecture";
const FRAMING = "cognitive-bias-framing-effect";
const ANCHORING = "cognitive-bias-anchoring-effect";
const json = async (path) => JSON.parse(await readFile(path, "utf8"));

const biases = await json("data/biases.json");
const defaultEffect = biases.find((entry) => entry.id === DEFAULT_ID);
const statusQuo = biases.find((entry) => entry.id === STATUS_ID);
if (!defaultEffect || defaultEffect.slug !== DEFAULT_SLUG) throw new Error("Default Effect #58 must remain the canonical record.");
if (!statusQuo || statusQuo.slug !== STATUS_SLUG) throw new Error("Status Quo Bias #78 must remain the canonical record.");
if (!/^Default Effect\b/.test(defaultEffect.title || "")) throw new Error("Default Effect reviewed title is missing.");
if (!/^Status Quo Bias\b/.test(statusQuo.title || "")) throw new Error("Status Quo Bias reviewed title is missing.");
for (const entry of [defaultEffect, statusQuo]) {
  if (/🔍|💡/u.test(entry.description || "")) throw new Error(`${entry.slug}: reviewed top copy must stay plain and marker-free.`);
}
if (!/Do not treat staying with the default as proof/i.test(defaultEffect.description || "")) throw new Error("Default Effect top copy lost the preference qualification.");
if (!/Do not assume that staying is irrational/i.test(statusQuo.description || "")) throw new Error("Status Quo top copy lost the legitimate-switching-cost boundary.");

const evidence = await json("dist/data/evidence.json");
const defaultReview = (evidence.reviews || []).find((entry) => entry.slug === DEFAULT_SLUG);
const statusReview = (evidence.reviews || []).find((entry) => entry.slug === STATUS_SLUG);
if (!defaultReview || !/highly context-dependent/i.test(defaultReview.evidenceStatus || "")) throw new Error("Default Effect evidence review/status is missing.");
if (!statusReview || !/broader than interface defaults/i.test(statusReview.evidenceStatus || "")) throw new Error("Status Quo evidence review/status is missing.");
if (!defaultReview.sources?.some((source) => source.doi === "10.1017/bpp.2018.43")) throw new Error("Default Effect review is missing the 2019 meta-analysis.");
if (!statusReview.sources?.some((source) => source.doi === "10.1007/BF00055564")) throw new Error("Status Quo review is missing the 1988 foundational source.");

const taxonomy = await json("data/taxonomy-v2.json");
if (taxonomy.recordFamilyOverrides?.[String(STATUS_ID)] !== "valuation-choice") throw new Error("Status Quo #78 must map to Valuation & choice.");
for (const id of [DEFAULT_ID, STATUS_ID, 222, 224]) {
  if (!(taxonomy.recordContexts?.[String(id)] || []).includes(CONTEXT)) throw new Error(`#${id}: defaults/settings context link is missing from taxonomy.`);
}

const contexts = await json("data/contexts.json");
const context = (contexts.entries || []).find((entry) => entry.slug === CONTEXT);
if (!context) throw new Error("Defaults, settings & choice architecture context is missing.");
for (const slug of [DEFAULT_SLUG, STATUS_SLUG, FRAMING, ANCHORING]) {
  if (!context.lenses?.some((lens) => lens.slug === slug)) throw new Error(`${CONTEXT}: missing reviewed lens ${slug}.`);
}
if (!/Uptake alone is not enough/i.test(context.workflow?.join(" ") || "")) throw new Error("Defaults context lost the welfare/preference qualification.");

const comparisons = await json("data/comparisons.json");
const comparison = (comparisons.entries || []).find((entry) => entry.slug === COMPARISON);
if (!comparison || comparison.leftSlug !== DEFAULT_SLUG || comparison.rightSlug !== STATUS_SLUG) throw new Error("Default Effect vs Status Quo comparison was not merged correctly.");
if (!/choice architecture/i.test(comparison.keyDifference || "") || !/current state/i.test(comparison.keyDifference || "")) throw new Error("Default/Status Quo comparison lost its core distinction.");

const notes = await json("data/research-notes.json");
const note = (notes.entries || []).find((entry) => entry.slug === RESEARCH);
if (!note || note.sources?.length < 5) throw new Error("Defaults/status quo research synthesis is missing or too thin.");
for (const slug of [DEFAULT_SLUG, STATUS_SLUG, FRAMING, ANCHORING]) {
  if (!note.related?.includes(slug)) throw new Error(`Research synthesis is missing related concept ${slug}.`);
}
if (!note.sources.some((source) => source.doi === "10.1038/s44159-025-00471-9")) throw new Error("Research synthesis is missing the 2025 generalizability review.");
if (!note.sources.some((source) => source.doi === "10.1002/arcp.70007")) throw new Error("Research synthesis is missing the 2026 downstream-default review.");

for (const [slug, id] of [[DEFAULT_SLUG, DEFAULT_ID], [STATUS_SLUG, STATUS_ID]]) {
  const html = await readFile(resolve("dist", "biases", slug, "index.html"), "utf8");
  for (const required of [
    'class="evidence-review"',
    'data-seo-schema="defined-term"',
    `"termCode":"${id}"`,
    `/compare/${COMPARISON}/`,
    `/contexts/${CONTEXT}/`
  ]) if (!html.includes(required)) throw new Error(`${slug}: rendered page is missing ${required}.`);
}

const contextHtml = await readFile(resolve("dist", "contexts", CONTEXT, "index.html"), "utf8");
for (const slug of [DEFAULT_SLUG, STATUS_SLUG, FRAMING, ANCHORING]) {
  if (!contextHtml.includes(`/biases/${slug}/#evidence`)) throw new Error(`${CONTEXT}: rendered context does not link ${slug} evidence.`);
}
if (!contextHtml.includes('data-seo-schema="decision-context"')) throw new Error("Defaults context is missing structured data.");

const comparisonHtml = await readFile(resolve("dist", "compare", COMPARISON, "index.html"), "utf8");
if (!comparisonHtml.includes(`/biases/${DEFAULT_SLUG}/#evidence`) || !comparisonHtml.includes(`/biases/${STATUS_SLUG}/#evidence`)) throw new Error("Default/Status Quo comparison does not link both evidence reviews.");

const researchHtml = await readFile(resolve("dist", "research", RESEARCH, "index.html"), "utf8");
if (!researchHtml.includes('data-seo-schema="research-article"') || !researchHtml.includes("10.1017/bpp.2018.43")) throw new Error("Defaults research page is missing Article metadata or meta-analysis source.");

const publicBiases = await json("dist/data/biases.json");
const publicContexts = await json("dist/data/contexts.json");
const publicComparisons = await json("dist/data/comparisons.json");
const publicResearch = await json("dist/data/research-notes.json");
if (!publicBiases.some((entry) => entry.slug === DEFAULT_SLUG && /^Default Effect\b/.test(entry.title || ""))) throw new Error("Public dataset is missing corrected Default Effect.");
if (!publicBiases.some((entry) => entry.slug === STATUS_SLUG && /^Status Quo Bias\b/.test(entry.title || ""))) throw new Error("Public dataset is missing corrected Status Quo Bias.");
if (!(publicContexts.entries || []).some((entry) => entry.slug === CONTEXT)) throw new Error("Public dataset is missing defaults/settings context.");
if (!(publicComparisons.entries || []).some((entry) => entry.slug === COMPARISON)) throw new Error("Public dataset is missing Default/Status Quo comparison.");
if (!(publicResearch.entries || []).some((entry) => entry.slug === RESEARCH)) throw new Error("Public dataset is missing defaults/status quo research note.");

const sitemap = await readFile("dist/sitemap.xml", "utf8");
for (const url of [
  `${SITE}/biases/${DEFAULT_SLUG}/`,
  `${SITE}/biases/${STATUS_SLUG}/`,
  `${SITE}/contexts/${CONTEXT}/`,
  `${SITE}/compare/${COMPARISON}/`,
  `${SITE}/research/${RESEARCH}/`
]) if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`Sitemap is missing ${url}.`);

console.log("Default/status quo cluster check passed: plain-language top copy, evidence, taxonomy, settings context, comparison, research, structured data, exports and sitemap are aligned.");
