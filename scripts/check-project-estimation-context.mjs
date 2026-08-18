import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const SLUG = "egocentric-bias-planning-fallacy";
const CONTEXT = "project-estimation-delivery";
const NOTE = "planning-fallacy-project-estimates-outside-view";

const contexts = JSON.parse(await readFile("data/contexts.json", "utf8"));
const context = (contexts.entries || []).find((item) => item.slug === CONTEXT);
if (!context) throw new Error("Project estimation context is missing.");

const expectedLenses = [
  "egocentric-bias-planning-fallacy",
  "probability-bias-subadditivity-effect",
  "heuristic-bias-availability-bias",
  "cognitive-bias-hindsight-bias",
  "logical-fallacy-escalation-of-commitment"
];
for (const slug of expectedLenses) {
  if (!(context.lenses || []).some((lens) => lens.slug === slug)) throw new Error(`Project estimation context is missing lens ${slug}.`);
}

const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const planningReview = evidenceDocs.flatMap((doc) => doc.reviews || []).find((review) => review.slug === SLUG);
if (!planningReview) throw new Error("Planning Fallacy evidence review is missing.");
if (!planningReview.evidenceStatus.includes("well-supported")) throw new Error("Planning Fallacy evidence status lost its reviewed qualification.");
if ((planningReview.sources || []).length < 4) throw new Error("Planning Fallacy evidence review needs its reviewed source set.");

const planningHtml = await readFile(join("dist", "biases", SLUG, "index.html"), "utf8");
if (planningHtml.includes("multiply your optimistic estimate by at least 1.5")) throw new Error("Legacy universal 1.5 Planning Fallacy advice returned.");
if (!planningHtml.includes("Start with comparable past work")) throw new Error("Planning Fallacy page is missing the evidence-aligned practical check.");
if (!planningHtml.includes(`/contexts/${CONTEXT}/`)) throw new Error("Planning Fallacy page is missing the reciprocal project-estimation context link.");
for (const source of planningReview.sources) {
  if (!planningHtml.includes(source.url)) throw new Error(`Planning Fallacy page is missing source ${source.url}.`);
}

const contextHtml = await readFile(join("dist", "contexts", CONTEXT, "index.html"), "utf8");
if (!contextHtml.includes("Project estimation &amp; delivery") && !contextHtml.includes("Project estimation & delivery")) throw new Error("Project estimation page lost its visible human-facing title.");
if (!contextHtml.includes("Start with comparable completed work")) throw new Error("Project estimation page is missing its outside-view workflow.");
for (const slug of expectedLenses) {
  if (!contextHtml.includes(`/biases/${slug}/`)) throw new Error(`Project estimation page is missing visible lens ${slug}.`);
}

const notes = JSON.parse(await readFile("data/research-notes.json", "utf8"));
const note = (notes.entries || []).find((item) => item.slug === NOTE);
if (!note) throw new Error("Planning Fallacy research synthesis is missing.");
if ((note.sources || []).length < 4) throw new Error("Planning Fallacy research synthesis lost source coverage.");
const noteHtml = await readFile(join("dist", "research", NOTE, "index.html"), "utf8");
if (!noteHtml.includes("why one buffer is not the answer")) throw new Error("Planning Fallacy research note title is missing from the rendered page.");
for (const source of note.sources) {
  if (!noteHtml.includes(source.url)) throw new Error(`Planning Fallacy research note is missing source ${source.url}.`);
}

const sitemap = await readFile(join("dist", "sitemap.xml"), "utf8");
for (const path of [`/biases/${SLUG}/`, `/contexts/${CONTEXT}/`, `/research/${NOTE}/`]) {
  if (!sitemap.includes(`${SITE}${path}`)) throw new Error(`Sitemap is missing ${path}.`);
}

console.log("Project estimation quality check passed: Planning Fallacy evidence, plain-language copy, context, reciprocal links and research synthesis are aligned.");
