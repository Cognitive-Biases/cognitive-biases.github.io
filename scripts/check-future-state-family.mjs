import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const FAMILY = "future-state-forecasting";
const MEMBERS = [
  { id: 81, slug: "self-assessment-hot-cold-empathy-gap" },
  { id: 101, slug: "cognitive-bias-impact-bias" },
  { id: 118, slug: "cognitive-bias-projection-bias" },
];

const taxonomy = JSON.parse(await readFile("data/taxonomy-v2.json", "utf8"));
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const byId = new Map(biases.map((bias) => [bias.id, bias]));
const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(`data/${name}`, "utf8"))));
const reviewedSlugs = new Set(evidenceDocs.flatMap((document) => document.reviews || []).map((review) => review.slug));
const contexts = JSON.parse(await readFile("data/contexts.json", "utf8"));
const forecastingContext = (contexts.entries || []).find((entry) => entry.slug === "forecasting-future-choices");
const kinds = JSON.parse(await readFile("data/kinds-v2.json", "utf8"));
const sitemap = await readFile("dist/sitemap.xml", "utf8");

if (!taxonomy.families?.[FAMILY]) throw new Error("Future-state forecasting family definition is missing.");
if (!forecastingContext) throw new Error("Forecasting & future choices context is missing.");

for (const member of MEMBERS) {
  const bias = byId.get(member.id);
  if (!bias || bias.slug !== member.slug) throw new Error(`${member.slug}: family member identity mismatch.`);
  if (taxonomy.recordFamilyOverrides?.[String(member.id)] !== FAMILY) {
    throw new Error(`${member.slug}: expected explicit ${FAMILY} mapping.`);
  }
  if (!reviewedSlugs.has(member.slug)) throw new Error(`${member.slug}: future-state family member must be evidence-reviewed.`);
  if (!forecastingContext.lenses.some((lens) => lens.slug === member.slug)) {
    throw new Error(`${member.slug}: missing from Forecasting & future choices context.`);
  }

  const html = await readFile(resolve("dist", "biases", member.slug, "index.html"), "utf8");
  if (!html.includes(`href="/families/${FAMILY}/"`)) throw new Error(`${member.slug}: rendered page does not link future-state family.`);
  if (!html.includes('class="evidence-review"')) throw new Error(`${member.slug}: rendered page lost evidence review.`);
  if (!html.includes(`/tools/decision-audit/?bias=${member.slug}`)) throw new Error(`${member.slug}: Decision Audit route missing.`);
  if (!html.includes('/contexts/forecasting-future-choices/')) throw new Error(`${member.slug}: reciprocal forecasting context link missing.`);
}

if (kinds.recordKindOverrides?.["81"] !== "phenomenon") throw new Error("Hot–Cold Empathy Gap must be typed as a phenomenon after review.");

const familyUrl = `${SITE}/families/${FAMILY}/`;
const familyHtml = await readFile(resolve("dist", "families", FAMILY, "index.html"), "utf8");
if (!sitemap.includes(`<loc>${familyUrl}</loc>`)) throw new Error("Future-state family hub is missing from sitemap.");
for (const member of MEMBERS) {
  if (!familyHtml.includes(`/biases/${member.slug}/`)) throw new Error(`${member.slug}: missing from future-state family hub.`);
}

const forecastingHtml = await readFile(resolve("dist", "contexts", "forecasting-future-choices", "index.html"), "utf8");
for (const member of MEMBERS) {
  if (!forecastingHtml.includes(`/biases/${member.slug}/#evidence`)) throw new Error(`${member.slug}: forecasting context is missing evidence link.`);
}

console.log("Future-state family check passed: Hot–Cold Empathy Gap, Impact Bias, and Projection Bias are evidence-reviewed, family-linked, forecasting-context lenses with Decision Audit routes.");
