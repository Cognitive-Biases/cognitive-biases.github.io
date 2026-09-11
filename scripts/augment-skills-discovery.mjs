import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_OUT, OUT, SITE, readJson, writeJson, hashFile, hashText, slugify } from "./lib/knowledge.mjs";

const release = await readJson("data/release.json");
const skillsPayload = await readJson(join(DATA_OUT, "skills.json"));
const skills = skillsPayload.skills || [];
const agentSkillsDoc = await readJson("data/agent-skills.json");
const agentSkills = agentSkillsDoc.skills || [];

if (!skills.length) throw new Error("No generated decision skills found in dist/data/skills.json.");
if (agentSkills.length < 2) throw new Error("Expected at least two portable agent skills.");

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const yamlString = (value = "") => JSON.stringify(String(value));
const list = (items = []) => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
const brand = (size, alt) => `<picture class="brand-picture"><source type="image/webp" srcset="/assets/brand.webp"><img src="/assets/biases_icon.png" width="${size}" height="${size}" alt="${escapeHtml(alt)}"></picture>`;
const header = () => `<header class="site-header"><a class="brand" href="/">${brand(48, "Cognitive Biases icon")}<span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/explore/">Explore</a><a href="/contexts/">Decision guides</a><a href="/skills/">Skills</a><a href="/agent-skills/" aria-current="page">Agent skills</a><a href="/evidence/">Evidence</a><a href="/data/">Data</a></nav></header>`;
const footer = () => `<footer class="site-footer"><div><a class="brand brand--footer" href="/">${brand(40, "")}<span>Cognitive Biases</span></a><p>A public guide to cognitive biases, evidence and better decisions.</p></div><div class="footer-links"><a href="/agent-skills/">Agent Skills Marketplace</a><a href="/skills/">Decision skills</a><a href="/contexts/">Decision guides</a><a href="/methodology/">Methodology</a><a href="/data/">Data</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p></footer>`;
const marketplaceStyle = `<style>.agent-badges{display:flex;flex-wrap:wrap;gap:.55rem;margin:1rem 0}.agent-badge{display:inline-block;border:2px solid currentColor;border-radius:999px;padding:.2rem .55rem;font-size:.78rem;font-weight:900}.agent-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}.agent-card{border:3px solid currentColor;padding:1.25rem;background:#fff;color:#101622}.agent-card h2,.agent-card h3{margin:.2rem 0 .6rem}.agent-card p:last-child{margin-bottom:0}.agent-install{background:#101622;color:#fff;padding:1.2rem;border-radius:.2rem;overflow:auto;font-size:.86rem}.agent-install code{white-space:pre-wrap}.agent-safety{border-left:8px solid #ffe34f;padding:1rem 1.2rem;background:#fff}.agent-meta{font-size:.88rem;color:#596273}.agent-raw{display:inline-block;margin-top:.75rem}@media(max-width:760px){.agent-grid{grid-template-columns:1fr}}</style>`;

await writeJson(join(OUT, "schemas", "skill.schema.json"), {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": `${SITE}/schemas/skill.schema.json`,
  type: "object",
  title: "Decision skill",
  additionalProperties: true,
  required: ["slug", "title", "summary", "outcome", "contexts", "lenses", "canonicalUrl"],
  properties: {
    slug: { type: "string" },
    title: { type: "string" },
    summary: { type: "string" },
    outcome: { type: "string" },
    whenToUse: { type: "array", items: { type: "string" } },
    actions: { type: "array", items: { type: "string" } },
    contexts: { type: "array" },
    lenses: { type: "array" },
    canonicalUrl: { type: "string" }
  }
});

await writeJson(join(OUT, "schemas", "agent-skill.schema.json"), {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": `${SITE}/schemas/agent-skill.schema.json`,
  type: "object",
  title: "Portable agent skill",
  additionalProperties: false,
  required: ["name", "title", "description", "category", "skillFile", "canonicalUrl", "security"],
  properties: {
    name: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
    title: { type: "string" },
    description: { type: "string" },
    category: { type: "string" },
    sourceDecisionSkill: { type: ["string", "null"] },
    skillFile: { type: "string", format: "uri" },
    canonicalUrl: { type: "string", format: "uri" },
    compatibility: { type: "array", items: { type: "string" } },
    security: { type: "object" }
  }
});

const cataloguePath = join(DATA_OUT, "catalog.json");
const catalogue = await readJson(cataloguePath);
if (!catalogue.distributions.some((item) => item.id === "skills")) {
  catalogue.distributions.splice(3, 0, {
    id: "skills",
    format: "application/json",
    url: `${SITE}/data/skills.json`,
    schema: `${SITE}/schemas/skill.schema.json`
  });
}
if (!catalogue.distributions.some((item) => item.id === "agent-skills")) {
  catalogue.distributions.splice(4, 0, {
    id: "agent-skills",
    format: "application/json",
    url: `${SITE}/data/agent-skills.json`,
    schema: `${SITE}/schemas/agent-skill.schema.json`
  });
}
await writeJson(cataloguePath, catalogue);

const metricsPath = join(DATA_OUT, "metrics.json");
const metrics = await readJson(metricsPath);
metrics.skills = skills.length;
metrics.agentSkills = agentSkills.length;
await writeJson(metricsPath, metrics);

const mappedDecisionSkills = new Map(skills.map((skill) => [skill.slug, skill]));
const seenAgentNames = new Set();
const publicAgentSkills = [];

function buildSkillMarkdown(skill, mapped) {
  const references = [...(skill.references || [])];
  if (mapped && !references.some((item) => item.url === mapped.canonicalUrl)) references.unshift({ label: "Decision skill", url: mapped.canonicalUrl });
  const lensLines = mapped?.lenses?.length
    ? ["", "## Evidence-linked lenses", "", "Use these as candidate lenses, not diagnoses:", "", ...mapped.lenses.map((lens) => `- [${lens.title}](${lens.url}) — ${lens.qualification || lens.evidenceStatus || "See the linked evidence review."}`)]
    : [];
  return `---\nname: ${skill.name}\ndescription: ${yamlString(skill.description)}\n---\n\n# ${skill.title}\n\n${skill.description}\n\n## When to use\n\n${(skill.useWhen || []).map((item) => `- ${item}`).join("\n")}\n\n## Workflow\n\n${(skill.procedure || []).map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\n## Required output\n\n${(skill.output || []).map((item) => `- ${item}`).join("\n")}\n\n## Evidence and safety boundaries\n\n${(skill.guardrails || []).map((item) => `- ${item}`).join("\n")}${lensLines.join("\n")}\n\n## References\n\n${references.map((item) => `- [${item.label}](${item.url})`).join("\n")}\n\n## Portability\n\nThis is an instruction-only Agent Skill. It requires no secrets, no executable scripts and no network access to run. If source-access tools are available, use the linked Cognitive Biases material to preserve review state and uncertainty.\n\nLicence: CC BY-NC-SA 4.0. Commercial reuse requires prior written permission.\n`;
}

for (const skill of agentSkills) {
  if (!skill.name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.name) || seenAgentNames.has(skill.name)) throw new Error(`Invalid or duplicate agent skill name: ${skill.name || "<missing>"}`);
  seenAgentNames.add(skill.name);
  if (!skill.title || !skill.description || !skill.category) throw new Error(`${skill.name}: title, description and category are required.`);
  if (!Array.isArray(skill.useWhen) || skill.useWhen.length < 2) throw new Error(`${skill.name}: add at least two useWhen items.`);
  if (!Array.isArray(skill.procedure) || skill.procedure.length < 4) throw new Error(`${skill.name}: add at least four procedure steps.`);
  if (!Array.isArray(skill.output) || skill.output.length < 3) throw new Error(`${skill.name}: define a useful output contract.`);
  if (!Array.isArray(skill.guardrails) || skill.guardrails.length < 3) throw new Error(`${skill.name}: define at least three guardrails.`);
  const mapped = skill.sourceDecisionSkill ? mappedDecisionSkills.get(skill.sourceDecisionSkill) : null;
  if (skill.sourceDecisionSkill && !mapped) throw new Error(`${skill.name}: unknown source decision skill ${skill.sourceDecisionSkill}.`);

  const canonicalUrl = `${SITE}/agent-skills/${skill.name}/`;
  const skillFile = `${canonicalUrl}SKILL.md`;
  const hermesCommand = `mkdir -p ~/.hermes/skills/${skill.name} && curl -fsSL ${skillFile} -o ~/.hermes/skills/${skill.name}/SKILL.md`;
  const openClawCommand = `mkdir -p ~/.openclaw/workspace/skills/${skill.name} && curl -fsSL ${skillFile} -o ~/.openclaw/workspace/skills/${skill.name}/SKILL.md`;
  const compatibility = ["Agent Skills", "Hermes Agent", "OpenClaw", "ChatGPT Skills", "Codex"];
  const record = {
    name: skill.name,
    title: skill.title,
    description: skill.description,
    category: skill.category,
    sourceDecisionSkill: skill.sourceDecisionSkill || null,
    skillFile,
    canonicalUrl,
    compatibility,
    install: { hermes: hermesCommand, openclaw: openClawCommand, generic: `Download ${skillFile} into <agent-skill-root>/${skill.name}/SKILL.md.` },
    security: agentSkillsDoc.security
  };
  publicAgentSkills.push(record);

  const targetDir = join(OUT, "agent-skills", skill.name);
  await mkdir(targetDir, { recursive: true });
  await writeFile(join(targetDir, "SKILL.md"), buildSkillMarkdown(skill, mapped));

  const lenses = mapped?.lenses || [];
  const lensesHtml = lenses.length ? `<section class="section"><p class="kicker">Evidence-linked lenses</p><h2>The skill checks patterns. It does not diagnose people.</h2><div class="agent-grid">${lenses.map((lens) => `<article class="agent-card"><h3><a href="${lens.url}">${escapeHtml(lens.title)}</a></h3><p>${escapeHtml(lens.qualification || lens.evidenceStatus || "See the evidence review.")}</p></article>`).join("")}</div></section>` : "";
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CreativeWork", "@id": `${canonicalUrl}#skill`, url: canonicalUrl, name: skill.title, description: skill.description, isAccessibleForFree: true, inLanguage: "en", license: `${SITE}/LICENSE`, learningResourceType: "Agent Skill" },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Agent Skills", item: `${SITE}/agent-skills/` },
        { "@type": "ListItem", position: 3, name: skill.title, item: canonicalUrl }
      ] }
    ]
  };
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${escapeHtml(skill.title)} Agent Skill | Cognitive Biases</title><meta name="description" content="${escapeHtml(skill.description)}"><link rel="canonical" href="${canonicalUrl}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="${escapeHtml(skill.title)} Agent Skill"><meta property="og:description" content="${escapeHtml(skill.description)}"><meta property="og:url" content="${canonicalUrl}"><link rel="stylesheet" href="/styles.css">${marketplaceStyle}<script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip" href="#main">Skip to content</a>${header()}<main id="main"><section class="page-hero"><p class="eyebrow">Free portable Agent Skill</p><h1>${escapeHtml(skill.title)}</h1><p class="lede">${escapeHtml(skill.description)}</p><div class="agent-badges">${compatibility.map((item) => `<span class="agent-badge">${escapeHtml(item)}</span>`).join("")}</div><p><a class="button" href="SKILL.md">Open SKILL.md</a> <a class="button button--dark" href="/agent-skills/">Back to marketplace</a></p></section><section class="section"><p class="kicker">What it does</p><h2>A repeatable workflow, not another bias-name list.</h2><div class="agent-grid"><article class="agent-card"><h3>Use it when</h3>${list(skill.useWhen)}</article><article class="agent-card"><h3>It returns</h3>${list(skill.output)}</article></div></section><section class="section section--ink"><p class="kicker">Install</p><h2>One SKILL.md. No API key.</h2><p>Hermes Agent</p><pre class="agent-install"><code>${escapeHtml(hermesCommand)}</code></pre><p>OpenClaw</p><pre class="agent-install"><code>${escapeHtml(openClawCommand)}</code></pre><p>Other Agent Skills-compatible tools</p><p>Download <a href="SKILL.md">SKILL.md</a> and place it in the skill directory supported by your agent. ChatGPT Skills and Codex support the Agent Skills format; their installation surface can vary by product.</p></section><section class="section"><p class="kicker">Safety boundary</p><h2>Useful skepticism without amateur diagnosis.</h2><div class="agent-safety">${list(skill.guardrails)}</div><p class="agent-meta">Instruction-only · no secrets · no executable code · no required network access · CC BY-NC-SA 4.0</p></section>${lensesHtml}</main>${footer()}</body></html>`;
  await writeFile(join(targetDir, "index.html"), page);
}

const agentCatalog = {
  schemaVersion: agentSkillsDoc.schemaVersion,
  updatedAt: agentSkillsDoc.updatedAt,
  standard: agentSkillsDoc.standard,
  license: agentSkillsDoc.license,
  security: agentSkillsDoc.security,
  marketplace: `${SITE}/agent-skills/`,
  skills: publicAgentSkills
};
await mkdir(join(OUT, "agent-skills"), { recursive: true });
await writeJson(join(OUT, "agent-skills", "catalog.json"), agentCatalog);
await writeJson(join(DATA_OUT, "agent-skills.json"), agentCatalog);

const hubCanonical = `${SITE}/agent-skills/`;
const hubSchema = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "CollectionPage", "@id": `${hubCanonical}#page`, url: hubCanonical, name: "Cognitive Biases Agent Skills Marketplace", description: "Free, portable Agent Skills for evidence-aware decision making, verification, forecasting and AI-assisted reasoning." },
    { "@type": "ItemList", numberOfItems: publicAgentSkills.length, itemListElement: publicAgentSkills.map((skill, index) => ({ "@type": "ListItem", position: index + 1, name: skill.title, url: skill.canonicalUrl })) }
  ]
};
const hubCards = publicAgentSkills.map((skill) => `<article class="agent-card"><p class="kicker">${escapeHtml(skill.category)}</p><h2><a href="/agent-skills/${skill.name}/">${escapeHtml(skill.title)}</a></h2><p>${escapeHtml(skill.description)}</p><p><a href="/agent-skills/${skill.name}/">Install and inspect →</a></p></article>`).join("");
const hubPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>Free Cognitive Bias Agent Skills for Hermes, OpenClaw & Agent Skills</title><meta name="description" content="Install free, evidence-aware cognitive bias Agent Skills for decision review, research, forecasting, verification and AI-assisted reasoning."><link rel="canonical" href="${hubCanonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="Cognitive Biases Agent Skills Marketplace"><meta property="og:description" content="Portable SKILL.md workflows for better decisions. Free to install, evidence-aware and instruction-only."><meta property="og:url" content="${hubCanonical}"><link rel="stylesheet" href="/styles.css">${marketplaceStyle}<script type="application/ld+json">${JSON.stringify(hubSchema)}</script></head><body><a class="skip" href="#main">Skip to content</a>${header()}<main id="main"><section class="page-hero"><p class="eyebrow">Agent Skills Marketplace</p><h1>Give your agent a better way to doubt itself.</h1><p class="lede">Install practical cognitive-bias workflows as portable <code>SKILL.md</code> files. The same skill can be used across Agent Skills-compatible tools instead of being rewritten for every agent.</p><div class="agent-badges"><span class="agent-badge">Hermes Agent</span><span class="agent-badge">OpenClaw</span><span class="agent-badge">ChatGPT Skills</span><span class="agent-badge">Codex</span><span class="agent-badge">Agent Skills</span></div></section><section class="section"><p class="kicker">Why this is different</p><h2>A bias is a lens. A skill is a job your agent can actually do.</h2><p class="lede">We do not create hundreds of tiny skills that merely repeat bias definitions. The marketplace packages useful workflows: review a decision, challenge evidence, forecast, verify information or use AI without letting fluent output become evidence.</p><div class="agent-safety"><strong>Trust boundary:</strong> the initial collection is instruction-only. It contains no executable scripts, requests no secrets and needs no external API to run.</div></section><section class="section section--ink"><p class="kicker">Marketplace</p><h2>${publicAgentSkills.length} skills in the first collection.</h2><div class="agent-grid">${hubCards}</div></section><section class="section"><p class="kicker">Portable by design</p><h2>Inspect first. Install second.</h2><p>Every listing exposes the complete <code>SKILL.md</code> before installation. Hermes and OpenClaw get direct copy commands. Other Agent Skills-compatible tools can use the same file through their own skill import or skill-directory mechanism.</p><p><a class="button" href="/agent-skills/catalog.json">Machine-readable catalog</a> <a class="button button--dark" href="/data/agent-skills.json">Public data</a></p><p class="agent-meta">Free to install. Current content licence: CC BY-NC-SA 4.0; commercial reuse requires prior written permission.</p></section></main>${footer()}</body></html>`;
await writeFile(join(OUT, "agent-skills", "index.html"), hubPage);

const ragPath = join(DATA_OUT, "rag.ndjson");
let rag = await readFile(ragPath, "utf8");
const existingIds = new Set(rag.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line).chunkId));
const newChunks = [];
for (const skill of skills) {
  const chunkId = `cb-skill-${slugify(skill.slug)}-guide`;
  if (existingIds.has(chunkId)) continue;
  const text = [
    skill.summary,
    `Learning outcome: ${skill.outcome}`,
    ...(skill.whenToUse || []).map((item) => `Use when: ${item}`),
    ...(skill.actions || []).map((item) => `Action: ${item}`),
    ...(skill.lenses || []).map((lens) => `Reviewed lens: ${lens.title}. ${lens.qualification || ""}`)
  ].join(" ").replace(/\s+/g, " ").trim();
  newChunks.push({
    chunkId,
    canonicalId: skill.slug,
    canonicalUrl: skill.canonicalUrl,
    resourceType: "skill",
    section: "guide",
    title: skill.title,
    text,
    reviewState: "reviewed-links",
    sourceIds: [],
    releaseVersion: release.releaseVersion,
    schemaVersion: release.schemaVersion,
    contentHash: hashText(text)
  });
}
for (const skill of agentSkills) {
  const chunkId = `cb-agent-skill-${slugify(skill.name)}-workflow`;
  if (existingIds.has(chunkId)) continue;
  const text = [
    skill.description,
    ...(skill.useWhen || []).map((item) => `Use when: ${item}`),
    ...(skill.procedure || []).map((item) => `Step: ${item}`),
    ...(skill.guardrails || []).map((item) => `Boundary: ${item}`)
  ].join(" ").replace(/\s+/g, " ").trim();
  newChunks.push({
    chunkId,
    canonicalId: skill.name,
    canonicalUrl: `${SITE}/agent-skills/${skill.name}/`,
    resourceType: "agent-skill",
    section: "workflow",
    title: skill.title,
    text,
    reviewState: "reviewed-links",
    sourceIds: [],
    releaseVersion: release.releaseVersion,
    schemaVersion: release.schemaVersion,
    contentHash: hashText(text)
  });
}
if (newChunks.length) {
  rag = `${rag.trimEnd()}\n${newChunks.map((item) => JSON.stringify(item)).join("\n")}\n`;
  await writeFile(ragPath, rag);
}
const ragManifestPath = join(DATA_OUT, "rag-manifest.json");
const ragManifest = await readJson(ragManifestPath);
ragManifest.chunkCount = rag.trim().split("\n").filter(Boolean).length;
ragManifest.contentSha256 = await hashFile(ragPath);
await writeJson(ragManifestPath, ragManifest);

const dataPagePath = join(OUT, "data", "index.html");
let dataPage = await readFile(dataPagePath, "utf8");
if (!dataPage.includes('/data/skills.json')) {
  dataPage = dataPage.replace(
    "</article>",
    `<h2>Decision skills</h2><p>The skills layer connects practical capabilities with reviewed bias lenses, decision contexts and exercises. <a href="/data/skills.json">Download decision skills</a> or <a href="/skills/">browse the human-readable skill guides</a>.</p></article>`
  );
}
if (!dataPage.includes('/data/agent-skills.json')) {
  dataPage = dataPage.replace(
    "</article>",
    `<h2>Portable Agent Skills</h2><p>Installable, instruction-only workflows are published in the open Agent Skills format. <a href="/data/agent-skills.json">Download the agent-skill catalog</a> or <a href="/agent-skills/">browse the free marketplace</a>.</p></article>`
  );
}
await writeFile(dataPagePath, dataPage);

const skillsHubPath = join(OUT, "skills", "index.html");
let skillsHub = await readFile(skillsHubPath, "utf8");
if (!skillsHub.includes('/agent-skills/')) {
  skillsHub = skillsHub.replace(
    '<section class="section"><p class="kicker">Skill library</p>',
    `<section class="section section--ink"><p class="kicker">For AI agents</p><h2>Install these workflows in your agent.</h2><p class="lede">The same decision methods are now packaged as portable Agent Skills for Hermes, OpenClaw, ChatGPT Skills, Codex and other compatible tools.</p><p><a class="button" href="/agent-skills/">Open Agent Skills Marketplace</a></p></section><section class="section"><p class="kicker">Skill library</p>`
  );
  await writeFile(skillsHubPath, skillsHub);
}

for (const skill of skills) {
  const portable = publicAgentSkills.find((entry) => entry.sourceDecisionSkill === skill.slug);
  if (!portable) continue;
  const skillPagePath = join(OUT, "skills", skill.slug, "index.html");
  let skillPage = await readFile(skillPagePath, "utf8");
  if (!skillPage.includes(`/agent-skills/${portable.name}/`)) {
    skillPage = skillPage.replace(
      "</main>",
      `<section class="section section--ink"><p class="kicker">Use it with an AI agent</p><h2>Install this decision workflow as an Agent Skill.</h2><p>The portable version uses the same decision method and keeps bias labels as evidence-aware lenses rather than diagnoses.</p><p><a class="button" href="/agent-skills/${portable.name}/">Install ${escapeHtml(portable.title)}</a></p></section></main>`
    );
    await writeFile(skillPagePath, skillPage);
  }
}

console.log(`Added ${skills.length} decision skills and ${agentSkills.length} portable agent skills to public discovery.`);
