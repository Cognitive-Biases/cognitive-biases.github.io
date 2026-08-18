import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const EXPECTED_CLASSES = ["established", "supported", "mixed", "contested", "domain-specific", "concept"];
const classesConfig = JSON.parse(await readFile("data/evidence-classes.json", "utf8"));
const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(`data/${name}`, "utf8"))));
const reviews = evidenceDocs.flatMap((document) => document.reviews || []);
const reviewBySlug = new Map(reviews.map((review) => [review.slug, review]));
const auditEligible = reviews.filter((review) => review.auditEligible !== false).length;
const evidenceOnly = reviews.length - auditEligible;
const classCounts = new Map(EXPECTED_CLASSES.map((slug) => [slug, 0]));

const actualClasses = Object.keys(classesConfig.classes || {}).sort();
if (JSON.stringify(actualClasses) !== JSON.stringify([...EXPECTED_CLASSES].sort())) {
  throw new Error(`Evidence class vocabulary changed unexpectedly: ${actualClasses.join(", ")}.`);
}
for (const slug of EXPECTED_CLASSES) {
  const meta = classesConfig.classes[slug];
  if (!meta?.label || !meta?.description) throw new Error(`${slug}: evidence class metadata is incomplete.`);
}

for (const review of reviews) {
  const classSlug = classesConfig.bySlug?.[review.slug];
  if (!EXPECTED_CLASSES.includes(classSlug)) throw new Error(`${review.slug}: missing or uncontrolled evidence class.`);
  classCounts.set(classSlug, classCounts.get(classSlug) + 1);
}
const extraMappings = Object.keys(classesConfig.bySlug || {}).filter((slug) => !reviewBySlug.has(slug));
if (extraMappings.length) throw new Error(`Evidence classes contain stale mappings without reviews: ${extraMappings.join(", ")}.`);
if (Object.keys(classesConfig.bySlug || {}).length !== reviews.length) throw new Error("Evidence class mapping count does not match evidence review count.");

const methodology = await readFile(resolve("dist", "methodology", "index.html"), "utf8");
const evidenceHub = await readFile(resolve("dist", "evidence", "index.html"), "utf8");
const sitemap = await readFile("dist/sitemap.xml", "utf8");
const methodologyUrl = `${SITE}/methodology/`;
if (!methodology.includes(`<link rel="canonical" href="${methodologyUrl}">`)) throw new Error("Methodology page is missing canonical URL.");
if (!methodology.includes('"@type":"WebPage"')) throw new Error("Methodology page is missing WebPage structured data.");
if (!sitemap.includes(`<loc>${methodologyUrl}</loc>`)) throw new Error("Methodology page is missing from sitemap.");
if (!evidenceHub.includes('href="/methodology/"')) throw new Error("Evidence hub does not link the methodology page.");
if (!methodology.includes(`${reviews.length}</strong><span>evidence-reviewed entries</span>`)) throw new Error("Methodology evidence-review count is stale.");
if (!methodology.includes(`${auditEligible}</strong><span>Decision Audit lenses</span>`)) throw new Error("Methodology Audit-eligible count is stale.");
if (!methodology.includes(`${evidenceOnly}</strong><span>reviewed, evidence-only</span>`)) throw new Error("Methodology evidence-only count is stale.");
if (!methodology.includes("not a probability that a bias is “true.”") || !methodology.includes("No numeric truth score")) {
  throw new Error("Methodology is missing the non-numeric evidence-class boundary.");
}
if (!methodology.includes("not automatically formal systematic reviews") || !methodology.includes("not guaranteed to be an exhaustive bibliography")) {
  throw new Error("Methodology is missing review-scope limitations.");
}

for (const slug of EXPECTED_CLASSES) {
  const meta = classesConfig.classes[slug];
  const count = classCounts.get(slug);
  if (!methodology.includes(`id="${slug}"`) || !methodology.includes(`${count} reviewed entr${count === 1 ? "y" : "ies"}`)) {
    throw new Error(`${slug}: methodology class section/count is missing or stale.`);
  }
  if (!evidenceHub.includes(`data-evidence-class="${slug}"`)) throw new Error(`${slug}: Evidence hub does not expose the controlled class.`);
  if (!evidenceHub.includes(`<strong>${count}</strong>`)) throw new Error(`${slug}: Evidence hub class count ${count} is not rendered.`);
  if (!methodology.includes(meta.description.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"))) {
    throw new Error(`${slug}: methodology does not render class description.`);
  }
}

for (const review of reviews) {
  const classSlug = classesConfig.bySlug[review.slug];
  const html = await readFile(resolve("dist", "biases", review.slug, "index.html"), "utf8");
  if (!html.includes(`class="evidence-class" data-evidence-class="${classSlug}" href="/methodology/#${classSlug}"`)) {
    throw new Error(`${review.slug}: reviewed page is missing its controlled evidence-class link.`);
  }
  if (!html.includes(review.evidenceStatus.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"))) {
    throw new Error(`${review.slug}: descriptive evidence status disappeared after class rendering.`);
  }
}

console.log(`Evidence methodology check passed: ${reviews.length} reviews classified across ${EXPECTED_CLASSES.length} controlled classes; ${auditEligible} Audit lenses and ${evidenceOnly} evidence-only reviewed concepts remain explicitly separate.`);
