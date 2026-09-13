import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const ruBiasesDoc = JSON.parse(await readFile("data/ru/biases.json", "utf8"));
const ruTechniquesDoc = JSON.parse(await readFile("data/ru/techniques.json", "utf8"));
const ruSkillsDoc = JSON.parse(await readFile("data/ru/skills.json", "utf8"));
const ruEverydayDoc = JSON.parse(await readFile("data/ru/everyday-guides.json", "utf8"));
const sourceTechniquesDoc = JSON.parse(await readFile("data/techniques.json", "utf8"));
const sourceSkillsDoc = JSON.parse(await readFile("data/skills.json", "utf8"));
const sourceEverydayDoc = JSON.parse(await readFile("data/everyday-guides.json", "utf8"));
const evidenceClassesDoc = JSON.parse(await readFile("data/evidence-classes.json", "utf8"));
const evidenceFiles = (await readdir("data"))
  .filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name))
  .sort();
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const reviewedSlugs = new Set(evidenceDocs.flatMap((doc) => doc.reviews || []).map((review) => review.slug));

const ruBiases = ruBiasesDoc.entries || [];
const ruTechniques = ruTechniquesDoc.techniques || [];
const ruSkills = ruSkillsDoc.entries || [];
const ruEveryday = ruEverydayDoc.entries || [];
const ruBiasSlugs = new Set(ruBiases.map((entry) => entry.slug));
const failures = [];

const fail = (message) => failures.push(message);
const hasRussian = (value) => /[А-Яа-яЁё]/.test(String(value || ""));
const unique = (items) => new Set(items).size === items.length;
const nonEmpty = (value) => String(value || "").trim().length > 0;

function sameSlugs(left, right) {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

if (ruBiases.length < 10) fail(`Expected at least 10 reviewed Russian bias entries, found ${ruBiases.length}.`);
if (!unique(ruBiases.map((entry) => entry.slug))) fail("Russian bias slugs must be unique.");
if (!unique(ruTechniques.map((entry) => entry.slug))) fail("Russian technique slugs must be unique.");
if (!unique(ruSkills.map((entry) => entry.slug))) fail("Russian skill slugs must be unique.");
if (!unique(ruEveryday.map((entry) => entry.slug))) fail("Russian everyday-guide slugs must be unique.");

if (!sameSlugs(ruTechniques.map((entry) => entry.slug), (sourceTechniquesDoc.techniques || []).map((entry) => entry.slug))) {
  fail("Russian techniques must cover every canonical technique exactly once.");
}
if (!sameSlugs(ruSkills.map((entry) => entry.slug), (sourceSkillsDoc.entries || []).map((entry) => entry.slug))) {
  fail("Russian skills must cover every canonical skill exactly once.");
}
if (!sameSlugs(ruEveryday.map((entry) => entry.slug), (sourceEverydayDoc.entries || []).map((entry) => entry.slug))) {
  fail("Russian everyday guides must cover every canonical everyday guide exactly once.");
}

for (const entry of ruBiases) {
  if (![entry.title, entry.summary, entry.trap, entry.evidence, entry.boundary].every(hasRussian)) {
    fail(`${entry.slug}: title, summary, trap, evidence and boundary must contain Russian editorial prose.`);
  }
  if (!Array.isArray(entry.actions) || entry.actions.length < 3 || !entry.actions.every(hasRussian)) fail(`${entry.slug}: add at least three Russian actions.`);
  if (!entry.englishTitle) fail(`${entry.slug}: keep the canonical English concept name as a search alias.`);
  if (!reviewedSlugs.has(entry.slug)) fail(`${entry.slug}: a reviewed Russian bias must point to a canonical evidence review.`);
  if (!evidenceClassesDoc.bySlug?.[entry.slug]) fail(`${entry.slug}: a reviewed Russian bias requires a controlled evidence class.`);
}
for (const entry of ruTechniques) {
  if (![entry.title, entry.purpose, entry.whenToUse, entry.limitations].every(hasRussian)) fail(`${entry.slug}: technique prose must be Russian.`);
  if (!Array.isArray(entry.steps) || entry.steps.length < 4 || !entry.steps.every(hasRussian)) fail(`${entry.slug}: keep four or more Russian steps.`);
}
for (const entry of ruSkills) {
  if (![entry.title, entry.summary, entry.outcome].every(hasRussian)) fail(`${entry.slug}: skill prose must be Russian.`);
  if (!Array.isArray(entry.whenToUse) || entry.whenToUse.length < 2 || !entry.whenToUse.every(hasRussian)) fail(`${entry.slug}: whenToUse must be localized.`);
  if (!Array.isArray(entry.actions) || entry.actions.length < 2 || !entry.actions.every(hasRussian)) fail(`${entry.slug}: actions must be localized.`);
}
for (const entry of ruEveryday) {
  const fields = [entry.title, entry.category, entry.summary, entry.situation, entry.explanation, entry.whyItMatters, entry.tryThis, entry.takeaway];
  if (!fields.every((value) => nonEmpty(value) && hasRussian(value))) fail(`${entry.slug}: everyday guide must fully localize the practical article.`);
  if (!entry.biasSlug || !ruBiasSlugs.has(entry.biasSlug)) fail(`${entry.slug}: everyday guide must link to a reviewed Russian bias.`);
}

const expectedPaths = [
  "ru",
  "ru/biases",
  "ru/techniques",
  "ru/skills",
  "ru/everyday",
  ...ruBiases.map((entry) => `ru/biases/${entry.slug}`),
  ...ruTechniques.map((entry) => `ru/techniques/${entry.slug}`),
  ...ruSkills.map((entry) => `ru/skills/${entry.slug}`),
  ...ruEveryday.map((entry) => `ru/everyday/${entry.slug}`)
];
const detailPaths = new Set([
  ...ruBiases.map((entry) => `ru/biases/${entry.slug}`),
  ...ruTechniques.map((entry) => `ru/techniques/${entry.slug}`),
  ...ruSkills.map((entry) => `ru/skills/${entry.slug}`),
  ...ruEveryday.map((entry) => `ru/everyday/${entry.slug}`)
]);
const filterPaths = new Set(["ru/biases", "ru/everyday"]);
const forbiddenUi = [
  "Where’s the trap?",
  "How to avoid it?",
  "Skip to content",
  "When to use",
  "Learning outcome:",
  ">Save<",
  ">Saved<",
  ">Share<",
  ">Copy link<",
  ">Cite<",
  "Continue from here",
  "Choose the next useful move",
  "Название bias",
  "legacy-текст",
  "evidence review оста"
];

for (const relativePath of expectedPaths) {
  const file = join(OUT, relativePath, "index.html");
  try {
    await access(file);
  } catch {
    fail(`Missing generated Russian page: /${relativePath}/`);
    continue;
  }
  const html = await readFile(file, "utf8");
  if (!html.includes('<html lang="ru">')) fail(`/${relativePath}/: expected html lang=ru.`);
  if (!html.includes(`rel="canonical" href="${SITE}/${relativePath}/"`)) fail(`/${relativePath}/: self canonical is missing.`);
  if (!html.includes('hreflang="ru"')) fail(`/${relativePath}/: Russian hreflang is missing.`);
  if (!html.includes('aria-label="Основная навигация"')) fail(`/${relativePath}/: Russian main-navigation label is missing.`);
  for (const untranslated of forbiddenUi) {
    if (html.includes(untranslated)) fail(`/${relativePath}/: untranslated or internal UI copy found: ${untranslated}`);
  }
  if (detailPaths.has(relativePath)) {
    for (const marker of ["internal-breadcrumbs", "data-page-utility", "Сохранить", "Поделиться", "Копировать ссылку", "Цитировать"]) {
      if (!html.includes(marker)) fail(`/${relativePath}/: localized detail-page UI is missing ${marker}.`);
    }
  }
  if (filterPaths.has(relativePath)) {
    if (!html.includes("data-ru-filter") || !html.includes("type=\"search\"")) fail(`/${relativePath}/: Russian collection search/filter is missing.`);
  }
}

const ruBiasIndex = await readFile(join(OUT, "ru", "biases", "index.html"), "utf8");
if (ruBiasIndex.includes(`hreflang="en" href="${SITE}/explore/"`)) {
  fail("/ru/biases/ must not declare /explore/ as an equivalent English hreflang page because coverage differs.");
}

for (const entry of ruBiases) {
  const englishFile = join(OUT, "biases", entry.slug, "index.html");
  try {
    const html = await readFile(englishFile, "utf8");
    const expected = `hreflang="ru" href="${SITE}/ru/biases/${entry.slug}/"`;
    if (!html.includes(expected)) fail(`${entry.slug}: canonical English bias page does not link to the Russian alternate.`);
  } catch {
    fail(`${entry.slug}: canonical English bias page is missing.`);
  }
}
for (const entry of ruSkills) {
  const englishFile = join(OUT, "skills", entry.slug, "index.html");
  try {
    const html = await readFile(englishFile, "utf8");
    const expected = `hreflang="ru" href="${SITE}/ru/skills/${entry.slug}/"`;
    if (!html.includes(expected)) fail(`${entry.slug}: canonical English skill page does not link to the Russian alternate.`);
  } catch {
    fail(`${entry.slug}: canonical English skill page is missing.`);
  }
}
for (const entry of ruEveryday) {
  const englishFile = join(OUT, "everyday", entry.slug, "index.html");
  try {
    const html = await readFile(englishFile, "utf8");
    const expected = `hreflang="ru" href="${SITE}/ru/everyday/${entry.slug}/"`;
    if (!html.includes(expected)) fail(`${entry.slug}: canonical English everyday guide does not link to the Russian alternate.`);
  } catch {
    fail(`${entry.slug}: canonical English everyday guide is missing.`);
  }
}

for (const dataFile of ["biases.json", "techniques.json", "skills.json", "everyday-guides.json"]) {
  try {
    await access(join(OUT, "data", "ru", dataFile));
  } catch {
    fail(`/data/ru/${dataFile}: generated Russian machine-readable data is missing.`);
  }
}

const utilityScript = await readFile("public/internal-discovery.js", "utf8");
for (const phrase of ["Сохранить", "Сохранено", "Ссылка скопирована.", "Цитата скопирована.", "Это действие недоступно в текущем браузере."]) {
  if (!utilityScript.includes(phrase)) fail(`internal-discovery.js: Russian utility state is missing: ${phrase}`);
}
const filterScript = await readFile("public/ru-interface.js", "utf8");
if (!filterScript.includes("Показано:") || !filterScript.includes("Всего:")) fail("ru-interface.js: Russian search result states are incomplete.");

const sitemapPath = join(OUT, "sitemap.xml");
try {
  const sitemap = await readFile(sitemapPath, "utf8");
  for (const relativePath of expectedPaths) {
    const url = `${SITE}/${relativePath}/`;
    if (!sitemap.includes(`<loc>${url}</loc>`)) fail(`sitemap.xml is missing ${url}`);
  }
} catch {
  fail("sitemap.xml is missing after the build.");
}

if (failures.length) {
  console.error("Russian localization check failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`Russian localization check passed: ${ruBiases.length} biases, ${ruTechniques.length} techniques, ${ruSkills.length} skills, ${ruEveryday.length} everyday guides.`);
