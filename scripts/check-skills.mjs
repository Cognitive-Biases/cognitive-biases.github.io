import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const skillsDoc = JSON.parse(await readFile("data/skills.json", "utf8"));
const contextsDoc = JSON.parse(await readFile("data/contexts.json", "utf8"));
const biases = JSON.parse(await readFile("data/biases.json", "utf8"));
const duplicates = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));

const contexts = new Set((contextsDoc.entries || []).map((entry) => entry.slug));
const byBiasSlug = new Map(biases.map((bias) => [bias.slug, bias]));
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const evidence = new Set(evidenceDocs.flatMap((document) => document.reviews || []).map((review) => review.slug));

const skills = skillsDoc.entries || [];
if (skills.length < 5) throw new Error(`Expected at least 5 decision skills, found ${skills.length}.`);

const slugs = new Set();
for (const skill of skills) {
  if (!skill.slug || slugs.has(skill.slug)) throw new Error(`Duplicate or missing skill slug: ${skill.slug || "<missing>"}`);
  slugs.add(skill.slug);
  if (!skill.title || !skill.summary || !skill.outcome) throw new Error(`${skill.slug}: title, summary and outcome are required.`);
  if (!Array.isArray(skill.whenToUse) || skill.whenToUse.length < 2) throw new Error(`${skill.slug}: at least two whenToUse items are required.`);
  if (!Array.isArray(skill.actions) || skill.actions.length < 2) throw new Error(`${skill.slug}: at least two actions are required.`);
  if (!Array.isArray(skill.contexts) || skill.contexts.length === 0) throw new Error(`${skill.slug}: at least one context is required.`);
  if (!Array.isArray(skill.biases) || skill.biases.length < 2) throw new Error(`${skill.slug}: at least two biases are required.`);

  for (const contextSlug of skill.contexts) {
    if (!contexts.has(contextSlug)) throw new Error(`${skill.slug}: unknown context ${contextSlug}.`);
  }

  for (const biasSlug of skill.biases) {
    const bias = byBiasSlug.get(biasSlug);
    if (!bias) throw new Error(`${skill.slug}: unknown bias ${biasSlug}.`);
    if (!bias.published) throw new Error(`${skill.slug}: unpublished bias ${biasSlug}.`);
    if (duplicateIds.has(bias.id)) throw new Error(`${skill.slug}: duplicate/non-canonical bias ${biasSlug}.`);
    if (!evidence.has(biasSlug)) throw new Error(`${skill.slug}: bias ${biasSlug} is not evidence-reviewed.`);
  }
}

await access("dist/skills/index.html");
await access("dist/data/skills.json");
const hub = await readFile("dist/skills/index.html", "utf8");
if (!hub.includes("Decision Skills")) throw new Error("Skills hub is missing its title.");

for (const skill of skills) {
  const path = join("dist", "skills", skill.slug, "index.html");
  await access(path);
  const html = await readFile(path, "utf8");
  if (!html.includes(skill.title)) throw new Error(`${skill.slug}: generated page is missing its title.`);
  if (!html.includes(`https://cognitive-biases.github.io/skills/${skill.slug}/`)) throw new Error(`${skill.slug}: generated page is missing its canonical URL.`);
  if (!html.includes("LearningResource")) throw new Error(`${skill.slug}: generated page is missing LearningResource structured data.`);
}

const publicData = JSON.parse(await readFile("dist/data/skills.json", "utf8"));
if (!Array.isArray(publicData.skills) || publicData.skills.length !== skills.length) throw new Error("Public skills data does not match canonical skills data.");

console.log(`Decision skills check passed: ${skills.length} skills.`);
