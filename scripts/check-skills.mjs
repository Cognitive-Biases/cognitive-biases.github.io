import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const skillsDoc = JSON.parse(await readFile("data/skills.json", "utf8"));
const agentSkillsDoc = JSON.parse(await readFile("data/agent-skills.json", "utf8"));
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
await access("dist/schemas/skill.schema.json");
const hub = await readFile("dist/skills/index.html", "utf8");
if (!hub.includes("Decision Skills")) throw new Error("Skills hub is missing its title.");
if (!hub.includes('/agent-skills/')) throw new Error("Decision Skills hub does not expose the Agent Skills Marketplace.");

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

const agentSkills = agentSkillsDoc.skills || [];
if (agentSkills.length < 8) throw new Error(`Expected at least 8 portable agent skills, found ${agentSkills.length}.`);
if (agentSkillsDoc.standard !== "https://agentskills.io") throw new Error("Portable agent skills must declare the Agent Skills standard.");
if (agentSkillsDoc.security?.executableCode !== false || agentSkillsDoc.security?.secretsRequired !== false || agentSkillsDoc.security?.networkRequired !== false) throw new Error("Initial agent skills must remain instruction-only, secret-free and offline-capable.");

await access("dist/agent-skills/index.html");
await access("dist/agent-skills/catalog.json");
await access("dist/agent-skills/llms.txt");
await access("dist/data/agent-skills.json");
await access("dist/schemas/agent-skill.schema.json");
const agentHub = await readFile("dist/agent-skills/index.html", "utf8");
if (!agentHub.includes("Agent Skills Marketplace") || !agentHub.includes("Hermes Agent") || !agentHub.includes("OpenClaw")) throw new Error("Agent Skills Marketplace is missing core positioning or compatibility information.");

const publicAgentCatalogue = JSON.parse(await readFile("dist/agent-skills/catalog.json", "utf8"));
if (!Array.isArray(publicAgentCatalogue.skills) || publicAgentCatalogue.skills.length !== agentSkills.length) throw new Error("Agent Skills Marketplace catalog does not match canonical source data.");
const agentNames = new Set();
for (const skill of agentSkills) {
  if (!skill.name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.name) || agentNames.has(skill.name)) throw new Error(`Invalid or duplicate portable agent skill name: ${skill.name || "<missing>"}`);
  agentNames.add(skill.name);
  if (!skill.title || !skill.description || !skill.category) throw new Error(`${skill.name}: missing title, description or category.`);
  if (!Array.isArray(skill.procedure) || skill.procedure.length < 4) throw new Error(`${skill.name}: workflow is too thin.`);
  if (!Array.isArray(skill.guardrails) || skill.guardrails.length < 3) throw new Error(`${skill.name}: guardrails are too thin.`);
  if (skill.sourceDecisionSkill && !slugs.has(skill.sourceDecisionSkill)) throw new Error(`${skill.name}: unknown sourceDecisionSkill ${skill.sourceDecisionSkill}.`);

  const directory = join("dist", "agent-skills", skill.name);
  await access(join(directory, "index.html"));
  await access(join(directory, "SKILL.md"));
  const markdown = await readFile(join(directory, "SKILL.md"), "utf8");
  const html = await readFile(join(directory, "index.html"), "utf8");
  if (!markdown.startsWith("---\n") || !markdown.includes(`\nname: ${skill.name}\n`) || !markdown.includes("\ndescription: ")) throw new Error(`${skill.name}: SKILL.md is not Agent Skills-compatible.`);
  if (!markdown.includes("## Workflow") || !markdown.includes("## Required output") || !markdown.includes("## Evidence and safety boundaries")) throw new Error(`${skill.name}: SKILL.md is missing workflow/output/boundary sections.`);
  if (!html.includes(`https://cognitive-biases.github.io/agent-skills/${skill.name}/`)) throw new Error(`${skill.name}: marketplace page is missing its canonical URL.`);
  if (!html.includes("SKILL.md")) throw new Error(`${skill.name}: marketplace page does not expose the raw skill file.`);
}

const catalogue = JSON.parse(await readFile("dist/data/catalog.json", "utf8"));
const skillDistribution = (catalogue.distributions || []).find((item) => item.id === "skills");
if (!skillDistribution || !skillDistribution.url.endsWith("/data/skills.json")) throw new Error("Data catalogue is missing decision skills.");
const agentSkillDistribution = (catalogue.distributions || []).find((item) => item.id === "agent-skills");
if (!agentSkillDistribution || !agentSkillDistribution.url.endsWith("/data/agent-skills.json")) throw new Error("Data catalogue is missing portable agent skills.");

const metrics = JSON.parse(await readFile("dist/data/metrics.json", "utf8"));
if (metrics.skills !== skills.length) throw new Error("Corpus metrics do not include the correct decision skill count.");
if (metrics.agentSkills !== agentSkills.length) throw new Error("Corpus metrics do not include the correct agent skill count.");

const rag = await readFile("dist/data/rag.ndjson", "utf8");
for (const skill of skills) {
  if (!rag.includes(`\"resourceType\":\"skill\"`) || !rag.includes(`\"canonicalId\":\"${skill.slug}\"`)) throw new Error(`${skill.slug}: RAG distribution is missing the skill chunk.`);
}
for (const skill of agentSkills) {
  if (!rag.includes(`\"resourceType\":\"agent-skill\"`) || !rag.includes(`\"canonicalId\":\"${skill.name}\"`)) throw new Error(`${skill.name}: RAG distribution is missing the agent skill chunk.`);
}

const manifest = JSON.parse(await readFile("dist/data/manifest.json", "utf8"));
if (!(manifest.files || []).some((item) => item.path === "skills.json")) throw new Error("Release manifest is missing skills.json.");

const sitemap = await readFile("dist/sitemap.xml", "utf8");
if (!sitemap.includes("https://cognitive-biases.github.io/skills/")) throw new Error("Sitemap is missing the skills hub.");
for (const skill of skills) {
  if (!sitemap.includes(`https://cognitive-biases.github.io/skills/${skill.slug}/`)) throw new Error(`${skill.slug}: sitemap entry is missing.`);
}
if (!sitemap.includes("https://cognitive-biases.github.io/agent-skills/")) throw new Error("Sitemap is missing the Agent Skills Marketplace.");
for (const skill of agentSkills) {
  if (!sitemap.includes(`https://cognitive-biases.github.io/agent-skills/${skill.name}/`)) throw new Error(`${skill.name}: agent-skill sitemap entry is missing.`);
}

const llms = await readFile("llms.txt", "utf8");
if (!llms.includes("https://cognitive-biases.github.io/skills/") || !llms.includes("https://cognitive-biases.github.io/data/skills.json")) throw new Error("llms.txt does not expose the decision skills surfaces.");
const agentLlms = await readFile("dist/agent-skills/llms.txt", "utf8");
if (!agentLlms.includes("https://cognitive-biases.github.io/agent-skills/") || !agentLlms.includes("https://cognitive-biases.github.io/data/agent-skills.json") || !agentLlms.includes("SKILL.md")) throw new Error("Agent Skills llms.txt does not expose the marketplace, public data and installable skill files.");

console.log(`Skills check passed: ${skills.length} decision skills and ${agentSkills.length} portable agent skills with human and machine discovery.`);
