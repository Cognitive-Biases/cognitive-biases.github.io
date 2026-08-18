import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const ID = 123;
const SLUG = "cognitive-bias-surrogation";
const SYSTEMATIC = "cognitive-bias-systematic-bias";
const ANCHORING = "cognitive-bias-anchoring-effect";
const CONFIRMATION = "cognitive-bias-confirmation-bias";
const OUTCOME = "cognitive-bias-outcome-bias";
const COMPARISON = "surrogation-vs-systematic-bias";
const RESEARCH = "surrogation-when-a-kpi-starts-replacing-the-goal";
const CONTEXT = "reviewing-kpis-proxy-metrics";
const json = async (path) => JSON.parse(await readFile(path, "utf8"));

const biases = await json("data/biases.json");
const item = biases.find((entry) => entry.id === ID);
if (!item || item.slug !== SLUG) throw new Error("Surrogation #123 canonical record is missing.");
if (!/^Surrogation\b/.test(item.title || "")) throw new Error("Surrogation reviewed title is missing.");
if (/🔍|💡/u.test(item.description || "")) throw new Error("Surrogation top copy must stay plain and marker-free.");
if (!/performance measure starts to be treated as though it were the strategic objective/i.test(item.description || "")) throw new Error("Surrogation top copy lost the construct-versus-measure distinction.");
if (!/not treat Surrogation as a synonym for every metric problem/i.test(item.description || "")) throw new Error("Surrogation top copy lost its scope boundary.");

const evidence = await json("dist/data/evidence.json");
const review = (evidence.reviews || []).find((entry) => entry.slug === SLUG);
if (!review || !/strategic performance-measure settings/i.test(review.evidenceStatus || "")) throw new Error("Surrogation evidence status is missing or too broad.");
for (const doi of ["10.1111/j.1475-679X.2012.00465.x", "10.2308/accr-52277"]) {
  if (!review.sources?.some((source) => source.doi === doi)) throw new Error(`Surrogation evidence review is missing ${doi}.`);
}

const taxonomy = await json("data/taxonomy-v2.json");
if (taxonomy.recordFamilyOverrides?.[String(ID)] !== "goals-proxies-incentives") throw new Error("Surrogation #123 must map to Goals, proxies & incentives.");
if (!(taxonomy.recordContexts?.[String(ID)] || []).includes(CONTEXT)) throw new Error("Surrogation taxonomy is missing the KPI context.");
for (const id of [111, 170, 222]) {
  if (!(taxonomy.recordContexts?.[String(id)] || []).includes(CONTEXT)) throw new Error(`KPI context taxonomy is missing lens id ${id}.`);
}

const contexts = await json("data/contexts.json");
const context = (contexts.entries || []).find((entry) => entry.slug === CONTEXT);
if (!context) throw new Error("KPI/proxy-metric context is missing.");
for (const slug of [SLUG, ANCHORING, CONFIRMATION, OUTCOME]) {
  if (!context.lenses?.some((lens) => lens.slug === slug)) throw new Error(`KPI context is missing ${slug}.`);
}
if (context.lenses?.some((lens) => lens.slug === SYSTEMATIC)) throw new Error("Audit-ineligible Systematic Bias must not be used as a Decision Audit context lens.");

const comparisons = await json("data/comparisons.json");
const comparison = (comparisons.entries || []).find((entry) => entry.slug === COMPARISON);
if (!comparison || comparison.leftSlug !== SLUG || comparison.rightSlug !== SYSTEMATIC) throw new Error("Surrogation vs Systematic Bias comparison is missing.");
if (!/optimizing or interpreting the proxy as the goal/i.test(comparison.keyDifference || "") || !/measurement process itself/i.test(comparison.keyDifference || "")) throw new Error("Surrogation/Systematic comparison lost its core distinction.");

const notes = await json("data/research-notes.json");
const note = (notes.entries || []).find((entry) => entry.slug === RESEARCH);
if (!note || note.sources?.length < 2) throw new Error("Surrogation research synthesis is missing or too thin.");
for (const slug of [SLUG, SYSTEMATIC]) if (!note.related?.includes(slug)) throw new Error(`Surrogation research note is missing related concept ${slug}.`);

const html = await readFile(resolve("dist", "biases", SLUG, "index.html"), "utf8");
for (const required of ['class="evidence-review"', 'data-seo-schema="defined-term"', `"termCode":"${ID}"`, 'class="research-teaser"', `/research/${RESEARCH}/`, `/compare/${COMPARISON}/`, `/contexts/${CONTEXT}/`]) {
  if (!html.includes(required)) throw new Error(`Surrogation canonical page is missing ${required}.`);
}

const contextHtml = await readFile(resolve("dist", "contexts", CONTEXT, "index.html"), "utf8");
if (!contextHtml.includes("Reviewing KPIs &amp; proxy metrics") || !contextHtml.includes(`/biases/${SLUG}/#evidence`)) throw new Error("KPI context page is missing its title or Surrogation evidence link.");
for (const slug of [SLUG, ANCHORING, CONFIRMATION, OUTCOME]) {
  if (!contextHtml.includes(`/tools/decision-audit/?bias=${slug}`)) throw new Error(`KPI context is missing Decision Audit route for ${slug}.`);
}

const comparisonHtml = await readFile(resolve("dist", "compare", COMPARISON, "index.html"), "utf8");
if (!comparisonHtml.includes(`/biases/${SLUG}/#evidence`) || !comparisonHtml.includes(`/biases/${SYSTEMATIC}/#evidence`)) throw new Error("Surrogation/Systematic comparison does not link both evidence reviews.");
const researchHtml = await readFile(resolve("dist", "research", RESEARCH, "index.html"), "utf8");
if (!researchHtml.includes('data-seo-schema="research-article"') || !researchHtml.includes("10.2308/accr-52277")) throw new Error("Surrogation research page is missing Article metadata or source DOI.");

const publicBiases = await json("dist/data/biases.json");
const publicComparisons = await json("dist/data/comparisons.json");
const publicContexts = await json("dist/data/contexts.json");
const publicResearch = await json("dist/data/research-notes.json");
if (!publicBiases.some((entry) => entry.id === ID && entry.slug === SLUG)) throw new Error("Public dataset is missing Surrogation #123.");
if (!(publicComparisons.entries || []).some((entry) => entry.slug === COMPARISON)) throw new Error("Public dataset is missing Surrogation/Systematic comparison.");
if (!(publicContexts.entries || []).some((entry) => entry.slug === CONTEXT)) throw new Error("Public dataset is missing KPI decision context.");
if (!(publicResearch.entries || []).some((entry) => entry.slug === RESEARCH)) throw new Error("Public dataset is missing Surrogation research note.");

const sitemap = await readFile("dist/sitemap.xml", "utf8");
for (const url of [`${SITE}/biases/${SLUG}/`, `${SITE}/compare/${COMPARISON}/`, `${SITE}/contexts/${CONTEXT}/`, `${SITE}/research/${RESEARCH}/`]) {
  if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`Sitemap is missing ${url}.`);
}

console.log("Surrogation cluster check passed: #123, evidence, proxy-vs-measurement distinction, KPI guide, family, research discovery, exports and sitemap are aligned.");
