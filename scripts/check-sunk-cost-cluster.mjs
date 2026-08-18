import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const SUNK_ID = 223;
const SUNK = "cognitive-bias-sunk-cost-effect";
const ESCALATION_ID = 64;
const ESCALATION = "logical-fallacy-escalation-of-commitment";
const CONTEXT = "continue-change-stop-project";
const COMPARISON = "sunk-cost-effect-vs-escalation-of-commitment";
const RESEARCH = "sunk-cost-escalation-why-past-spend-is-only-part";
const json = async (path) => JSON.parse(await readFile(path, "utf8"));

const curatedFiles = (await readdir("data")).filter((name) => /^curated-concepts(?:-[a-z0-9-]+)?\.json$/i.test(name));
const curatedDocs = await Promise.all(curatedFiles.map((name) => json(`data/${name}`)));
const sunk = curatedDocs.flatMap((document) => document.entries || []).find((entry) => entry.slug === SUNK);
if (!sunk || sunk.id !== SUNK_ID || sunk.status !== "reviewed") throw new Error("Sunk Cost Effect must exist as reviewed curated concept #223.");
if (/[🔍💡]/u.test(sunk.description || "")) throw new Error("Sunk Cost top copy must stay plain and marker-free.");
if (!/Do not assume that every decision to continue is a sunk-cost error/i.test(sunk.description || "")) throw new Error("Sunk Cost top copy lost its continuation boundary condition.");

const biases = await json("data/biases.json");
const sunkPrepared = biases.filter((entry) => entry.slug === SUNK || /^Sunk Cost (Effect|Fallacy)\b/i.test(entry.title || ""));
if (sunkPrepared.length !== 1 || sunkPrepared[0].id !== SUNK_ID) throw new Error(`Prepared corpus must contain exactly one Sunk Cost concept #${SUNK_ID}; found ${sunkPrepared.length}.`);
const escalation = biases.find((entry) => entry.id === ESCALATION_ID);
if (!escalation || escalation.slug !== ESCALATION) throw new Error("Historical Escalation of Commitment #64 must remain canonical.");
if (/\(Sunk Cost Fallacy\)/i.test(escalation.description || "")) throw new Error("Escalation top copy still presents Sunk Cost Fallacy as a synonym.");
if (!/Sunk costs can contribute to escalation, but escalation is the broader process/i.test(escalation.description || "")) throw new Error("Escalation page lost the explicit sunk-cost distinction.");

const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map((name) => json(`data/${name}`)));
const reviews = evidenceDocs.flatMap((document) => document.reviews || []);
const sunkReview = reviews.find((entry) => entry.slug === SUNK);
const escalationReview = reviews.find((entry) => entry.slug === ESCALATION);
if (!sunkReview || sunkReview.sources?.length < 3) throw new Error("Sunk Cost Effect needs a source-grounded evidence review.");
if (!sunkReview.sources.some((source) => source.doi === "10.1007/s40685-014-0014-8")) throw new Error("Sunk Cost review must include the meta-analytic review.");
if (!escalationReview || !/not interchangeable/i.test(escalationReview.qualification || "")) throw new Error("Escalation evidence review must preserve the construct distinction.");

const taxonomy = await json("data/taxonomy-v2.json");
for (const id of [ESCALATION_ID, SUNK_ID]) {
  if (taxonomy.recordFamilyOverrides?.[String(id)] !== "time-commitment") throw new Error(`#${id} must map to Time & commitment.`);
}

const contexts = await json("data/contexts.json");
const context = (contexts.entries || []).find((entry) => entry.slug === CONTEXT);
if (!context) throw new Error("Continue/change/stop context was not merged into the prepared collection.");
for (const slug of [SUNK, ESCALATION, "cognitive-bias-anchoring-effect", "egocentric-bias-planning-fallacy", "cognitive-bias-confirmation-bias", "cognitive-bias-outcome-bias"]) {
  if (!context.lenses?.some((lens) => lens.slug === slug)) throw new Error(`${CONTEXT}: missing reviewed lens ${slug}.`);
}

const comparisons = await json("data/comparisons.json");
const comparison = (comparisons.entries || []).find((entry) => entry.slug === COMPARISON);
if (!comparison || comparison.leftSlug !== SUNK || comparison.rightSlug !== ESCALATION) throw new Error("Sunk Cost vs Escalation comparison was not merged correctly.");

const research = await json("data/research-notes.json");
const note = (research.entries || []).find((entry) => entry.slug === RESEARCH);
if (!note || note.sources?.length < 6 || !note.related?.includes(SUNK) || !note.related?.includes(ESCALATION)) throw new Error("Sunk Cost/Escalation research synthesis is incomplete.");
if (!note.sources.some((source) => source.doi === "10.5465/AMPROC.2025.119bp")) throw new Error("Research synthesis is missing the algorithmic-advice study.");

for (const slug of [SUNK, ESCALATION]) {
  const html = await readFile(resolve("dist", "biases", slug, "index.html"), "utf8");
  if (!html.includes('class="evidence-review"')) throw new Error(`${slug}: evidence review is missing.`);
  if (!html.includes(`/compare/${COMPARISON}/`)) throw new Error(`${slug}: reciprocal comparison link is missing.`);
  if (!html.includes(`/contexts/${CONTEXT}/`)) throw new Error(`${slug}: reciprocal continue/change/stop context link is missing.`);
}

const sunkHtml = await readFile(resolve("dist", "biases", SUNK, "index.html"), "utf8");
if (!sunkHtml.includes('data-seo-schema="defined-term"') || !sunkHtml.includes(`"termCode":"${SUNK_ID}"`)) throw new Error("Sunk Cost page is missing DefinedTerm structured data.");

const contextHtml = await readFile(resolve("dist", "contexts", CONTEXT, "index.html"), "utf8");
for (const slug of [SUNK, ESCALATION]) if (!contextHtml.includes(`/biases/${slug}/#evidence`)) throw new Error(`Context does not link ${slug} evidence.`);

const comparisonHtml = await readFile(resolve("dist", "compare", COMPARISON, "index.html"), "utf8");
if (!comparisonHtml.includes(`/biases/${SUNK}/#evidence`) || !comparisonHtml.includes(`/biases/${ESCALATION}/#evidence`)) throw new Error("Comparison does not link both evidence pages.");

const researchHtml = await readFile(resolve("dist", "research", RESEARCH, "index.html"), "utf8");
if (!researchHtml.includes('data-seo-schema="research-article"') || !researchHtml.includes("10.5465/AMPROC.2025.119bp")) throw new Error("Research page is missing Article metadata or newer algorithmic-advice source.");

const publicBiases = await json("dist/data/biases.json");
const publicContexts = await json("dist/data/contexts.json");
const publicComparisons = await json("dist/data/comparisons.json");
const publicResearch = await json("dist/data/research-notes.json");
if (!publicBiases.some((entry) => entry.slug === SUNK)) throw new Error("Public concept dataset is missing Sunk Cost Effect.");
if (!(publicContexts.entries || []).some((entry) => entry.slug === CONTEXT)) throw new Error("Public context dataset is missing continue/change/stop context.");
if (!(publicComparisons.entries || []).some((entry) => entry.slug === COMPARISON)) throw new Error("Public comparison dataset is missing sunk-cost distinction.");
if (!(publicResearch.entries || []).some((entry) => entry.slug === RESEARCH)) throw new Error("Public research dataset is missing sunk-cost synthesis.");

const sitemap = await readFile("dist/sitemap.xml", "utf8");
for (const url of [
  `${SITE}/biases/${SUNK}/`,
  `${SITE}/contexts/${CONTEXT}/`,
  `${SITE}/compare/${COMPARISON}/`,
  `${SITE}/research/${RESEARCH}/`
]) if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`Sitemap is missing ${url}.`);

console.log("Sunk cost cluster check passed: Sunk Cost Effect and Escalation are separated, evidence-reviewed, family-aligned, context-linked, compared, researched and exported consistently.");
