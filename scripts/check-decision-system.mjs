import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const situationsData = JSON.parse(await readFile("data/situations.json", "utf8"));
const techniquesData = JSON.parse(await readFile("data/techniques.json", "utf8"));
const skillsData = JSON.parse(await readFile("data/skills.json", "utf8"));
const biases = JSON.parse(await readFile("data/biases.json", "utf8"));

const errors = [];
const biasSlugs = new Set(biases.map((bias) => bias.slug));
const skillSlugs = new Set(skillsData.entries.map((skill) => skill.slug));
const techniqueSlugs = new Set(techniquesData.techniques.map((technique) => technique.slug));

function unique(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) errors.push(`${label}: duplicate ${value}`);
    seen.add(value);
  }
}
function requireText(value, label) {
  if (!String(value || "").trim()) errors.push(`${label}: missing text`);
}

unique(situationsData.situations.map((item) => item.slug), "situations");
unique(techniquesData.techniques.map((item) => item.slug), "techniques");

if (situationsData.situations.length < 12) errors.push("situations: expected at least 12");
if (techniquesData.techniques.length < 10) errors.push("techniques: expected at least 10");

for (const situation of situationsData.situations) {
  requireText(situation.slug, "situation slug");
  requireText(situation.title, `${situation.slug} title`);
  requireText(situation.summary, `${situation.slug} summary`);
  if (!Array.isArray(situation.signals) || situation.signals.length < 3) errors.push(`${situation.slug}: expected at least 3 signals`);
  if (!Array.isArray(situation.questions) || situation.questions.length < 3) errors.push(`${situation.slug}: expected at least 3 questions`);
  if (!Array.isArray(situation.biases) || situation.biases.length < 3) errors.push(`${situation.slug}: expected at least 3 bias lenses`);
  if (!Array.isArray(situation.techniques) || situation.techniques.length < 1) errors.push(`${situation.slug}: expected at least 1 technique`);
  if (!skillSlugs.has(situation.skill)) errors.push(`${situation.slug}: unknown skill ${situation.skill}`);
  for (const slug of situation.biases || []) if (!biasSlugs.has(slug)) errors.push(`${situation.slug}: unknown bias ${slug}`);
  for (const slug of situation.techniques || []) if (!techniqueSlugs.has(slug)) errors.push(`${situation.slug}: unknown technique ${slug}`);
}

for (const technique of techniquesData.techniques) {
  requireText(technique.slug, "technique slug");
  requireText(technique.title, `${technique.slug} title`);
  requireText(technique.purpose, `${technique.slug} purpose`);
  requireText(technique.whenToUse, `${technique.slug} whenToUse`);
  requireText(technique.limitations, `${technique.slug} limitations`);
  if (!Array.isArray(technique.steps) || technique.steps.length < 3) errors.push(`${technique.slug}: expected at least 3 steps`);
  if (!Array.isArray(technique.biases) || technique.biases.length < 1) errors.push(`${technique.slug}: expected at least 1 related bias`);
  for (const slug of technique.biases || []) if (!biasSlugs.has(slug)) errors.push(`${technique.slug}: unknown bias ${slug}`);
  const usedBy = situationsData.situations.filter((situation) => situation.techniques.includes(technique.slug));
  if (!usedBy.length) errors.push(`${technique.slug}: technique is not linked from any situation`);
}

const requiredPages = [
  "decide/index.html",
  "situations/index.html",
  "techniques/index.html",
  ...situationsData.situations.map((item) => `situations/${item.slug}/index.html`),
  ...techniquesData.techniques.map((item) => `techniques/${item.slug}/index.html`)
];
for (const path of requiredPages) {
  try { await access(join(OUT, path)); }
  catch { errors.push(`missing generated page: ${path}`); }
}

try {
  const home = await readFile(join(OUT, "index.html"), "utf8");
  for (const required of ['href="/decide/"', 'href="/skills/"', 'href="/research/"', 'href="/data/"', 'class="decision-first-home"']) {
    if (!home.includes(required)) errors.push(`homepage missing ${required}`);
  }
} catch {
  errors.push("homepage missing");
}

try {
  const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
  for (const route of ["/decide/", "/situations/", "/techniques/"]) {
    if (!sitemap.includes(`https://cognitive-biases.github.io${route}`)) errors.push(`sitemap missing ${route}`);
  }
} catch {
  errors.push("sitemap missing");
}

if (errors.length) {
  console.error("Decision-first layer check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Decision-first layer OK: ${situationsData.situations.length} situations, ${techniquesData.techniques.length} techniques.`);
