import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const ruBiasesDoc = JSON.parse(await readFile("data/ru/biases.json", "utf8"));
const ruTechniquesDoc = JSON.parse(await readFile("data/ru/techniques.json", "utf8"));
const ruSkillsDoc = JSON.parse(await readFile("data/ru/skills.json", "utf8"));
const sourceTechniquesDoc = JSON.parse(await readFile("data/techniques.json", "utf8"));
const sourceSkillsDoc = JSON.parse(await readFile("data/skills.json", "utf8"));

const ruBiases = ruBiasesDoc.entries || [];
const ruTechniques = ruTechniquesDoc.techniques || [];
const ruSkills = ruSkillsDoc.entries || [];
const failures = [];

const fail = (message) => failures.push(message);
const hasRussian = (value) => /[А-Яа-яЁё]/.test(String(value || ""));
const unique = (items) => new Set(items).size === items.length;

function sameSlugs(left, right) {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

if (ruBiases.length < 10) fail(`Expected at least 10 reviewed Russian bias entries, found ${ruBiases.length}.`);
if (!unique(ruBiases.map((entry) => entry.slug))) fail("Russian bias slugs must be unique.");
if (!unique(ruTechniques.map((entry) => entry.slug))) fail("Russian technique slugs must be unique.");
if (!unique(ruSkills.map((entry) => entry.slug))) fail("Russian skill slugs must be unique.");

if (!sameSlugs(ruTechniques.map((entry) => entry.slug), (sourceTechniquesDoc.techniques || []).map((entry) => entry.slug))) {
  fail("Russian techniques must cover every canonical technique exactly once.");
}
if (!sameSlugs(ruSkills.map((entry) => entry.slug), (sourceSkillsDoc.entries || []).map((entry) => entry.slug))) {
  fail("Russian skills must cover every canonical skill exactly once.");
}

for (const entry of ruBiases) {
  if (![entry.title, entry.summary, entry.trap].every(hasRussian)) fail(`${entry.slug}: title, summary and trap must contain Russian text.`);
  if (!Array.isArray(entry.actions) || entry.actions.length < 3 || !entry.actions.every(hasRussian)) fail(`${entry.slug}: add at least three Russian actions.`);
  if (!entry.englishTitle) fail(`${entry.slug}: keep the canonical English concept name as a search alias.`);
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

const expectedPaths = [
  "ru",
  "ru/biases",
  "ru/techniques",
  "ru/skills",
  ...ruBiases.map((entry) => `ru/biases/${entry.slug}`),
  ...ruTechniques.map((entry) => `ru/techniques/${entry.slug}`),
  ...ruSkills.map((entry) => `ru/skills/${entry.slug}`)
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
  for (const untranslated of ["Where’s the trap?", "How to avoid it?", "Skip to content", "When to use", "Learning outcome:"]) {
    if (html.includes(untranslated)) fail(`/${relativePath}/: untranslated UI copy found: ${untranslated}`);
  }
}

for (const entry of ruBiases) {
  const englishFile = join(OUT, "biases", entry.slug, "index.html");
  try {
    const html = await readFile(englishFile, "utf8");
    const expected = `hreflang="ru" href="${SITE}/ru/biases/${entry.slug}/"`;
    if (!html.includes(expected)) fail(`${entry.slug}: canonical English page does not link to the Russian alternate.`);
  } catch {
    fail(`${entry.slug}: canonical English bias page is missing.`);
  }
}

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

console.log(`Russian localization check passed: ${ruBiases.length} biases, ${ruTechniques.length} techniques, ${ruSkills.length} skills.`);
