import { readFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const situationsData = JSON.parse(await readFile("data/situations.json", "utf8"));
const skillsData = JSON.parse(await readFile("data/skills.json", "utf8"));
const errors = [];
const biasPages = new Map();
const skillPages = new Map();

for (const situation of situationsData.situations) {
  for (const bias of situation.biases) {
    if (!biasPages.has(bias)) biasPages.set(bias, []);
    biasPages.get(bias).push(situation);
  }
  if (!skillPages.has(situation.skill)) skillPages.set(situation.skill, []);
  skillPages.get(situation.skill).push(situation);
}

for (const [bias, situations] of biasPages) {
  const path = join(OUT, "biases", bias, "index.html");
  let html;
  try { html = await readFile(path, "utf8"); }
  catch { errors.push(`missing bias page for decision discovery: ${bias}`); continue; }
  if (!html.includes('class="decision-application-links"')) errors.push(`${bias}: missing decision application section`);
  for (const situation of situations.slice(0, 4)) {
    if (!html.includes(`/situations/${situation.slug}/`)) errors.push(`${bias}: missing situation link ${situation.slug}`);
  }
}

const knownSkills = new Set(skillsData.entries.map((skill) => skill.slug));
for (const [skill, situations] of skillPages) {
  if (!knownSkills.has(skill)) {
    errors.push(`unknown skill in situation map: ${skill}`);
    continue;
  }
  const path = join(OUT, "skills", skill, "index.html");
  let html;
  try { html = await readFile(path, "utf8"); }
  catch { errors.push(`missing skill page for decision discovery: ${skill}`); continue; }
  if (!html.includes('class="skill-situation-links"')) errors.push(`${skill}: missing situation application section`);
  for (const situation of situations) {
    if (!html.includes(`/situations/${situation.slug}/`)) errors.push(`${skill}: missing situation link ${situation.slug}`);
  }
}

const llms = await readFile(join(OUT, "llms.txt"), "utf8");
const requiredDiscovery = [
  "https://cognitive-biases.github.io/decide/",
  "https://cognitive-biases.github.io/situations/",
  "https://cognitive-biases.github.io/techniques/",
  "https://cognitive-biases.github.io/decide/for-agents/",
  "https://cognitive-biases.github.io/data/situations.json",
  "https://cognitive-biases.github.io/data/techniques.json",
  "https://cognitive-biases.github.io/data/decision-review-examples.json",
  "https://cognitive-biases.github.io/data/schemas/decision-review.schema.json",
  "https://cognitive-biases.github.io/about/editorial/",
  "https://cognitive-biases.github.io/data/project-trust.json",
  "return no match rather than inventing a label"
];
for (const item of requiredDiscovery) if (!llms.includes(item)) errors.push(`llms.txt missing decision-first discovery item: ${item}`);
const markerCount = (llms.match(/## Decision-first resources/g) || []).length;
if (markerCount !== 1) errors.push(`llms.txt decision-first marker count is ${markerCount}, expected 1`);

if (errors.length) {
  console.error("Decision discovery check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Decision discovery OK: ${biasPages.size} bias pages, ${skillPages.size} skill pages, and llms.txt are connected to the decision-first layer.`);
