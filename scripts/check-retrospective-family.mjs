import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const FAMILY = "retrospective-evaluation";
const MEMBERS = [
  { id: 100, slug: "cognitive-bias-hindsight-bias" },
  { id: 111, slug: "cognitive-bias-outcome-bias" },
  { id: 140, slug: "attribution-bias-moral-luck" },
];
const COMPARISON = "outcome-bias-vs-moral-luck";

const taxonomy = JSON.parse(await readFile("data/taxonomy-v2.json", "utf8"));
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const byId = new Map(biases.map((bias) => [bias.id, bias]));
const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(`data/${name}`, "utf8"))));
const reviewedSlugs = new Set(evidenceDocs.flatMap((document) => document.reviews || []).map((review) => review.slug));
const contexts = JSON.parse(await readFile("data/contexts.json", "utf8"));
const workContext = (contexts.entries || []).find((entry) => entry.slug === "work-project-decisions");
const comparisons = JSON.parse(await readFile("data/comparisons.json", "utf8"));
const comparison = (comparisons.entries || []).find((entry) => entry.slug === COMPARISON);
const kinds = JSON.parse(await readFile("data/kinds-v2.json", "utf8"));
const sitemap = await readFile("dist/sitemap.xml", "utf8");

if (!taxonomy.families?.[FAMILY]) throw new Error("Retrospective evaluation family definition is missing.");
if (!workContext) throw new Error("Work & project decisions context is missing.");
if (!comparison) throw new Error("Outcome Bias vs Moral Luck comparison model is missing.");

for (const member of MEMBERS) {
  const bias = byId.get(member.id);
  if (!bias || bias.slug !== member.slug) throw new Error(`${member.slug}: retrospective family member identity mismatch.`);
  if (taxonomy.recordFamilyOverrides?.[String(member.id)] !== FAMILY) {
    throw new Error(`${member.slug}: expected explicit ${FAMILY} mapping.`);
  }
  if (!reviewedSlugs.has(member.slug)) throw new Error(`${member.slug}: retrospective family member must be evidence-reviewed.`);
  const html = await readFile(resolve("dist", "biases", member.slug, "index.html"), "utf8");
  if (!html.includes(`href="/families/${FAMILY}/"`)) throw new Error(`${member.slug}: rendered page does not link retrospective family.`);
  if (!html.includes('class="evidence-review"')) throw new Error(`${member.slug}: rendered page lost evidence review.`);
  if (!html.includes(`/tools/decision-audit/?bias=${member.slug}`)) throw new Error(`${member.slug}: Decision Audit route missing.`);
}

if (kinds.recordKindOverrides?.["140"] !== "phenomenon") throw new Error("Moral Luck must be typed as a phenomenon after review.");
if (!workContext.lenses.some((lens) => lens.slug === "attribution-bias-moral-luck")) throw new Error("Work context is missing Moral Luck lens.");

const familyUrl = `${SITE}/families/${FAMILY}/`;
const familyHtml = await readFile(resolve("dist", "families", FAMILY, "index.html"), "utf8");
if (!sitemap.includes(`<loc>${familyUrl}</loc>`)) throw new Error("Retrospective family hub is missing from sitemap.");
for (const member of MEMBERS) {
  if (!familyHtml.includes(`/biases/${member.slug}/`)) throw new Error(`${member.slug}: missing from retrospective family hub.`);
}

const workHtml = await readFile(resolve("dist", "contexts", "work-project-decisions", "index.html"), "utf8");
if (!workHtml.includes('/biases/attribution-bias-moral-luck/#evidence')) throw new Error("Work context is missing Moral Luck evidence link.");
if (!workHtml.includes('/tools/decision-audit/?bias=attribution-bias-moral-luck')) throw new Error("Work context is missing Moral Luck Decision Audit route.");

if (comparison.leftSlug !== "cognitive-bias-outcome-bias" || comparison.rightSlug !== "attribution-bias-moral-luck") {
  throw new Error("Outcome Bias vs Moral Luck comparison targets changed unexpectedly.");
}
const comparisonUrl = `${SITE}/compare/${COMPARISON}/`;
const comparisonHtml = await readFile(resolve("dist", "compare", COMPARISON, "index.html"), "utf8");
if (!sitemap.includes(`<loc>${comparisonUrl}</loc>`)) throw new Error("Outcome Bias vs Moral Luck comparison is missing from sitemap.");
if (!comparisonHtml.includes('/biases/cognitive-bias-outcome-bias/#evidence') || !comparisonHtml.includes('/biases/attribution-bias-moral-luck/#evidence')) {
  throw new Error("Outcome Bias vs Moral Luck comparison is missing evidence links to both entries.");
}
for (const slug of ["cognitive-bias-outcome-bias", "attribution-bias-moral-luck"]) {
  const html = await readFile(resolve("dist", "biases", slug, "index.html"), "utf8");
  if (!html.includes(`href="/compare/${COMPARISON}/"`) || !html.includes('class="comparison-teaser"')) {
    throw new Error(`${slug}: missing reciprocal Outcome Bias vs Moral Luck comparison teaser.`);
  }
}

console.log("Retrospective evaluation check passed: Hindsight Bias, Outcome Bias, and Moral Luck are evidence-reviewed family members; Moral Luck is typed, work-context linked, and compared reciprocally with Outcome Bias.");
