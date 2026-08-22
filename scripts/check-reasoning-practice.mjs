import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const practiceIndex = JSON.parse(await readFile("data/reasoning-practice/index.json", "utf8"));
const { packs: packSlugs = [], ...practiceMetadata } = practiceIndex;
const practicePacks = await Promise.all(packSlugs.map(async (slug) => {
  const pack = JSON.parse(await readFile(`data/reasoning-practice/${slug}.json`, "utf8"));
  if (pack.situation !== slug) throw new Error(`${slug}: reasoning-practice pack has a mismatched situation.`);
  for (const scenario of pack.scenarios || []) if (scenario.situation !== slug) throw new Error(`${scenario.slug}: scenario situation does not match ${slug}.`);
  return pack;
}));
const source = { ...practiceMetadata, scenarios: practicePacks.flatMap((pack) => pack.scenarios || []) };
const situationsData = JSON.parse(await readFile("data/situations.json", "utf8"));
const techniquesData = JSON.parse(await readFile("data/techniques.json", "utf8"));
const skillsData = JSON.parse(await readFile("data/skills.json", "utf8"));
const publicData = JSON.parse(await readFile(join(OUT, "data", "reasoning-practice.json"), "utf8"));
const publicBiases = JSON.parse(await readFile(join(OUT, "data", "biases.json"), "utf8"));
const evidence = JSON.parse(await readFile(join(OUT, "data", "evidence.json"), "utf8")).reviews || [];
const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
const errors = [];

const situationBySlug = new Map(situationsData.situations.map((item) => [item.slug, item]));
const techniqueBySlug = new Map(techniquesData.techniques.map((item) => [item.slug, item]));
const skillBySlug = new Map(skillsData.entries.map((item) => [item.slug, item]));
const canonicalBiases = new Set(publicBiases.map((item) => item.slug));
const reviewedBiases = new Set(evidence.map((item) => item.slug));
const validDifficulty = new Set(["starter", "intermediate", "advanced"]);
const scenarioSlugs = new Set();
const usedSituations = new Set();
const usedSkills = new Set();
const usedTechniques = new Set();
const forbidden = [/(?:this person|this candidate|this manager|this team) has (?:a |the )?\w+[ -]bias/i, /diagnos(?:e|ed|es|ing) (?:a |the )?person/i, /proves? that .* bias/i];

function requireText(value, label) {
  if (!String(value || "").trim()) errors.push(`${label}: missing text`);
}
function assert(condition, message) {
  if (!condition) errors.push(message);
}
function sourceText(scenario) {
  return [scenario.prompt, scenario.question, scenario.explanation, scenario.evidenceNote, scenario.nextAction, ...(scenario.missingEvidence || []), ...(scenario.options || []).map((option) => option.text)].join(" ");
}

assert(source.scenarios.length >= 25, `expected at least 25 scenarios, found ${source.scenarios.length}`);
assert(publicData.releaseVersion, "public reasoning practice data is missing releaseVersion");
assert(publicData.schemaVersion === source.schemaVersion, "public schemaVersion drift");
assert(publicData.scenarios.length === source.scenarios.length, "public scenario count drift");

for (const scenario of source.scenarios) {
  requireText(scenario.slug, "scenario slug");
  requireText(scenario.title, `${scenario.slug} title`);
  requireText(scenario.prompt, `${scenario.slug} prompt`);
  requireText(scenario.question, `${scenario.slug} question`);
  requireText(scenario.explanation, `${scenario.slug} explanation`);
  requireText(scenario.evidenceNote, `${scenario.slug} evidence note`);
  requireText(scenario.nextAction, `${scenario.slug} next action`);
  assert(!scenarioSlugs.has(scenario.slug), `duplicate scenario slug: ${scenario.slug}`);
  scenarioSlugs.add(scenario.slug);
  assert(validDifficulty.has(scenario.difficulty), `${scenario.slug}: unknown difficulty ${scenario.difficulty}`);
  const situation = situationBySlug.get(scenario.situation);
  const skill = skillBySlug.get(scenario.skill);
  const technique = techniqueBySlug.get(scenario.technique);
  assert(Boolean(situation), `${scenario.slug}: unknown situation ${scenario.situation}`);
  assert(Boolean(skill), `${scenario.slug}: unknown skill ${scenario.skill}`);
  assert(Boolean(technique), `${scenario.slug}: unknown technique ${scenario.technique}`);
  if (situation) {
    assert(situation.skill === scenario.skill, `${scenario.slug}: skill does not match its situation`);
    assert(situation.biases.includes(scenario.primaryLens), `${scenario.slug}: primary lens is not linked from its situation`);
    assert(situation.techniques.includes(scenario.technique), `${scenario.slug}: technique is not linked from its situation`);
    for (const slug of scenario.alternativeLenses || []) assert(situation.biases.includes(slug), `${scenario.slug}: alternative lens ${slug} is not linked from its situation`);
  }
  assert(canonicalBiases.has(scenario.primaryLens), `${scenario.slug}: primary lens is not canonical`);
  assert(reviewedBiases.has(scenario.primaryLens), `${scenario.slug}: primary lens is not evidence-reviewed`);
  for (const slug of scenario.alternativeLenses || []) {
    assert(canonicalBiases.has(slug), `${scenario.slug}: alternative lens ${slug} is not canonical`);
    assert(reviewedBiases.has(slug), `${scenario.slug}: alternative lens ${slug} is not evidence-reviewed`);
  }
  assert(Array.isArray(scenario.options) && scenario.options.length === 3, `${scenario.slug}: expected exactly three options`);
  const optionIds = (scenario.options || []).map((option) => option.id);
  assert(new Set(optionIds).size === 3 && ["a", "b", "c"].every((id) => optionIds.includes(id)), `${scenario.slug}: options must use unique a/b/c IDs`);
  assert(optionIds.includes(scenario.bestOption), `${scenario.slug}: bestOption is missing from options`);
  assert(Array.isArray(scenario.missingEvidence) && scenario.missingEvidence.length >= 2, `${scenario.slug}: needs at least two missing-evidence items`);
  for (const pattern of forbidden) assert(!pattern.test(sourceText(scenario)), `${scenario.slug}: drifts into diagnosis or proof language`);
  usedSituations.add(scenario.situation);
  usedSkills.add(scenario.skill);
  usedTechniques.add(scenario.technique);
}

for (const situation of situationsData.situations) assert(usedSituations.has(situation.slug), `no reasoning scenario covers situation ${situation.slug}`);
for (const skill of skillsData.entries) assert(usedSkills.has(skill.slug), `no reasoning scenario covers skill ${skill.slug}`);
for (const technique of techniquesData.techniques) assert(usedTechniques.has(technique.slug), `no reasoning scenario covers technique ${technique.slug}`);

const hubPath = join(OUT, "practice", "scenarios", "index.html");
try {
  const hub = await readFile(hubPath, "utf8");
  assert(hub.includes(`<link rel="canonical" href="${SITE}/practice/scenarios/">`), "reasoning practice hub canonical missing");
  assert(hub.includes('"@type":"CollectionPage"'), "reasoning practice hub CollectionPage schema missing");
  assert(hub.includes('id="browse-situation"') && hub.includes('id="browse-skill"'), "reasoning practice hub browsing sections missing");
  assert(hub.includes('href="/about/editorial/"'), "reasoning practice hub editorial trust link missing");
  assert(hub.includes('/assets/brand.webp'), "reasoning practice hub optimized brand missing");
  for (const situation of situationsData.situations) assert(hub.includes(`id="situation-${situation.slug}"`), `hub missing situation section ${situation.slug}`);
  for (const skill of skillsData.entries) assert(hub.includes(`id="skill-${skill.slug}"`), `hub missing skill section ${skill.slug}`);
  for (const scenario of source.scenarios) assert(hub.includes(`/practice/scenarios/${scenario.slug}/`), `hub missing scenario ${scenario.slug}`);
} catch (error) {
  errors.push(`reasoning practice hub unavailable: ${error.message}`);
}

for (const scenario of source.scenarios) {
  const route = `/practice/scenarios/${scenario.slug}/`;
  const path = join(OUT, "practice", "scenarios", scenario.slug, "index.html");
  try {
    const html = await readFile(path, "utf8");
    const best = scenario.options.find((option) => option.id === scenario.bestOption);
    assert(html.includes(`<link rel="canonical" href="${SITE}${route}">`), `${scenario.slug}: canonical missing`);
    assert(html.includes('"@type":"LearningResource"'), `${scenario.slug}: LearningResource schema missing`);
    assert(html.includes("<details") && html.includes("Show the best first move"), `${scenario.slug}: crawlable answer missing`);
    assert(html.includes(best.text.replace(/&/g, "&amp;")), `${scenario.slug}: best option not rendered`);
    assert(html.includes(`/situations/${scenario.situation}/`), `${scenario.slug}: situation link missing`);
    assert(html.includes(`/skills/${scenario.skill}/`), `${scenario.slug}: skill link missing`);
    assert(html.includes(`/techniques/${scenario.technique}/`), `${scenario.slug}: technique link missing`);
    assert(html.includes(`/biases/${scenario.primaryLens}/#evidence`), `${scenario.slug}: primary evidence link missing`);
    assert(html.includes('href="/about/editorial/"'), `${scenario.slug}: editorial trust link missing`);
    assert(html.includes('href="/practice/"'), `${scenario.slug}: Practice missing from primary navigation`);
    assert(html.includes('/assets/brand.webp'), `${scenario.slug}: optimized brand missing`);
    assert(!/<script\s+[^>]*src=/i.test(html), `${scenario.slug}: scenario should work without client-side JavaScript`);
    assert(sitemap.includes(`<loc>${SITE}${route}</loc>`), `${scenario.slug}: sitemap entry missing`);
  } catch (error) {
    errors.push(`${scenario.slug}: generated page unavailable: ${error.message}`);
  }
}
assert(sitemap.includes(`<loc>${SITE}/practice/scenarios/</loc>`), "reasoning practice hub missing from sitemap");

try {
  const practiceHub = await readFile(join(OUT, "practice", "index.html"), "utf8");
  assert(practiceHub.includes("reasoning-practice-cta") && practiceHub.includes('/practice/scenarios/'), "Practice hub does not promote realistic scenarios");
  const decide = await readFile(join(OUT, "decide", "index.html"), "utf8");
  assert(decide.includes("reasoning-practice-cta") && decide.includes('/practice/scenarios/'), "Decide page does not link to reasoning practice");
  const dataPage = await readFile(join(OUT, "data", "index.html"), "utf8");
  assert(dataPage.includes("reasoning-practice-data") && dataPage.includes('/data/reasoning-practice.json'), "Data page does not expose reasoning practice data");
  const qualityPage = await readFile(join(OUT, "quality", "index.html"), "utf8");
  assert(qualityPage.includes("reasoning-practice-quality") && qualityPage.includes(`${source.scenarios.length} reviewed-link scenarios`), "Quality page reasoning coverage missing or stale");
} catch (error) {
  errors.push(`cross-page discovery validation failed: ${error.message}`);
}

for (const situation of situationsData.situations) {
  const html = await readFile(join(OUT, "situations", situation.slug, "index.html"), "utf8");
  for (const scenario of source.scenarios.filter((item) => item.situation === situation.slug)) assert(html.includes(`/practice/scenarios/${scenario.slug}/`), `${scenario.slug}: situation page reciprocal link missing`);
}
for (const skill of skillsData.entries) {
  const html = await readFile(join(OUT, "skills", skill.slug, "index.html"), "utf8");
  for (const scenario of source.scenarios.filter((item) => item.skill === skill.slug)) assert(html.includes(`/practice/scenarios/${scenario.slug}/`), `${scenario.slug}: skill page reciprocal link missing`);
}
for (const technique of techniquesData.techniques) {
  const html = await readFile(join(OUT, "techniques", technique.slug, "index.html"), "utf8");
  for (const scenario of source.scenarios.filter((item) => item.technique === technique.slug)) assert(html.includes(`/practice/scenarios/${scenario.slug}/`), `${scenario.slug}: technique page reciprocal link missing`);
}

for (const path of [join(OUT, "schemas", "reasoning-practice.schema.json"), join(OUT, "data", "schemas", "reasoning-practice.schema.json")]) {
  try {
    await access(path);
    const schema = JSON.parse(await readFile(path, "utf8"));
    assert(schema.$id === `${SITE}/schemas/reasoning-practice.schema.json`, `schema ID drift: ${path}`);
    assert(schema.properties?.scenarios?.minItems === 25, `schema minimum scenario count drift: ${path}`);
  } catch (error) {
    errors.push(`reasoning practice schema unavailable: ${path}: ${error.message}`);
  }
}

if (errors.length) {
  console.error("Reasoning Practice check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Reasoning Practice OK: ${source.scenarios.length} scenarios, ${usedSituations.size} situations, ${usedSkills.size} skills, ${usedTechniques.size} techniques.`);
