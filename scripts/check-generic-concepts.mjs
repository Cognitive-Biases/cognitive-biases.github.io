import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const EXPECTED = [
  { id: 94, slug: "cognitive-bias-declinism", kind: "phenomenon", auditEligible: true, family: "past-present-comparison" },
  { id: 121, slug: "cognitive-bias-systematic-bias", kind: "measurement", auditEligible: false, family: "measurement-methods" },
];

const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const byId = new Map(biases.map((bias) => [bias.id, bias]));
const taxonomy = JSON.parse(await readFile("data/taxonomy-v2.json", "utf8"));
const kinds = JSON.parse(await readFile("data/kinds-v2.json", "utf8"));
const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(`data/${name}`, "utf8"))));
const reviews = evidenceDocs.flatMap((document) => document.reviews || []);
const reviewBySlug = new Map(reviews.map((review) => [review.slug, review]));
const audit = await readFile(resolve("dist", "tools", "decision-audit", "index.html"), "utf8");
const targetCategories = new Set(["Cognitive Bias", "Decision Making", "Heuristic Bias", "Human-Robot Interaction"]);
const unresolved = biases.filter((bias) => targetCategories.has(bias.typeOfBias) && !taxonomy.recordFamilyOverrides?.[String(bias.id)]);

for (const expected of EXPECTED) {
  const bias = byId.get(expected.id);
  if (!bias || bias.slug !== expected.slug) throw new Error(`${expected.slug}: reviewed generic-concept identity mismatch.`);
  const review = reviewBySlug.get(expected.slug);
  if (!review) throw new Error(`${expected.slug}: evidence review is missing.`);
  if (kinds.recordKindOverrides?.[String(expected.id)] !== expected.kind) throw new Error(`${expected.slug}: expected kind ${expected.kind}.`);
  const actualFamily = taxonomy.recordFamilyOverrides?.[String(expected.id)] || null;
  if (actualFamily !== expected.family) throw new Error(`${expected.slug}: expected family ${expected.family || "unresolved"}, found ${actualFamily || "unresolved"}.`);
  const actualEligibility = review.auditEligible !== false;
  if (actualEligibility !== expected.auditEligible) throw new Error(`${expected.slug}: unexpected Decision Audit eligibility.`);

  const html = await readFile(resolve("dist", "biases", expected.slug, "index.html"), "utf8");
  if (!html.includes('class="evidence-review"')) throw new Error(`${expected.slug}: evidence review not rendered.`);
  if (!html.includes(`class="kind-chip" data-kind="${expected.kind}"`)) throw new Error(`${expected.slug}: kind chip not rendered.`);
  if (expected.auditEligible) {
    if (!audit.includes(`value="${expected.slug}"`) || !html.includes(`/tools/decision-audit/?bias=${expected.slug}`)) {
      throw new Error(`${expected.slug}: audit-eligible concept is not connected to Decision Audit.`);
    }
  } else {
    if (audit.includes(`value="${expected.slug}"`) || html.includes(`/tools/decision-audit/?bias=${expected.slug}`) || html.includes('class="audit-cta"')) {
      throw new Error(`${expected.slug}: audit-ineligible concept leaked into Decision Audit.`);
    }
  }
}

const unresolvedWithoutReview = unresolved.filter((bias) => !reviewBySlug.has(bias.slug));
if (unresolvedWithoutReview.length) {
  throw new Error(`Generic family queue still contains unreviewed records: ${unresolvedWithoutReview.map((bias) => `#${bias.id} ${bias.slug}`).join(", ")}`);
}
if (unresolved.some((bias) => bias.id === 94)) throw new Error("Declinism #94 must no longer remain in the generic family queue.");
if (unresolved.some((bias) => bias.id === 121)) throw new Error("Systematic Bias #121 must no longer remain in the generic family queue.");

console.log(`Generic concept check passed: ${unresolved.length} family-unresolved generic records are all evidence-reviewed; Declinism now belongs to Past & present comparison and Systematic Bias remains a measurement concept outside Decision Audit.`);
