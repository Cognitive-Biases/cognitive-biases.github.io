import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const source = JSON.parse(await readFile("data/situations.json", "utf8"));
const publicData = JSON.parse(await readFile(join(OUT, "data", "situations.json"), "utf8"));
const practiceIndex = JSON.parse(await readFile("data/reasoning-practice/index.json", "utf8"));

const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const requireText = (value, label) => assert(String(value || "").trim().length >= 12, `${label}: missing or too short`);
const deep = source.situations.filter((situation) => situation.guide?.tier === "deep");
const publicBySlug = new Map(publicData.situations.map((item) => [item.slug, item]));

const comparisonFiles = (await readdir("data")).filter((name) => /^comparisons(?:-[a-z0-9-]+)?\.json$/i.test(name));
const comparisonDocs = await Promise.all(comparisonFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const comparisonSlugs = new Set(comparisonDocs.flatMap((doc) => doc.entries || []).map((entry) => entry.slug));

const researchFiles = (await readdir("data")).filter((name) => /^research-notes(?:-[a-z0-9-]+)?\.json$/i.test(name));
const researchDocs = await Promise.all(researchFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const researchSlugs = new Set(researchDocs.flatMap((doc) => doc.entries || []).map((entry) => entry.slug));

assert(deep.length >= 5, `expected at least five deep decision guides, found ${deep.length}`);

for (const situation of deep) {
  const guide = situation.guide;
  requireText(guide.hook, `${situation.slug} hook`);
  requireText(guide.problemQuestion, `${situation.slug} problemQuestion`);
  assert(Array.isArray(guide.whyHard) && guide.whyHard.length >= 2, `${situation.slug}: whyHard needs two paragraphs`);
  assert(Array.isArray(guide.reviewProtocol) && guide.reviewProtocol.length === 5, `${situation.slug}: reviewProtocol must contain five moves`);
  for (const item of guide.reviewProtocol || []) requireText(item, `${situation.slug} protocol item`);
  for (const field of ["title", "setup", "weakReview", "strongerReview"]) requireText(guide.workedExample?.[field], `${situation.slug} workedExample.${field}`);
  assert(Array.isArray(guide.decisionRecord) && guide.decisionRecord.length >= 4, `${situation.slug}: decisionRecord needs at least four items`);
  requireText(guide.evidenceBoundary, `${situation.slug} evidenceBoundary`);
  requireText(guide.sourceBoundary, `${situation.slug} sourceBoundary`);
  assert(publicBySlug.get(situation.slug)?.guide?.tier === "deep", `${situation.slug}: public machine-readable guide missing`);

  for (const slug of guide.comparisonSlugs || []) {
    assert(comparisonSlugs.has(slug), `${situation.slug}: unknown comparison ${slug}`);
    try { await access(join(OUT, "compare", slug, "index.html")); } catch { errors.push(`${situation.slug}: comparison page missing ${slug}`); }
  }
  for (const slug of guide.researchNoteSlugs || []) {
    assert(researchSlugs.has(slug), `${situation.slug}: unknown research note ${slug}`);
    try { await access(join(OUT, "research", slug, "index.html")); } catch { errors.push(`${situation.slug}: research page missing ${slug}`); }
  }

  const pack = JSON.parse(await readFile(`data/reasoning-practice/${situation.slug}.json`, "utf8"));
  assert(pack.scenarios?.length >= 2, `${situation.slug}: needs at least two practice scenarios`);
  const html = await readFile(join(OUT, "situations", situation.slug, "index.html"), "utf8");
  assert(html.includes('class="decision-deep-guide"'), `${situation.slug}: rendered deep guide missing`);
  assert(html.includes('id="decision-review-protocol"'), `${situation.slug}: rendered protocol missing`);
  assert(html.includes(guide.hook.replaceAll("&", "&amp;")), `${situation.slug}: hook not rendered`);
  assert(html.includes(guide.problemQuestion.replaceAll("&", "&amp;")), `${situation.slug}: problem question not rendered`);
  for (const scenario of pack.scenarios) assert(html.includes(`/practice/scenarios/${scenario.slug}/`), `${situation.slug}: practice link missing ${scenario.slug}`);
  for (const slug of guide.comparisonSlugs || []) assert(html.includes(`/compare/${slug}/`), `${situation.slug}: comparison link missing ${slug}`);
  for (const slug of guide.researchNoteSlugs || []) assert(html.includes(`/research/${slug}/`), `${situation.slug}: research link missing ${slug}`);
}

const hub = await readFile(join(OUT, "situations", "index.html"), "utf8");
assert(hub.includes('id="deep-decision-guides"'), "situations hub is missing deep decision guides");
for (const situation of deep) assert(hub.includes(`/situations/${situation.slug}/`), `situations hub missing ${situation.slug}`);

assert((practiceIndex.packs || []).filter((slug) => deep.some((situation) => situation.slug === slug)).length === deep.length, "every deep guide must have a matching reasoning-practice pack");

if (errors.length) {
  console.error("Deep decision cluster check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Deep decision cluster check passed: ${deep.length} high-value situation guides connect machine-readable source, practice, comparisons and research.`);
