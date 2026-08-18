import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const CIE = "memory-bias-continued-influence-effect";
const BACKFIRE = "confirmation-bias-backfire-effect";
const CONTEXT = "checking-claims-misinformation";
const COMPARISON = "continued-influence-effect-vs-backfire-effect";
const NOTE = "continued-influence-corrections-misinformation";

const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const reviews = evidenceDocs.flatMap((doc) => doc.reviews || []);
const cieReview = reviews.find((review) => review.slug === CIE);
const backfireReview = reviews.find((review) => review.slug === BACKFIRE);
if (!cieReview) throw new Error("Continued Influence Effect evidence review is missing.");
if (!backfireReview) throw new Error("Backfire Effect evidence review is missing.");
if ((cieReview.sources || []).length < 5) throw new Error("Continued Influence Effect review lost source coverage.");
if (!cieReview.qualification.includes("It does not mean")) throw new Error("Continued Influence Effect qualification lost the correction/backfire distinction.");

const cieHtml = await readFile(join("dist", "biases", CIE, "index.html"), "utf8");
if (!cieHtml.includes("when corrected information still shapes reasoning")) throw new Error("Continued Influence Effect plain-language title is missing.");
if (!cieHtml.includes("A correction can help")) throw new Error("Continued Influence Effect page must say that correction can still help.");
if (!cieHtml.includes(`/contexts/${CONTEXT}/`)) throw new Error("Continued Influence Effect page is missing the misinformation context link.");
if (!cieHtml.includes(`/compare/${COMPARISON}/`)) throw new Error("Continued Influence Effect page is missing the comparison link.");
for (const source of cieReview.sources) if (!cieHtml.includes(source.url)) throw new Error(`Continued Influence Effect page is missing source ${source.url}.`);

const contexts = JSON.parse(await readFile("data/contexts.json", "utf8"));
const context = (contexts.entries || []).find((item) => item.slug === CONTEXT);
if (!context) throw new Error("Checking claims & misinformation context is missing.");
const expectedLenses = [
  "cognitive-bias-confirmation-bias",
  "truth-judgment-illusory-truth-effect",
  "heuristic-bias-availability-bias",
  CIE,
  BACKFIRE
];
for (const slug of expectedLenses) if (!(context.lenses || []).some((lens) => lens.slug === slug)) throw new Error(`Misinformation context is missing lens ${slug}.`);
const contextHtml = await readFile(join("dist", "contexts", CONTEXT, "index.html"), "utf8");
if (!contextHtml.includes("Checking claims &amp; misinformation") && !contextHtml.includes("Checking claims & misinformation")) throw new Error("Misinformation context lost its visible title.");
if (!contextHtml.includes("Ten repetitions of one source are still one source")) throw new Error("Misinformation context lost its independent-source check.");
for (const slug of expectedLenses) {
  if (!contextHtml.includes(`/biases/${slug}/`)) throw new Error(`Misinformation context is missing visible lens ${slug}.`);
  if (!contextHtml.includes(`${SITE}/biases/${slug}/#term`)) throw new Error(`Misinformation context is missing structured lens ${slug}.`);
}

const comparisons = JSON.parse(await readFile("data/comparisons.json", "utf8"));
const comparison = (comparisons.entries || []).find((item) => item.slug === COMPARISON);
if (!comparison || comparison.leftSlug !== CIE || comparison.rightSlug !== BACKFIRE) throw new Error("Continued Influence vs Backfire comparison is missing or miswired.");
const comparisonHtml = await readFile(join("dist", "compare", COMPARISON, "index.html"), "utf8");
if (!comparisonHtml.includes("correction helps yet some influence")) throw new Error("Comparison lost the core continued-influence distinction.");
if (!comparisonHtml.includes("false claim stronger")) throw new Error("Comparison lost the backfire threshold.");
const backfireHtml = await readFile(join("dist", "biases", BACKFIRE, "index.html"), "utf8");
if (!backfireHtml.includes(`/compare/${COMPARISON}/`)) throw new Error("Backfire Effect page is missing the reciprocal comparison link.");

const notes = JSON.parse(await readFile("data/research-notes.json", "utf8"));
const note = (notes.entries || []).find((item) => item.slug === NOTE);
if (!note || (note.sources || []).length < 6) throw new Error("Misinformation correction research synthesis is missing or under-sourced.");
const noteHtml = await readFile(join("dist", "research", NOTE, "index.html"), "utf8");
if (!noteHtml.includes("Why corrected misinformation can still affect reasoning")) throw new Error("Misinformation research note title is missing.");
for (const source of note.sources) if (!noteHtml.includes(source.url)) throw new Error(`Misinformation research note is missing source ${source.url}.`);

const sitemap = await readFile(join("dist", "sitemap.xml"), "utf8");
for (const path of [`/biases/${CIE}/`, `/contexts/${CONTEXT}/`, `/compare/${COMPARISON}/`, `/research/${NOTE}/`]) {
  if (!sitemap.includes(`${SITE}${path}`)) throw new Error(`Sitemap is missing ${path}.`);
}

console.log("Information verification quality check passed: continued influence, backfire distinction, context, comparison, research synthesis and structured links are aligned.");
