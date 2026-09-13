import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const baseDoc = JSON.parse(await readFile("data/de/biases.json", "utf8"));
const expansionNames = (await readdir("data/de")).filter((name) => /^biases-reviewed-expansion-\d+\.json$/i.test(name)).sort();
const expansionDocs = await Promise.all(expansionNames.map(async (name) => JSON.parse(await readFile(join("data/de", name), "utf8"))));
const deTechniquesDoc = JSON.parse(await readFile("data/de/techniques.json", "utf8"));
const sourceTechniquesDoc = JSON.parse(await readFile("data/techniques.json", "utf8"));
const evidenceClassesDoc = JSON.parse(await readFile("data/evidence-classes.json", "utf8"));
const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name)).sort();
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const reviewedSlugs = new Set(evidenceDocs.flatMap((doc) => doc.reviews || []).map((review) => review.slug));
const decisionGuideNames = (await readdir("data/de")).filter((name) => /^decision-guides(?:-[a-z0-9-]+)?\.json$/i.test(name)).sort();
const decisionGuideDocs = await Promise.all(decisionGuideNames.map(async (name) => JSON.parse(await readFile(join("data/de", name), "utf8"))));

const biases = [...(baseDoc.entries || []), ...expansionDocs.flatMap((doc) => doc.entries || [])];
const techniques = deTechniquesDoc.techniques || [];
const sourceTechniqueBySlug = new Map((sourceTechniquesDoc.techniques || []).map((entry) => [entry.slug, entry]));
const biasSlugs = new Set(biases.map((entry) => entry.slug));
const techniqueSlugs = new Set(techniques.map((entry) => entry.slug));
const failures = [];
const fail = (message) => failures.push(message);
const nonEmpty = (value) => String(value || "").trim().length > 0;
const unique = (items) => new Set(items).size === items.length;
const sameSet = (a = [], b = []) => [...a].sort().join("\u0000") === [...b].sort().join("\u0000");

for (const [name, doc] of [["data/de/biases.json", baseDoc], ...expansionDocs.map((doc, index) => [`data/de/${expansionNames[index]}`, doc]), ["data/de/techniques.json", deTechniquesDoc]]) {
  if (doc.locale !== "de" || doc.state !== "reviewed") fail(`${name}: expected locale=de and state=reviewed.`);
}

if (biases.length < 25) fail(`Expected at least 25 reviewed German bias entries, found ${biases.length}.`);
if (!unique(biases.map((entry) => entry.slug))) fail("German bias slugs must be unique across base and expansion files.");
if (!unique(techniques.map((entry) => entry.slug))) fail("German technique slugs must be unique.");
if (!sameSet(techniques.map((entry) => entry.slug), (sourceTechniquesDoc.techniques || []).map((entry) => entry.slug))) {
  fail("German techniques must cover every canonical decision technique exactly once.");
}

const requiredEvidenceBoundaries = [
  "egocentric-bias-planning-fallacy",
  "false-priors-automation-bias",
  "prospect-theory-loss-aversion",
  "self-assessment-dunning",
  "confirmation-bias-backfire-effect",
  "framing-effect-default-effect",
  "framing-effect-decoy-effect",
  "cognitive-bias-mere-urgency-effect",
  "logical-fallacy-zero",
  "cognitive-bias-hungry-judge-effect"
];
for (const slug of requiredEvidenceBoundaries) {
  if (!biasSlugs.has(slug)) fail(`German reviewed cohort is missing required evidence-bounded concept: ${slug}.`);
}

for (const entry of biases) {
  for (const field of ["slug", "title", "englishTitle", "summary", "trap", "evidence", "boundary"]) {
    if (!nonEmpty(entry[field])) fail(`${entry.slug || "(missing slug)"}: ${field} is required.`);
  }
  if (!Array.isArray(entry.actions) || entry.actions.length < 3 || !entry.actions.every(nonEmpty)) fail(`${entry.slug}: add at least three practical German actions.`);
  if (!reviewedSlugs.has(entry.slug)) fail(`${entry.slug}: reviewed German page requires a canonical evidence review.`);
  if (!evidenceClassesDoc.bySlug?.[entry.slug]) fail(`${entry.slug}: reviewed German page requires a controlled evidence class.`);
  if ((entry.aliases || []).includes(entry.title)) fail(`${entry.slug}: primary German title must not be duplicated as an alias.`);
}

for (const entry of techniques) {
  for (const field of ["slug", "title", "purpose", "whenToUse", "limitations"]) {
    if (!nonEmpty(entry[field])) fail(`${entry.slug || "(missing slug)"}: technique ${field} is required.`);
  }
  if (!Array.isArray(entry.steps) || entry.steps.length < 4 || !entry.steps.every(nonEmpty)) fail(`${entry.slug}: keep four or more practical steps.`);
  const source = sourceTechniqueBySlug.get(entry.slug);
  if (!source) fail(`${entry.slug}: missing canonical English technique.`);
  else if (!sameSet(entry.biases, source.biases)) fail(`${entry.slug}: German technique must preserve canonical bias links.`);
}

for (const [index, doc] of decisionGuideDocs.entries()) {
  const name = `data/de/${decisionGuideNames[index]}`;
  if (doc.locale !== "de" || doc.state !== "draft") fail(`${name}: staged situation-first data must remain locale=de and state=draft until #151 publishes it end to end.`);
  for (const guide of doc.guides || []) {
    for (const field of ["slug", "title", "category", "summary", "situation", "whyItHelps", "boundary"]) {
      if (!nonEmpty(guide[field])) fail(`${name}/${guide.slug || "(missing slug)"}: ${field} is required.`);
    }
    if (!Array.isArray(guide.checklist) || guide.checklist.length < 4 || !guide.checklist.every(nonEmpty)) fail(`${name}/${guide.slug}: at least four concrete checklist steps are required.`);
    for (const slug of guide.biasSlugs || []) if (!biasSlugs.has(slug)) fail(`${name}/${guide.slug}: staged guide links to a German bias that is not reviewed: ${slug}.`);
    for (const slug of guide.techniqueSlugs || []) if (!techniqueSlugs.has(slug)) fail(`${name}/${guide.slug}: staged guide links to a missing German technique: ${slug}.`);
  }
}

const expectedPaths = [
  "de",
  "de/biases",
  "de/techniques",
  ...biases.map((entry) => `de/biases/${entry.slug}`),
  ...techniques.map((entry) => `de/techniques/${entry.slug}`)
];
const detailPaths = new Set([
  ...biases.map((entry) => `de/biases/${entry.slug}`),
  ...techniques.map((entry) => `de/techniques/${entry.slug}`)
]);

for (const relativePath of expectedPaths) {
  const file = join(OUT, relativePath, "index.html");
  try { await access(file); } catch { fail(`Missing generated German page: /${relativePath}/`); continue; }
  const html = await readFile(file, "utf8");
  if (!html.includes('<html lang="de">')) fail(`/${relativePath}/: expected html lang=de.`);
  if (!html.includes(`rel="canonical" href="${SITE}/${relativePath}/"`)) fail(`/${relativePath}/: self canonical is missing.`);
  if (!html.includes('hreflang="de"')) fail(`/${relativePath}/: German hreflang is missing.`);
  if (!html.includes('aria-label="Hauptnavigation"')) fail(`/${relativePath}/: localized main navigation label is missing.`);
  if (!html.includes('href="/de.css"')) fail(`/${relativePath}/: resilient German layout stylesheet is missing.`);
  if (detailPaths.has(relativePath)) {
    for (const marker of ["Was passiert?", "Probier das", "Grenzen"]) {
      if (!html.includes(marker)) fail(`/${relativePath}/: practical German detail structure is missing “${marker}”.`);
    }
  }
  for (const forbidden of ["Skip to content", "Where’s the trap?", "How to avoid it?", "When to use", "Learning outcome:"]) {
    if (html.includes(forbidden)) fail(`/${relativePath}/: untranslated English UI copy found: ${forbidden}`);
  }
}

for (const collection of ["de/biases", "de/techniques"]) {
  const html = await readFile(join(OUT, collection, "index.html"), "utf8");
  if (!html.includes("data-de-filter") || !html.includes('type="search"')) fail(`/${collection}/: German search/filter is missing.`);
}

const biasIndex = await readFile(join(OUT, "de", "biases", "index.html"), "utf8");
for (const alias of ["Confirmation Bias", "Bestätigungsverzerrung", "Sunk Cost", "Framing Effect", "Planning Fallacy", "Dunning-Kruger", "Default-Effekt"]) {
  if (!biasIndex.toLocaleLowerCase("de-DE").includes(alias.toLocaleLowerCase("de-DE"))) fail(`/de/biases/: search index is missing alias ${alias}.`);
}
if (biasIndex.includes(`hreflang="en" href="${SITE}/explore/"`)) fail("/de/biases/ must not claim /explore/ as an equivalent hreflang while German bias coverage is intentionally partial.");

for (const entry of biases) {
  const englishFile = join(OUT, "biases", entry.slug, "index.html");
  try {
    const html = await readFile(englishFile, "utf8");
    const expected = `hreflang="de" href="${SITE}/de/biases/${entry.slug}/"`;
    if (!html.includes(expected)) fail(`${entry.slug}: canonical English bias page does not link to the German alternate.`);
  } catch {
    fail(`${entry.slug}: canonical English bias page is missing.`);
  }
}
for (const entry of techniques) {
  const englishFile = join(OUT, "techniques", entry.slug, "index.html");
  try {
    const html = await readFile(englishFile, "utf8");
    const expected = `hreflang="de" href="${SITE}/de/techniques/${entry.slug}/"`;
    if (!html.includes(expected)) fail(`${entry.slug}: canonical English technique page does not link to the German alternate.`);
  } catch {
    fail(`${entry.slug}: canonical English technique page is missing.`);
  }
}

for (const dataFile of ["biases.json", "techniques.json"]) {
  try { await access(join(OUT, "data", "de", dataFile)); }
  catch { fail(`/data/de/${dataFile}: generated German machine-readable data is missing.`); }
}

try { await access(join(OUT, "de", "entscheidungen", "index.html")); fail("/de/entscheidungen/ exists while source decision guides are still state=draft; publish only through the #151 end-to-end gate."); } catch {}
try { await access(join(OUT, "data", "de", "decision-guides.json")); fail("/data/de/decision-guides.json exists while source decision guides are still draft."); } catch {}

const filterScript = await readFile("public/de-interface.js", "utf8");
if (!filterScript.includes("Angezeigt:") || !filterScript.includes("Insgesamt:")) fail("de-interface.js: German search result states are incomplete.");

const agentRouting = await readFile("ai/llms.de.txt", "utf8");
for (const required of ["/de/", "/de/biases/", "/de/techniques/", "/data/de/biases.json", "/data/de/techniques.json"]) {
  if (!agentRouting.includes(required)) fail(`ai/llms.de.txt: reviewed German route is missing: ${required}`);
}
for (const phrase of ["Sunk-Cost-Effekt", "Dunning", "Backfire", "draft", "/de/entscheidungen/"]) {
  if (!agentRouting.includes(phrase)) fail(`ai/llms.de.txt: evidence/routing boundary is missing: ${phrase}`);
}

try {
  const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
  for (const relativePath of expectedPaths) {
    const url = `${SITE}/${relativePath}/`;
    if (!sitemap.includes(`<loc>${url}</loc>`)) fail(`sitemap.xml is missing ${url}`);
  }
} catch {
  fail("sitemap.xml is missing after the build.");
}

if (failures.length) {
  console.error("German localization check failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}
console.log(`German localization check passed: ${biases.length} biases, ${techniques.length} techniques, staged situation data boundaries, agent routing, localized search, reciprocal detail hreflang and machine-readable data.`);
