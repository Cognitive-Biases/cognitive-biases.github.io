import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const situationsData = JSON.parse(await readFile("data/situations.json", "utf8"));
const source = JSON.parse(await readFile("data/situation-guides.json", "utf8"));
const publicData = JSON.parse(await readFile(join(OUT, "data", "situation-guides.json"), "utf8"));
const practiceIndex = JSON.parse(await readFile("data/reasoning-practice/index.json", "utf8"));

const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const requireText = (value, label) => assert(String(value || "").trim().length >= 12, `${label}: missing or too short`);
const situationSlugs = new Set(situationsData.situations.map((item) => item.slug));
const deep = source.guides.filter((guide) => guide.tier === "deep");
const publicBySituation = new Map(publicData.guides.map((item) => [item.situation, item]));

const comparisonFiles = (await readdir("data")).filter((name) => /^comparisons(?:-[a-z0-9-]+)?\.json$/i.test(name));
const comparisonDocs = await Promise.all(comparisonFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const comparisonSlugs = new Set(comparisonDocs.flatMap((doc) => doc.entries || []).map((entry) => entry.slug));

const researchFiles = (await readdir("data")).filter((name) => /^research-notes(?:-[a-z0-9-]+)?\.json$/i.test(name));
const researchDocs = await Promise.all(researchFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const researchSlugs = new Set(researchDocs.flatMap((doc) => doc.entries || []).map((entry) => entry.slug));

assert(deep.length >= 5, `expected at least five deep decision guides, found ${deep.length}`);

for (const guide of deep) {
  const situationSlug = guide.situation;
  assert(situationSlugs.has(situationSlug), `${situationSlug}: unknown canonical situation`);
  requireText(guide.hook, `${situationSlug} hook`);
  requireText(guide.problemQuestion, `${situationSlug} problemQuestion`);
  assert(Array.isArray(guide.whyHard) && guide.whyHard.length >= 2, `${situationSlug}: whyHard needs two paragraphs`);
  assert(Array.isArray(guide.reviewProtocol) && guide.reviewProtocol.length === 5, `${situationSlug}: reviewProtocol must contain five moves`);
  for (const item of guide.reviewProtocol || []) requireText(item, `${situationSlug} protocol item`);
  for (const field of ["title", "setup", "weakReview", "strongerReview"]) requireText(guide.workedExample?.[field], `${situationSlug} workedExample.${field}`);
  assert(Array.isArray(guide.decisionRecord) && guide.decisionRecord.length >= 4, `${situationSlug}: decisionRecord needs at least four items`);
  requireText(guide.evidenceBoundary, `${situationSlug} evidenceBoundary`);
  requireText(guide.sourceBoundary, `${situationSlug} sourceBoundary`);
  assert(publicBySituation.get(situationSlug)?.tier === "deep", `${situationSlug}: public machine-readable guide missing`);

  for (const slug of guide.comparisonSlugs || []) {
    assert(comparisonSlugs.has(slug), `${situationSlug}: unknown comparison ${slug}`);
    try { await access(join(OUT, "compare", slug, "index.html")); } catch { errors.push(`${situationSlug}: comparison page missing ${slug}`); }
  }
  for (const slug of guide.researchNoteSlugs || []) {
    assert(researchSlugs.has(slug), `${situationSlug}: unknown research note ${slug}`);
    try { await access(join(OUT, "research", slug, "index.html")); } catch { errors.push(`${situationSlug}: research page missing ${slug}`); }
  }

  const pack = JSON.parse(await readFile(`data/reasoning-practice/${situationSlug}.json`, "utf8"));
  assert(pack.scenarios?.length >= 2, `${situationSlug}: needs at least two practice scenarios`);
  const html = await readFile(join(OUT, "situations", situationSlug, "index.html"), "utf8");
  assert(html.includes('class="decision-deep-guide"'), `${situationSlug}: rendered deep guide missing`);
  assert(html.includes('id="decision-review-protocol"'), `${situationSlug}: rendered protocol missing`);
  assert(html.includes(guide.hook.replaceAll("&", "&amp;")), `${situationSlug}: hook not rendered`);
  assert(html.includes(guide.problemQuestion.replaceAll("&", "&amp;")), `${situationSlug}: problem question not rendered`);
  for (const scenario of pack.scenarios) assert(html.includes(`/practice/scenarios/${scenario.slug}/`), `${situationSlug}: practice link missing ${scenario.slug}`);
  for (const slug of guide.comparisonSlugs || []) assert(html.includes(`/compare/${slug}/`), `${situationSlug}: comparison link missing ${slug}`);
  for (const slug of guide.researchNoteSlugs || []) assert(html.includes(`/research/${slug}/`), `${situationSlug}: research link missing ${slug}`);
}

const hub = await readFile(join(OUT, "situations", "index.html"), "utf8");
assert(hub.includes('id="deep-decision-guides"'), "situations hub is missing deep decision guides");
for (const guide of deep) assert(hub.includes(`/situations/${guide.situation}/`), `situations hub missing ${guide.situation}`);

assert((practiceIndex.packs || []).filter((slug) => deep.some((guide) => guide.situation === slug)).length === deep.length, "every deep guide must have a matching reasoning-practice pack");

if (errors.length) {
  console.error("Deep decision cluster check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Deep decision cluster check passed: ${deep.length} high-value situation guides connect machine-readable source, practice, comparisons, research and discovery surfaces.`);
