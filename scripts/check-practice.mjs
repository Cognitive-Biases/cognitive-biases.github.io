import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const contexts = JSON.parse(await readFile("data/contexts.json", "utf8")).entries || [];
const biases = JSON.parse(await readFile(join(OUT, "data", "biases.json"), "utf8"));
const canonicalSlugs = new Set(biases.map((bias) => bias.slug));
const evidence = JSON.parse(await readFile(join(OUT, "data", "evidence.json"), "utf8")).reviews || [];
const reviewedSlugs = new Set(evidence.map((review) => review.slug));
const practice = JSON.parse(await readFile(join(OUT, "data", "practice-sets.json"), "utf8"));
const metrics = JSON.parse(await readFile(join(OUT, "data", "metrics.json"), "utf8"));
const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
const llms = await readFile("llms.txt", "utf8");
const catalog = JSON.parse(await readFile(join(OUT, "data", "catalog.json"), "utf8"));
const manifest = JSON.parse(await readFile(join(OUT, "data", "manifest.json"), "utf8"));
const rag = (await readFile(join(OUT, "data", "rag.ndjson"), "utf8")).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));

assert(practice.releaseVersion, "practice data is missing releaseVersion");
assert(practice.schemaVersion, "practice data is missing schemaVersion");
assert(practice.sets.length === contexts.length, `expected ${contexts.length} practice sets, got ${practice.sets.length}`);
const expectedScenarios = practice.sets.reduce((sum, set) => sum + set.scenarios.length, 0);
assert(metrics.practiceSets === practice.sets.length, "practice set metric drift");
assert(metrics.practiceScenarios === expectedScenarios, "practice scenario metric drift");
assert(llms.includes("/practice/"), "llms.txt does not advertise Practice Lab");
assert(llms.includes("/data/practice-sets.json"), "llms.txt does not advertise practice data");
assert(catalog.distributions.some((item) => item.id === "practice" && item.url === `${SITE}/data/practice-sets.json`), "data catalogue is missing practice distribution");
assert(manifest.files.some((item) => item.path === "practice-sets.json"), "release manifest is missing practice-sets.json");
assert(rag.some((item) => item.resourceType === "practice-set"), "RAG distribution is missing practice-set chunks");

const dataPage = await readFile(join(OUT, "data", "index.html"), "utf8");
assert(dataPage.includes(`"contentUrl":"${SITE}/data/practice-sets.json"`), "Dataset JSON-LD is missing practice distribution");
assert(dataPage.includes("Practice Lab distribution"), "Data page is missing visible practice data link");
const qualityPage = await readFile(join(OUT, "quality", "index.html"), "utf8");
assert(qualityPage.includes("Practice Lab coverage"), "Quality page is missing practice coverage");
assert(qualityPage.includes(`${metrics.practiceSets} practice sets`), "Quality page practice set count drift");
assert(qualityPage.includes(`${metrics.practiceScenarios} evidence-linked exercises`), "Quality page practice scenario count drift");

const hub = await readFile(join(OUT, "practice", "index.html"), "utf8");
assert(hub.includes(`<link rel="canonical" href="${SITE}/practice/">`), "practice hub canonical is missing");
assert(sitemap.includes(`<loc>${SITE}/practice/</loc>`), "practice hub is missing from sitemap");

let scenarioCount = 0;
for (const set of practice.sets) {
  assert(set.scenarios.length >= 3, `${set.slug}: needs at least three exercises`);
  scenarioCount += set.scenarios.length;
  const path = join(OUT, "practice", set.slug, "index.html");
  const html = await readFile(path, "utf8");
  assert(html.includes('"@type":"LearningResource"'), `${set.slug}: LearningResource schema missing`);
  assert(html.includes(`<link rel="canonical" href="${SITE}/practice/${set.slug}/">`), `${set.slug}: canonical missing`);
  assert(html.includes("<details"), `${set.slug}: answers are not crawlable HTML details`);
  assert(html.includes(`/contexts/${set.contextSlug}/`), `${set.slug}: context link missing`);
  assert(!/diagnose which bias|diagnosis result/i.test(html), `${set.slug}: practice copy drifts into diagnosis language`);
  assert(sitemap.includes(`<loc>${SITE}/practice/${set.slug}/</loc>`), `${set.slug}: sitemap entry missing`);
  assert(hub.includes(`/practice/${set.slug}/`), `${set.slug}: orphaned from practice hub`);
  const contextHtml = await readFile(join(OUT, "contexts", set.contextSlug, "index.html"), "utf8");
  assert(contextHtml.includes(`/practice/${set.slug}/`), `${set.slug}: matching context does not link to practice`);
  for (const scenario of set.scenarios) {
    assert(canonicalSlugs.has(scenario.answerSlug), `${scenario.scenarioId}: answer is not canonical`);
    assert(reviewedSlugs.has(scenario.answerSlug), `${scenario.scenarioId}: answer is not evidence-reviewed`);
    assert(scenario.options.length === 3, `${scenario.scenarioId}: expected three options`);
    assert(new Set(scenario.options.map((option) => option.slug)).size === 3, `${scenario.scenarioId}: duplicate options`);
    assert(scenario.options.some((option) => option.slug === scenario.answerSlug), `${scenario.scenarioId}: answer missing from options`);
    assert(html.includes(`/biases/${scenario.answerSlug}/#evidence`), `${scenario.scenarioId}: evidence link missing from page`);
  }
}

const home = await readFile(join(OUT, "index.html"), "utf8");
assert(home.includes('href="/practice/"'), "homepage does not link to Practice Lab");
const schemaFiles = await readdir(join(OUT, "schemas"));
assert(schemaFiles.includes("practice-set.schema.json"), "practice JSON Schema missing");

let primaryNavPages = 0;
async function checkPrimaryNav(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await checkPrimaryNav(path);
    else if (entry.isFile() && entry.name.endsWith(".html")) {
      const html = await readFile(path, "utf8");
      if (!html.includes('<nav aria-label="Primary">')) continue;
      primaryNavPages += 1;
      assert(html.includes('href="/practice/"'), `primary navigation missing Practice: ${path}`);
    }
  }
}
await checkPrimaryNav(OUT);
assert(primaryNavPages > 0, "no primary navigation pages checked");
console.log(`Practice Lab check passed: ${practice.sets.length} sets, ${scenarioCount} evidence-linked exercises, ${primaryNavPages} primary navigation pages.`);
