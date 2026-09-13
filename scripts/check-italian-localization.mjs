import { readFile, readdir, access } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const exists = async (path) => { try { await access(path); return true; } catch { return false; } };
const fail = (message) => { throw new Error(`Italian localization check failed: ${message}`); };

const release = await readJson("data/release.json");
const biases = await readJson("data/biases.json");
const translations = await readJson("data/translations-it.json");
const canonicalTechniques = await readJson("data/techniques.json");
const techniques = await readJson("data/techniques-it.json");
const canonicalSkills = await readJson("data/skills.json");
const skills = await readJson("data/skills-it.json");
const canonicalAgentSkills = await readJson("data/agent-skills.json");
const agentSkills = await readJson("data/agent-skills-it.json");
const ui = await readJson("data/ui-it.json");
const pages = await readJson("data/pages-it.json");
const glossary = await readJson("data/localization/it-glossary.json");
const localeRegistry = await readJson("data/locales.json");
const aiLocales = await readJson("ai/locales.json");

if (translations.locale !== "it" || translations.canonicalLocale !== "en") fail("translation locale contract is wrong");
if (translations.coverage !== "curated-reviewed-subset") fail("bias catalog must explicitly declare curated reviewed subset coverage");
for (const [name, doc] of [["bias translations", translations], ["techniques", techniques], ["Decision Skills", skills], ["Agent Skills", agentSkills]]) {
  if (doc.sourceRelease !== release.releaseVersion) fail(`${name} source release ${doc.sourceRelease} != canonical ${release.releaseVersion}`);
  if (doc.locale !== "it" || doc.canonicalLocale !== "en") fail(`${name} locale contract is wrong`);
}
if (ui.locale !== "it" || pages.locale !== "it") fail("Italian UI/page sources must declare locale it");
if (glossary.locale !== "it" || glossary.canonicalLocale !== "en" || !glossary.version) fail("Italian glossary contract is wrong");
if (!localeRegistry.locales.some((entry) => entry.code === "it" && entry.role === "reviewed-layer")) fail("data/locales.json does not register Italian as a reviewed layer");
if (!aiLocales.humanInterfaceLanguages.includes("it") || !aiLocales.agentRoutingLanguages.includes("it")) fail("ai/locales.json does not expose Italian for human and agent routing");
if (!aiLocales.semantics.humanReviewedLanguages.includes("it")) fail("ai/locales.json does not mark Italian as human reviewed");

const published = new Set(biases.filter((entry) => entry.published).map((entry) => entry.slug));
const biasIds = new Set();
const biasSlugs = new Set();
for (const entry of translations.entries || []) {
  if (!published.has(entry.canonicalId)) fail(`unknown or unpublished bias ${entry.canonicalId}`);
  if (biasIds.has(entry.canonicalId)) fail(`duplicate bias canonical ID ${entry.canonicalId}`);
  if (biasSlugs.has(entry.localizedSlug)) fail(`duplicate Italian bias slug ${entry.localizedSlug}`);
  biasIds.add(entry.canonicalId);
  biasSlugs.add(entry.localizedSlug);
  if (entry.state !== "reviewed") fail(`${entry.canonicalId} is not reviewed`);
  for (const field of ["localizedLabel", "englishLabel", "summary", "practicalQuestion", "boundary", "evidenceSummary"]) if (!String(entry[field] || "").trim()) fail(`${entry.canonicalId} missing ${field}`);
  if (entry.summary.length < 60) fail(`${entry.canonicalId} summary is too thin`);
  if (!Array.isArray(entry.examples) || entry.examples.length < 2) fail(`${entry.canonicalId} needs at least two localized examples`);
  if (!Array.isArray(entry.searchTerms) || entry.searchTerms.length < 3) fail(`${entry.canonicalId} needs Italian search terms`);
  if (/\b(?:TODO|TBD)\b|lorem ipsum|placeholder/i.test(JSON.stringify(entry))) fail(`${entry.canonicalId} contains placeholder text`);
}
if ((translations.entries || []).length < 8) fail("initial reviewed Italian bias core must contain at least eight entries");

const canonicalTechniqueSlugs = new Set((canonicalTechniques.techniques || []).map((entry) => entry.slug));
if ((techniques.entries || []).length !== canonicalTechniqueSlugs.size) fail(`technique parity is ${techniques.entries?.length || 0}/${canonicalTechniqueSlugs.size}`);
for (const entry of techniques.entries || []) {
  if (!canonicalTechniqueSlugs.has(entry.canonicalSlug)) fail(`unknown technique ${entry.canonicalSlug}`);
  if (!entry.title || !entry.summary || !Array.isArray(entry.steps) || entry.steps.length < 3 || !entry.example || !entry.boundary) fail(`incomplete technique ${entry.canonicalSlug}`);
}

const canonicalSkillSlugs = new Set((canonicalSkills.entries || []).map((entry) => entry.slug));
if ((skills.entries || []).length !== canonicalSkillSlugs.size) fail(`Decision Skill parity is ${skills.entries?.length || 0}/${canonicalSkillSlugs.size}`);
for (const entry of skills.entries || []) {
  if (!canonicalSkillSlugs.has(entry.canonicalSlug)) fail(`unknown Decision Skill ${entry.canonicalSlug}`);
  if (!entry.title || !entry.summary || !entry.outcome || !Array.isArray(entry.whenToUse) || !Array.isArray(entry.actions) || !entry.example || !entry.boundary) fail(`incomplete Decision Skill ${entry.canonicalSlug}`);
}

const canonicalAgentNames = new Set((canonicalAgentSkills.skills || []).map((entry) => entry.name));
if ((agentSkills.entries || []).length !== canonicalAgentNames.size) fail(`Agent Skill parity is ${agentSkills.entries?.length || 0}/${canonicalAgentNames.size}`);
for (const entry of agentSkills.entries || []) {
  if (!canonicalAgentNames.has(entry.canonicalSlug)) fail(`unknown Agent Skill ${entry.canonicalSlug}`);
  for (const field of ["useWhen", "procedure", "output", "guardrails"]) if (!Array.isArray(entry[field]) || entry[field].length < 2) fail(`${entry.canonicalSlug} has incomplete ${field}`);
}
for (const required of ["cognitive-bias-lens", "bias-aware-decision-review", "evidence-evaluation", "decision-making-under-uncertainty", "forecasting", "metacognition", "information-verification", "ai-assisted-reasoning"]) {
  if (!agentSkills.entries.some((entry) => entry.canonicalSlug === required)) fail(`required workflow Agent Skill missing: ${required}`);
}

const manifest = await readJson("dist/it/data/index.json");
if (manifest.locale !== "it" || manifest.canonicalLocale !== "en" || manifest.status !== "reviewed-partial-human-layer") fail("generated manifest locale/status contract is wrong");
if (manifest.sourceRelease !== release.releaseVersion) fail("generated manifest release drifted");
if (manifest.coverage.concepts !== translations.entries.length || manifest.coverage.canonicalPublishedConcepts !== published.size) fail("generated bias coverage counts are wrong");
if (manifest.coverage.conceptPolicy !== "curated-reviewed-subset-no-silent-fallback") fail("generated manifest must forbid silent English fallback");
if (manifest.coverage.techniques !== canonicalTechniqueSlugs.size || manifest.coverage.decisionSkills !== canonicalSkillSlugs.size || manifest.coverage.workflowAgentSkills !== canonicalAgentNames.size) fail("generated full-parity layer counts are wrong");
if (!manifest.semantics.evidenceStatusRemainsCanonical || !manifest.semantics.translationReviewSeparateFromEvidenceReview || !manifest.semantics.noEnglishFallbackPresentedAsReviewedItalian) fail("generated semantic boundary flags are incomplete");

const requiredRoutes = ["/it/", "/it/bias-cognitivi/", "/it/tecniche/", "/it/competenze/", "/it/agent-skills/"];
for (const route of requiredRoutes) await checkPage(route, route === "/it/" ? "/" : null);
for (const entry of translations.entries) await checkPage(`/it/bias/${entry.localizedSlug}/`, `/biases/${entry.canonicalId}/`);
for (const entry of techniques.entries) await checkPage(`/it/tecniche/${entry.localizedSlug}/`, `/techniques/${entry.canonicalSlug}/`);
for (const entry of skills.entries) await checkPage(`/it/competenze/${entry.localizedSlug}/`, `/skills/${entry.canonicalSlug}/`);
for (const entry of agentSkills.entries) {
  await checkPage(`/it/agent-skills/${entry.canonicalSlug}/`, `/agent-skills/${entry.canonicalSlug}/`);
  const markdown = join("dist", "it", "agent-skills", entry.canonicalSlug, "SKILL.md");
  if (!(await exists(markdown))) fail(`missing ${markdown}`);
  const text = await readFile(markdown, "utf8");
  for (const marker of [`name: ${entry.canonicalSlug}`, "locale: it", "## Procedura", "## Guardrail", "canonical_skill:"]) if (!text.includes(marker)) fail(`${markdown} missing ${marker}`);
}
for (const entry of translations.entries) {
  const markdown = join("dist", "it", "agent-skills", `bias-${entry.canonicalId}`, "SKILL.md");
  if (!(await exists(markdown))) fail(`missing localized bias skill ${entry.canonicalId}`);
  const text = await readFile(markdown, "utf8");
  if (!text.includes(`canonical_bias: ${entry.canonicalId}`) || !text.includes(entry.localizedLabel)) fail(`bias skill metadata/content mismatch for ${entry.canonicalId}`);
}

for (const path of ["dist/it/llms.txt", "dist/it/data/biases.json", "dist/it/data/techniques.json", "dist/it/data/skills.json", "dist/it/data/agent-skills.json", "dist/it/data/search.json", "dist/it/sitemap.xml", "dist/it.css"]) if (!(await exists(path))) fail(`missing generated artifact ${path}`);
const llms = await readFile("dist/it/llms.txt", "utf8");
for (const marker of ["ID canonici", "traduzione revisionata", "Agent Skills", "fallback inglese", "bias cognitivo"]) if (!llms.toLowerCase().includes(marker.toLowerCase())) fail(`llms.txt missing semantic rule: ${marker}`);

const sitemap = await readFile("dist/sitemap.xml", "utf8");
for (const route of ["/it/", "/it/bias-cognitivi/", ...translations.entries.map((entry) => `/it/bias/${entry.localizedSlug}/`)]) if (!sitemap.includes(`<loc>${SITE}${route}</loc>`)) fail(`root sitemap missing ${route}`);

const generatedBiases = await readJson("dist/it/data/biases.json");
const evidenceReviews = await loadEvidenceReviews();
for (const entry of generatedBiases.entries || []) {
  const review = evidenceReviews.get(entry.canonicalId);
  if (review && entry.canonicalEvidence?.status !== review.evidenceStatus) fail(`${entry.canonicalId} evidence status changed during localization`);
  if (!review && entry.canonicalEvidence !== null) fail(`${entry.canonicalId} invents a local evidence review`);
}

console.log(`Italian localization check passed: ${translations.entries.length}/${published.size} reviewed bias pages; ${techniques.entries.length}/${canonicalTechniqueSlugs.size} techniques; ${skills.entries.length}/${canonicalSkillSlugs.size} Decision Skills; ${agentSkills.entries.length}/${canonicalAgentNames.size} workflow Agent Skills.`);

async function checkPage(route, englishRoute) {
  const path = route === "/" ? join("dist", "index.html") : join("dist", route.replace(/^\//, ""), "index.html");
  if (!(await exists(path))) fail(`missing route ${route}`);
  const html = await readFile(path, "utf8");
  const canonical = `${SITE}${route}`;
  for (const marker of ["<html lang=\"it\"", `rel=\"canonical\" href=\"${canonical}\"`, `hreflang=\"it\" href=\"${canonical}\"`, "property=\"og:locale\" content=\"it_IT\"", '"inLanguage":"it"']) if (!html.includes(marker)) fail(`${route} missing metadata marker ${marker}`);
  if (englishRoute && !html.includes(`hreflang=\"en\" href=\"${SITE}${englishRoute}\"`)) fail(`${route} missing English hreflang ${englishRoute}`);
  if (englishRoute) {
    const enPath = englishRoute === "/" ? join("dist", "index.html") : join("dist", englishRoute.replace(/^\//, ""), "index.html");
    if (await exists(enPath)) {
      const enHtml = await readFile(enPath, "utf8");
      if (!enHtml.includes(`hreflang=\"it\" href=\"${canonical}\"`)) fail(`${route} lacks reciprocal Italian discovery from ${englishRoute}`);
    }
  }
}

async function loadEvidenceReviews() {
  const names = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name)).sort();
  const map = new Map();
  for (const name of names) {
    const document = await readJson(join("data", name));
    for (const review of document.reviews || []) map.set(review.slug, review);
  }
  return map;
}
