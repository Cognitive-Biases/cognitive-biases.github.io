import { createHash } from "node:crypto";
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
const publishedCanonicalBiases = biases.filter((bias) => bias.published && !duplicateIds.has(bias.id));
const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const evidence = new Set(evidenceDocs.flatMap((document) => document.reviews || []).map((review) => review.slug));

function skillNameForBias(bias) {
  const base = `bias-${String(bias.slug).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-")}`;
  if (base.length <= 64) return base;
  const suffix = createHash("sha1").update(String(bias.slug)).digest("hex").slice(0, 8);
  return `${base.slice(0, 55).replace(/-+$/g, "")}-${suffix}`;
}

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

const workflowAgentSkills = agentSkillsDoc.skills || [];
if (workflowAgentSkills.length < 8) throw new Error(`Expected at least 8 workflow agent skills, found ${workflowAgentSkills.length}.`);
if (agentSkillsDoc.standard !== "https://agentskills.io") throw new Error("Portable agent skills must declare the Agent Skills standard.");
if (agentSkillsDoc.security?.executableCode !== false || agentSkillsDoc.security?.secretsRequired !== false || agentSkillsDoc.security?.networkRequired !== false) throw new Error("Agent skills must remain instruction-only, secret-free and offline-capable unless deliberately reviewed otherwise.");
if (!publishedCanonicalBiases.length) throw new Error("No published canonical biases found for Agent Skill generation.");

const cognitiveBiasLens = workflowAgentSkills.find((skill) => skill.name === "cognitive-bias-lens");
if (!cognitiveBiasLens) throw new Error("Agent Skills Marketplace must keep the cognitive-bias-lens generic coverage skill.");
const cognitiveBiasLensReferences = new Set((cognitiveBiasLens.references || []).map((item) => item.url));
if (!cognitiveBiasLensReferences.has("https://cognitive-biases.github.io/data/biases.json")) throw new Error("cognitive-bias-lens must reference the canonical public bias dataset.");

const portableByDecisionSkill = new Map(workflowAgentSkills.filter((skill) => skill.sourceDecisionSkill).map((skill) => [skill.sourceDecisionSkill, skill]));
for (const skill of skills) {
  if (!portableByDecisionSkill.has(skill.slug)) throw new Error(`${skill.slug}: every public Decision Skill must have a mapped workflow Agent Skill.`);
}

await access("dist/agent-skills/index.html");
await access("dist/agent-skills/catalog.json");
await access("dist/agent-skills/llms.txt");
await access("dist/agent-skills/biases/index.html");
await access("dist/agent-skills/biases/catalog.json");
await access("dist/data/agent-skills.json");
await access("dist/schemas/agent-skill.schema.json");

const agentHub = await readFile("dist/agent-skills/index.html", "utf8");
if (!agentHub.includes("Agent Skills Marketplace") || !agentHub.includes("Hermes Agent") || !agentHub.includes("OpenClaw")) throw new Error("Agent Skills Marketplace is missing core positioning or compatibility information.");
if (!agentHub.includes("/agent-skills/biases/")) throw new Error("Agent Skills Marketplace does not expose the per-bias skill collection.");
if (!agentHub.includes("free to install")) throw new Error("Agent Skills Marketplace must state that all skills are free to install.");

const publicAgentCatalogue = JSON.parse(await readFile("dist/agent-skills/catalog.json", "utf8"));
const publicAgentData = JSON.parse(await readFile("dist/data/agent-skills.json", "utf8"));
const biasCatalogue = JSON.parse(await readFile("dist/agent-skills/biases/catalog.json", "utf8"));
const expectedTotal = workflowAgentSkills.length + publishedCanonicalBiases.length;
if (!Array.isArray(publicAgentCatalogue.skills) || publicAgentCatalogue.skills.length !== expectedTotal) throw new Error(`Agent Skills Marketplace must contain ${expectedTotal} skills (${workflowAgentSkills.length} workflow + ${publishedCanonicalBiases.length} bias), found ${publicAgentCatalogue.skills?.length || 0}.`);
if (!Array.isArray(publicAgentData.skills) || publicAgentData.skills.length !== expectedTotal) throw new Error("Public agent-skills data does not match the full marketplace catalog.");
if (!Array.isArray(biasCatalogue.skills) || biasCatalogue.skills.length !== publishedCanonicalBiases.length) throw new Error("Bias Skills catalog does not contain one skill per published canonical bias.");
if (publicAgentCatalogue.biasSkillCount !== publishedCanonicalBiases.length || publicAgentCatalogue.workflowSkillCount !== workflowAgentSkills.length || publicAgentCatalogue.totalSkillCount !== expectedTotal) throw new Error("Agent Skills catalog counts are inconsistent.");
if (publicAgentCatalogue.allSkillsFreeToInstall !== true || biasCatalogue.allSkillsFreeToInstall !== true) throw new Error("All Agent Skills must remain marked free to install.");

const publicByName = new Map(publicAgentCatalogue.skills.map((skill) => [skill.name, skill]));
const agentNames = new Set();
for (const skill of workflowAgentSkills) {
  if (!skill.name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.name) || agentNames.has(skill.name)) throw new Error(`Invalid or duplicate workflow agent skill name: ${skill.name || "<missing>"}`);
  agentNames.add(skill.name);
  if (!skill.title || !skill.description || !skill.category) throw new Error(`${skill.name}: missing title, description or category.`);
  if (!Array.isArray(skill.procedure) || skill.procedure.length < 4) throw new Error(`${skill.name}: workflow is too thin.`);
  if (!Array.isArray(skill.guardrails) || skill.guardrails.length < 3) throw new Error(`${skill.name}: guardrails are too thin.`);
  if (skill.sourceDecisionSkill && !slugs.has(skill.sourceDecisionSkill)) throw new Error(`${skill.name}: unknown sourceDecisionSkill ${skill.sourceDecisionSkill}.`);
  if (!publicByName.has(skill.name)) throw new Error(`${skill.name}: workflow Agent Skill is missing from the public catalog.`);

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

const biasSkillNames = new Set();
for (const bias of publishedCanonicalBiases) {
  const skillName = skillNameForBias(bias);
  if (skillName.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skillName) || biasSkillNames.has(skillName) || agentNames.has(skillName)) throw new Error(`${bias.slug}: invalid or colliding generated bias skill name ${skillName}.`);
  biasSkillNames.add(skillName);
  const record = publicByName.get(skillName);
  if (!record) throw new Error(`${bias.slug}: missing individual Agent Skill ${skillName}.`);
  if (record.sourceBias !== bias.slug || record.category !== "bias-lens") throw new Error(`${bias.slug}: generated Agent Skill is not linked to its canonical bias.`);
  if (record.sourceDecisionSkill !== null) throw new Error(`${bias.slug}: per-bias skill must not pretend to be a Decision Skill mapping.`);
  if (!record.skillFile.endsWith(`/agent-skills/${skillName}/SKILL.md`)) throw new Error(`${bias.slug}: generated skill file URL is incorrect.`);

  const directory = join("dist", "agent-skills", skillName);
  const skillFilePath = join(directory, "SKILL.md");
  const skillPagePath = join(directory, "index.html");
  await access(skillFilePath);
  await access(skillPagePath);
  const markdown = await readFile(skillFilePath, "utf8");
  const html = await readFile(skillPagePath, "utf8");
  if (!markdown.startsWith("---\n") || !markdown.includes(`\nname: ${skillName}\n`) || !markdown.includes("## Canonical bias") || !markdown.includes(`https://cognitive-biases.github.io/biases/${bias.slug}/`)) throw new Error(`${bias.slug}: generated SKILL.md is incomplete or detached from the canonical bias.`);
  if (!markdown.includes("## Workflow") || !markdown.includes("## Required output") || !markdown.includes("## Evidence and safety boundaries")) throw new Error(`${bias.slug}: generated SKILL.md is missing its workflow/output/boundaries.`);
  if (!html.includes(`https://cognitive-biases.github.io/agent-skills/${skillName}/`) || !html.includes("Free cognitive-bias Agent Skill")) throw new Error(`${bias.slug}: generated marketplace page is incomplete.`);

  const biasPage = await readFile(join("dist", "biases", bias.slug, "index.html"), "utf8");
  if (!biasPage.includes(`/agent-skills/${skillName}/`)) throw new Error(`${bias.slug}: canonical bias page does not link to its individual Agent Skill.`);
}

const catalogue = JSON.parse(await readFile("dist/data/catalog.json", "utf8"));
const skillDistribution = (catalogue.distributions || []).find((item) => item.id === "skills");
if (!skillDistribution || !skillDistribution.url.endsWith("/data/skills.json")) throw new Error("Data catalogue is missing decision skills.");
const agentSkillDistribution = (catalogue.distributions || []).find((item) => item.id === "agent-skills");
if (!agentSkillDistribution || !agentSkillDistribution.url.endsWith("/data/agent-skills.json")) throw new Error("Data catalogue is missing portable agent skills.");

const metrics = JSON.parse(await readFile("dist/data/metrics.json", "utf8"));
if (metrics.skills !== skills.length) throw new Error("Corpus metrics do not include the correct decision skill count.");
if (metrics.agentSkills !== expectedTotal || metrics.biasAgentSkills !== publishedCanonicalBiases.length || metrics.workflowAgentSkills !== workflowAgentSkills.length) throw new Error("Corpus metrics do not include the correct Agent Skill counts.");

const rag = await readFile("dist/data/rag.ndjson", "utf8");
for (const skill of skills) {
  if (!rag.includes(`\"resourceType\":\"skill\"`) || !rag.includes(`\"canonicalId\":\"${skill.slug}\"`)) throw new Error(`${skill.slug}: RAG distribution is missing the skill chunk.`);
}
for (const skill of workflowAgentSkills) {
  if (!rag.includes(`\"resourceType\":\"agent-skill\"`) || !rag.includes(`\"canonicalId\":\"${skill.name}\"`)) throw new Error(`${skill.name}: RAG distribution is missing the workflow Agent Skill chunk.`);
}
for (const bias of publishedCanonicalBiases) {
  const skillName = skillNameForBias(bias);
  if (!rag.includes(`\"canonicalId\":\"${skillName}\"`) || !rag.includes(`\"section\":\"bias-lens\"`)) throw new Error(`${bias.slug}: RAG distribution is missing the per-bias Agent Skill chunk.`);
}

const manifest = JSON.parse(await readFile("dist/data/manifest.json", "utf8"));
if (!(manifest.files || []).some((item) => item.path === "skills.json")) throw new Error("Release manifest is missing skills.json.");

const sitemap = await readFile("dist/sitemap.xml", "utf8");
if (!sitemap.includes("https://cognitive-biases.github.io/skills/")) throw new Error("Sitemap is missing the skills hub.");
for (const skill of skills) {
  if (!sitemap.includes(`https://cognitive-biases.github.io/skills/${skill.slug}/`)) throw new Error(`${skill.slug}: sitemap entry is missing.`);
}
if (!sitemap.includes("https://cognitive-biases.github.io/agent-skills/") || !sitemap.includes("https://cognitive-biases.github.io/agent-skills/biases/")) throw new Error("Sitemap is missing Agent Skills discovery surfaces.");
for (const skill of workflowAgentSkills) {
  if (!sitemap.includes(`https://cognitive-biases.github.io/agent-skills/${skill.name}/`)) throw new Error(`${skill.name}: workflow Agent Skill sitemap entry is missing.`);
}
for (const bias of publishedCanonicalBiases) {
  const skillName = skillNameForBias(bias);
  if (!sitemap.includes(`https://cognitive-biases.github.io/agent-skills/${skillName}/`)) throw new Error(`${bias.slug}: individual Agent Skill sitemap entry is missing.`);
}

const llms = await readFile("llms.txt", "utf8");
if (!llms.includes("https://cognitive-biases.github.io/skills/") || !llms.includes("https://cognitive-biases.github.io/data/skills.json")) throw new Error("llms.txt does not expose the decision skills surfaces.");
const agentLlms = await readFile("dist/agent-skills/llms.txt", "utf8");
if (!agentLlms.includes("https://cognitive-biases.github.io/agent-skills/") || !agentLlms.includes("https://cognitive-biases.github.io/data/agent-skills.json") || !agentLlms.includes("Bias Skills collection:") || !agentLlms.includes("SKILL.md")) throw new Error("Agent Skills llms.txt does not expose the marketplace, Bias Skills collection, public data and installable skill files.");

console.log(`Skills check passed: ${skills.length} Decision Skills, ${workflowAgentSkills.length} workflow Agent Skills and ${publishedCanonicalBiases.length} individual bias Agent Skills (${expectedTotal} Agent Skills total).`);
