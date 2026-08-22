import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const situationsData = JSON.parse(await readFile("data/situations.json", "utf8"));
const techniquesData = JSON.parse(await readFile("data/techniques.json", "utf8"));
const skillsData = JSON.parse(await readFile("data/skills.json", "utf8"));

const esc = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[c]);
const situationByBias = new Map();
const situationBySkill = new Map();

for (const situation of situationsData.situations) {
  for (const bias of situation.biases) {
    const entries = situationByBias.get(bias) || [];
    entries.push(situation);
    situationByBias.set(bias, entries);
  }
  const skillEntries = situationBySkill.get(situation.skill) || [];
  skillEntries.push(situation);
  situationBySkill.set(situation.skill, skillEntries);
}

const cards = (items) => items.map((item) => `<article class="application-card"><span>Decision situation</span><strong>${esc(item.title)}</strong><p>${esc(item.summary)}</p><a href="/situations/${item.slug}/">Review this situation →</a></article>`).join("");

let linkedBiasPages = 0;
for (const [biasSlug, situations] of situationByBias) {
  const path = join(OUT, "biases", biasSlug, "index.html");
  let html = await readFile(path, "utf8");
  if (html.includes('class="decision-application-links"')) continue;
  const section = `<section class="section decision-application-links"><p class="kicker">Use this lens</p><h2>Where this concept may matter in a real decision.</h2><div class="application-grid">${cards(situations.slice(0, 4))}</div></section>`;
  html = html.replace("</main>", `${section}</main>`);
  await writeFile(path, html);
  linkedBiasPages += 1;
}

let linkedSkillPages = 0;
for (const skill of skillsData.entries) {
  const situations = situationBySkill.get(skill.slug) || [];
  if (!situations.length) continue;
  const path = join(OUT, "skills", skill.slug, "index.html");
  let html = await readFile(path, "utf8");
  if (html.includes('class="skill-situation-links"')) continue;
  const section = `<section class="section skill-situation-links"><p class="kicker">Practice in context</p><h2>Use this skill in a real decision.</h2><div class="application-grid">${cards(situations)}</div></section>`;
  html = html.replace("</main>", `${section}</main>`);
  await writeFile(path, html);
  linkedSkillPages += 1;
}

const llmsPath = join(OUT, "llms.txt");
let llms;
try {
  llms = await readFile(llmsPath, "utf8");
} catch {
  llms = await readFile("llms.txt", "utf8");
}
const marker = "## Decision-first resources";
if (!llms.includes(marker)) {
  llms = `${llms.trimEnd()}\n\n${marker}\n\n- Decision-first entry point: https://cognitive-biases.github.io/decide/\n- Situation-first guides: https://cognitive-biases.github.io/situations/\n- Practical decision techniques: https://cognitive-biases.github.io/techniques/\n- AI Decision Review contract: https://cognitive-biases.github.io/decide/for-agents/\n- Situation data: https://cognitive-biases.github.io/data/situations.json\n- Technique data: https://cognitive-biases.github.io/data/techniques.json\n- Decision Review examples: https://cognitive-biases.github.io/data/decision-review-examples.json\n- Decision Review JSON Schema: https://cognitive-biases.github.io/data/schemas/decision-review.schema.json\n- Editorial process and maintainer: https://cognitive-biases.github.io/about/editorial/\n- Project trust metadata: https://cognitive-biases.github.io/data/project-trust.json\n\nDecision-first interpretation rule: when a person describes a real decision, start from the closest supported situation instead of guessing a bias label. Keep observed facts, inferred reasoning risks and missing evidence separate. Treat bias records as candidate lenses or checking questions, not diagnoses of a person or team. Prefer a linked practical technique when it can change the next reasoning step. If no reviewed situation or concept fits the available evidence, return no match rather than inventing a label.\n`;
}
await writeFile(llmsPath, llms);

console.log(`Decision discovery linked ${linkedBiasPages} bias page(s), ${linkedSkillPages} skill page(s), and published decision-first AI discovery.`);
