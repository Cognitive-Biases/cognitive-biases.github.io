import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const situationsData = JSON.parse(await readFile("data/situations.json", "utf8"));
const source = JSON.parse(await readFile("data/situation-guides.json", "utf8"));
const searchIntents = JSON.parse(await readFile("data/search-intents.json", "utf8"));
const publicData = JSON.parse(await readFile(join(OUT, "data", "situation-guides.json"), "utf8"));
const practiceIndex = JSON.parse(await readFile("data/reasoning-practice/index.json", "utf8"));
const publicSearchIntents = JSON.parse(await readFile(join(OUT, "data", "search-intents.json"), "utf8"));
const siteProfile = JSON.parse(await readFile("ai/site-profile.json", "utf8"));
const citationIndex = JSON.parse(await readFile("ai/citation-index.json", "utf8"));
const siteFocus = JSON.parse(await readFile(".arwp/site-focus.json", "utf8"));

const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const requireText = (value, label) => assert(String(value || "").trim().length >= 12, `${label}: missing or too short`);
const esc = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[c]);
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
const guideSchemaUrl = "https://cognitive-biases.github.io/schemas/situation-guides.schema.json";
assert(source.$schema === guideSchemaUrl, "deep guide source must declare the public JSON schema");
assert(publicData.$schema === guideSchemaUrl, "published deep guide data must retain its JSON schema");
try { await access(join(OUT, "schemas", "situation-guides.schema.json")); } catch { errors.push("published deep guide JSON schema missing"); }

const intentBySlug = new Map((searchIntents.intents || []).map((intent) => [intent.slug, intent]));
const publicIntentBySlug = new Map((publicSearchIntents.generatedGuides || []).map((intent) => [intent.slug, intent]));
for (const intent of searchIntents.intents || []) {
  for (const situationSlug of intent.situationSlugs || []) {
    assert(situationSlugs.has(situationSlug), `${intent.slug}: search intent references unknown situation ${situationSlug}`);
  }
  if (!(intent.situationSlugs || []).length) continue;
  const publicIntent = publicIntentBySlug.get(intent.slug);
  assert(publicIntent, `${intent.slug}: generated public search-intent record missing`);
  assert(JSON.stringify(publicIntent?.situationSlugs || []) === JSON.stringify(intent.situationSlugs || []), `${intent.slug}: public search-intent situation routing drift`);
  const html = await readFile(join(OUT, "guides", intent.slug, "index.html"), "utf8");
  assert(html.includes('id="decision-situations"'), `${intent.slug}: search guide is missing Decision situations bridge`);
  for (const situationSlug of intent.situationSlugs || []) {
    assert(html.includes(`/situations/${situationSlug}/`), `${intent.slug}: search guide missing situation ${situationSlug}`);
  }
}

const situationDistribution = (siteProfile.data?.distributions || []).find((item) => item.name === "Decision situation guides");
assert(situationDistribution?.url === "https://cognitive-biases.github.io/data/situation-guides.json", "ARWP site profile is missing deep decision guide distribution");
const citationRoute = (citationIndex.entries || []).find((item) => item.id === "CB-CITE-011");
assert(citationRoute?.url === "https://cognitive-biases.github.io/situations/", "citation index is missing Decision situations hub");
assert(citationRoute?.machineReadable === "https://cognitive-biases.github.io/data/situation-guides.json", "citation index deep guide machine-readable route drift");
for (const route of ["/situations/", "/techniques/"]) {
  assert((siteFocus.routeRules || []).some((rule) => rule.match?.pathPrefix === route && rule.lane === "decide"), `Site Focus is missing decide route ${route}`);
}

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
  if (guide.searchIntent) {
    const intent = intentBySlug.get(guide.searchIntent);
    assert(intent, `${situationSlug}: unknown searchIntent ${guide.searchIntent}`);
    assert((intent?.situationSlugs || []).includes(situationSlug), `${situationSlug}: searchIntent ${guide.searchIntent} does not route back to this guide`);
  }

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
  assert(html.includes(esc(guide.hook)), `${situationSlug}: hook not rendered`);
  assert(html.includes(esc(guide.problemQuestion)), `${situationSlug}: problem question not rendered`);
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
console.log(`Deep decision cluster check passed: ${deep.length} high-value guides, ${[...(searchIntents.intents || [])].filter((intent) => (intent.situationSlugs || []).length).length} search-intent bridges, schema, AWRP and citation routing are coherent.`);
