import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const AGENT_ROOT = join(OUT, "agent-skills");
const DATA_OUT = join(OUT, "data");

const biases = JSON.parse(await readFile("data/biases.json", "utf8"));
const duplicates = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const sourceAgentSkills = JSON.parse(await readFile("data/agent-skills.json", "utf8"));
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const canonicalBiases = biases
  .filter((bias) => bias.published && !duplicateIds.has(bias.id))
  .sort((a, b) => a.title.localeCompare(b.title));

if (!canonicalBiases.length) throw new Error("No published canonical biases found for Agent Skill generation.");

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const yamlString = (value = "") => JSON.stringify(String(value));
const cleanText = (value = "") => String(value).replace(/\s+/g, " ").trim();
const firstParagraph = (value = "") => cleanText(String(value).split(/\n\n/)[0] || "");
const conceptTitle = (bias) => String(bias.title || bias.slug).split(/\s+[–—]\s+/)[0].trim();
const hashText = (value) => createHash("sha256").update(String(value)).digest("hex");

function skillNameForBias(bias) {
  const base = `bias-${String(bias.slug).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-")}`;
  if (base.length <= 64) return base;
  const suffix = createHash("sha1").update(String(bias.slug)).digest("hex").slice(0, 8);
  return `${base.slice(0, 55).replace(/-+$/g, "")}-${suffix}`;
}

function skillDescription(bias) {
  const name = conceptTitle(bias);
  return `Use ${name} as a focused cognitive-bias lens. Explain the pattern, check whether it plausibly fits the situation, surface an alternative non-bias explanation, and return a practical counter-check without diagnosing people or claiming causation.`;
}

function buildSkillMarkdown(bias, skillName) {
  const title = conceptTitle(bias);
  const canonicalBiasUrl = `${SITE}/biases/${bias.slug}/`;
  const publicDataUrl = `${SITE}/data/biases.json`;
  const definition = firstParagraph(bias.description);
  return `---\nname: ${skillName}\ndescription: ${yamlString(skillDescription(bias))}\n---\n\n# ${title}\n\n${definition}\n\n## When to use\n\n- The user names ${title} or asks whether this pattern may matter in a real situation.\n- The agent needs a focused lens for reviewing a decision, claim, estimate, memory, judgment or interaction.\n- The user wants a practical check rather than a label applied to a person.\n\n## Workflow\n\n1. Restate the relevant situation or claim in neutral terms before applying the bias label.\n2. Explain ${title} in plain language using the canonical Cognitive Biases entry as the source of truth.\n3. Identify the specific observation that makes this lens plausible. If no concrete observation exists, say that the fit is weak or unknown.\n4. Give at least one ordinary alternative explanation that does not require ${title}, such as incentives, constraints, missing information, chance, measurement error or a different cognitive mechanism.\n5. Check the canonical page for qualification, evidence status and related concepts when source access is available. Preserve uncertainty instead of upgrading the claim.\n6. Suggest one or two practical counter-checks that could reduce the risk or distinguish this explanation from alternatives.\n7. End with what would make the ${title} interpretation more likely, less likely, or still unresolved.\n\n## Required output\n\n- Plain-language explanation\n- Observed signal or reason the lens was considered\n- Alternative non-bias explanation\n- Evidence / uncertainty boundary\n- Practical counter-check\n- What would change the assessment\n\n## Evidence and safety boundaries\n\n- Treat ${title} as a candidate lens, not a diagnosis, personality judgment, intent claim or proof of causation.\n- Do not infer intelligence, character, mental health or motives from the presence of a cognitive-bias pattern.\n- Do not present a generated, disputed, limited or unreviewed claim as settled science. Preserve the status shown by the canonical project material.\n- Do not force this bias to fit when another explanation is simpler or better supported.\n- For medical, legal, financial or mental-health decisions, keep the skill educational and preserve the need for appropriate professional judgment.\n\n## Canonical bias\n\n- [${title}](${canonicalBiasUrl})\n- [Public bias dataset](${publicDataUrl})\n- Category: ${bias.typeOfBias || "Cognitive bias"}\n\n## Portability\n\nThis is a free, instruction-only Agent Skill. It requires no secrets, no executable scripts and no network access to run. If source-access tools are available, use the linked Cognitive Biases material to preserve the current wording, review state and uncertainty.\n\nLicence: ${sourceAgentSkills.license || "CC BY-NC-SA 4.0"}.\n`;
}

function pageTemplate({ title, description, canonicalUrl, body, schema }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${canonicalUrl}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonicalUrl}"><link rel="stylesheet" href="/styles.css"><style>.agent-badges{display:flex;flex-wrap:wrap;gap:.55rem;margin:1rem 0}.agent-badge{display:inline-block;border:2px solid currentColor;border-radius:999px;padding:.2rem .55rem;font-size:.78rem;font-weight:900}.agent-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}.agent-card{border:3px solid currentColor;padding:1.25rem;background:#fff;color:#101622}.agent-install{background:#101622;color:#fff;padding:1.2rem;border-radius:.2rem;overflow:auto;font-size:.86rem}.agent-install code{white-space:pre-wrap}.agent-meta{font-size:.88rem;color:#596273}.bias-skill-search{width:min(680px,100%);padding:.8rem;border:3px solid currentColor;font:inherit}.bias-skill-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem;margin-top:1.5rem}@media(max-width:900px){.bias-skill-list{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.agent-grid,.bias-skill-list{grid-template-columns:1fr}}</style><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="/"><img src="/assets/biases_icon.png" width="48" height="48" alt="Cognitive Biases icon"><span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/explore/">Explore</a><a href="/contexts/">Decision guides</a><a href="/skills/">Skills</a><a href="/agent-skills/" aria-current="page">Agent skills</a><a href="/evidence/">Evidence</a><a href="/data/">Data</a></nav></header><main id="main">${body}</main><footer class="site-footer"><div><a class="brand brand--footer" href="/"><img src="/assets/biases_icon.png" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p>A public guide to cognitive biases, evidence and better decisions.</p></div><div class="footer-links"><a href="/agent-skills/">Agent Skills Marketplace</a><a href="/agent-skills/biases/">Bias Skills</a><a href="/skills/">Decision skills</a><a href="/data/">Data</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p></footer></body></html>`;
}

const compatibility = ["Agent Skills", "Hermes Agent", "OpenClaw", "ChatGPT Skills", "Codex"];
const security = sourceAgentSkills.security || { networkRequired: false, executableCode: false, secretsRequired: false };
const seenNames = new Set();
const biasSkillRecords = [];

for (const bias of canonicalBiases) {
  const skillName = skillNameForBias(bias);
  if (seenNames.has(skillName)) throw new Error(`Generated duplicate Agent Skill name: ${skillName}`);
  seenNames.add(skillName);

  const title = conceptTitle(bias);
  const canonicalUrl = `${SITE}/agent-skills/${skillName}/`;
  const skillFile = `${canonicalUrl}SKILL.md`;
  const biasUrl = `${SITE}/biases/${bias.slug}/`;
  const hermesCommand = `mkdir -p ~/.hermes/skills/${skillName} && curl -fsSL ${skillFile} -o ~/.hermes/skills/${skillName}/SKILL.md`;
  const openClawCommand = `mkdir -p ~/.openclaw/workspace/skills/${skillName} && curl -fsSL ${skillFile} -o ~/.openclaw/workspace/skills/${skillName}/SKILL.md`;
  const description = skillDescription(bias);
  const record = {
    name: skillName,
    title,
    description,
    category: "bias-lens",
    sourceDecisionSkill: null,
    sourceBias: bias.slug,
    skillFile,
    canonicalUrl,
    compatibility,
    install: {
      hermes: hermesCommand,
      openclaw: openClawCommand,
      generic: `Download ${skillFile} into <agent-skill-root>/${skillName}/SKILL.md.`
    },
    security
  };
  biasSkillRecords.push(record);

  const targetDir = join(AGENT_ROOT, skillName);
  await mkdir(targetDir, { recursive: true });
  await writeFile(join(targetDir, "SKILL.md"), buildSkillMarkdown(bias, skillName));

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CreativeWork", "@id": `${canonicalUrl}#skill`, url: canonicalUrl, name: `${title} Agent Skill`, description, isAccessibleForFree: true, inLanguage: "en", learningResourceType: "Agent Skill", about: { "@type": "DefinedTerm", name: title, url: biasUrl } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Agent Skills", item: `${SITE}/agent-skills/` },
        { "@type": "ListItem", position: 3, name: "Bias Skills", item: `${SITE}/agent-skills/biases/` },
        { "@type": "ListItem", position: 4, name: title, item: canonicalUrl }
      ] }
    ]
  };
  const body = `<section class="page-hero"><p class="eyebrow">Free cognitive-bias Agent Skill</p><h1>${escapeHtml(title)}</h1><p class="lede">${escapeHtml(description)}</p><div class="agent-badges">${compatibility.map((item) => `<span class="agent-badge">${escapeHtml(item)}</span>`).join("")}</div><p><a class="button" href="SKILL.md">Open SKILL.md</a> <a class="button button--dark" href="${biasUrl}">Read canonical bias</a></p></section><section class="section"><p class="kicker">What the agent should do</p><h2>Use one bias carefully, not as a diagnosis.</h2><div class="agent-grid"><article class="agent-card"><h3>Canonical definition</h3><p>${escapeHtml(firstParagraph(bias.description))}</p><p><a href="${biasUrl}">Evidence, related concepts and current review state →</a></p></article><article class="agent-card"><h3>Output</h3><ul><li>Plain-language explanation</li><li>Observed signal</li><li>Alternative explanation</li><li>Evidence boundary</li><li>Practical counter-check</li><li>What would change the assessment</li></ul></article></div></section><section class="section section--ink"><p class="kicker">Install</p><h2>Free. One SKILL.md. No API key.</h2><p>Hermes Agent</p><pre class="agent-install"><code>${escapeHtml(hermesCommand)}</code></pre><p>OpenClaw</p><pre class="agent-install"><code>${escapeHtml(openClawCommand)}</code></pre><p>Other Agent Skills-compatible tools</p><p>Download <a href="SKILL.md">SKILL.md</a> and put it in the skill directory or import surface supported by your agent.</p></section><section class="section"><p class="kicker">Boundary</p><h2>A lens, not a verdict.</h2><p class="lede">The skill must preserve uncertainty, surface a non-bias explanation and avoid turning a cognitive-bias label into a claim about a person's motives, intelligence or mental health.</p><p class="agent-meta">Free to install · instruction-only · no secrets · no executable code · no required network access</p></section>`;
  await writeFile(join(targetDir, "index.html"), pageTemplate({ title: `${title} Agent Skill | Cognitive Biases`, description, canonicalUrl, body, schema }));

  const biasPagePath = join(OUT, "biases", bias.slug, "index.html");
  let biasPage = await readFile(biasPagePath, "utf8");
  if (!biasPage.includes(`/agent-skills/${skillName}/`)) {
    const insertion = `<section class="section section--ink"><p class="kicker">Use with an AI agent</p><h2>Install ${escapeHtml(title)} as a free Agent Skill.</h2><p>Use this bias as a focused lens in Hermes, OpenClaw, ChatGPT Skills, Codex or another Agent Skills-compatible tool.</p><p><a class="button" href="/agent-skills/${skillName}/">Install Agent Skill</a></p></section>`;
    if (!biasPage.includes("</main>")) throw new Error(`${bias.slug}: canonical bias page is missing </main>.`);
    biasPage = biasPage.replace("</main>", `${insertion}</main>`);
    await writeFile(biasPagePath, biasPage);
  }
}

const catalogPath = join(AGENT_ROOT, "catalog.json");
const dataCatalogPath = join(DATA_OUT, "agent-skills.json");
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const workflowSkills = (catalog.skills || []).filter((skill) => !skill.sourceBias);
const existingNames = new Set(workflowSkills.map((skill) => skill.name));
for (const record of biasSkillRecords) {
  if (existingNames.has(record.name)) throw new Error(`Bias Agent Skill conflicts with existing skill: ${record.name}`);
}
catalog.skills = [...workflowSkills, ...biasSkillRecords];
catalog.workflowSkillCount = workflowSkills.length;
catalog.biasSkillCount = biasSkillRecords.length;
catalog.totalSkillCount = catalog.skills.length;
catalog.allSkillsFreeToInstall = true;
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
await writeFile(dataCatalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

const schemaPath = join(OUT, "schemas", "agent-skill.schema.json");
const schema = JSON.parse(await readFile(schemaPath, "utf8"));
schema.properties ||= {};
schema.properties.sourceBias = { type: ["string", "null"], description: "Canonical cognitive-bias slug for generated bias-lens skills." };
await writeFile(schemaPath, `${JSON.stringify(schema, null, 2)}\n`);

const metricsPath = join(DATA_OUT, "metrics.json");
const metrics = JSON.parse(await readFile(metricsPath, "utf8"));
metrics.agentSkills = catalog.skills.length;
metrics.biasAgentSkills = biasSkillRecords.length;
metrics.workflowAgentSkills = workflowSkills.length;
await writeFile(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`);

const biasIndexCanonical = `${SITE}/agent-skills/biases/`;
const biasCards = canonicalBiases.map((bias) => {
  const skillName = skillNameForBias(bias);
  const title = conceptTitle(bias);
  return `<article class="agent-card" data-bias-skill data-search="${escapeHtml(`${title} ${bias.typeOfBias || ""} ${bias.slug}`.toLowerCase())}"><p class="kicker">${escapeHtml(bias.typeOfBias || "Cognitive bias")}</p><h2><a href="/agent-skills/${skillName}/">${escapeHtml(title)}</a></h2><p>${escapeHtml(firstParagraph(bias.description).slice(0, 220))}</p><p><a href="/agent-skills/${skillName}/">Install free skill →</a></p></article>`;
}).join("");
const biasIndexSchema = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "CollectionPage", url: biasIndexCanonical, name: "Free Cognitive Bias Agent Skills", description: `Free Agent Skills for ${biasSkillRecords.length} published canonical cognitive biases.` },
    { "@type": "ItemList", numberOfItems: biasSkillRecords.length, itemListElement: biasSkillRecords.map((skill, index) => ({ "@type": "ListItem", position: index + 1, name: skill.title, url: skill.canonicalUrl })) }
  ]
};
const biasIndexBody = `<section class="page-hero"><p class="eyebrow">Free Bias Skills</p><h1>Every cognitive bias. One installable skill each.</h1><p class="lede">${biasSkillRecords.length} published canonical biases are available as free, portable Agent Skills. New canonical biases are generated into this collection automatically.</p><p><a class="button" href="/agent-skills/">Workflow skills</a> <a class="button button--dark" href="catalog.json">Bias-skill catalog</a></p></section><section class="section"><p class="kicker">Find a skill</p><h2>Search by bias or category.</h2><input class="bias-skill-search" id="bias-skill-search" type="search" placeholder="Search cognitive biases" aria-label="Search cognitive bias Agent Skills"><div class="bias-skill-list" id="bias-skill-list">${biasCards}</div></section><script>const q=document.getElementById('bias-skill-search');q?.addEventListener('input',()=>{const v=q.value.toLowerCase().trim();document.querySelectorAll('[data-bias-skill]').forEach((el)=>{el.hidden=v&&!el.dataset.search.includes(v);});});</script>`;
await mkdir(join(AGENT_ROOT, "biases"), { recursive: true });
await writeFile(join(AGENT_ROOT, "biases", "index.html"), pageTemplate({ title: "Free Cognitive Bias Agent Skills | Cognitive Biases", description: `Install ${biasSkillRecords.length} free cognitive-bias Agent Skills for Agent Skills-compatible tools.`, canonicalUrl: biasIndexCanonical, body: biasIndexBody, schema: biasIndexSchema }));
await writeFile(join(AGENT_ROOT, "biases", "catalog.json"), `${JSON.stringify({ schemaVersion: catalog.schemaVersion, updatedAt: catalog.updatedAt, marketplace: biasIndexCanonical, allSkillsFreeToInstall: true, skills: biasSkillRecords }, null, 2)}\n`);

const hubPath = join(AGENT_ROOT, "index.html");
let hub = await readFile(hubPath, "utf8");
const hubMarker = '<section class="section"><p class="kicker">Portable by design</p>';
if (!hub.includes('/agent-skills/biases/')) {
  if (!hub.includes(hubMarker)) throw new Error("Agent Skills hub marker changed; cannot inject Bias Skills collection safely.");
  const biasSection = `<section class="section"><p class="kicker">Every bias is installable</p><h2>${biasSkillRecords.length} free cognitive-bias skills.</h2><p class="lede">Every published canonical cognitive bias has its own portable <code>SKILL.md</code>. The workflow collection remains available for broader jobs such as forecasting, evidence evaluation and decision review.</p><p><a class="button" href="/agent-skills/biases/">Browse all Bias Skills</a> <a class="button button--dark" href="/agent-skills/biases/catalog.json">Machine-readable catalog</a></p></section>`;
  hub = hub.replace(hubMarker, `${biasSection}${hubMarker}`);
  hub = hub.replace(/<h2>\d+ skills in the first collection\.<\/h2>/, `<h2>${workflowSkills.length} workflow skills + ${biasSkillRecords.length} bias skills.</h2>`);
  hub = hub.replace("Free to install. Current content licence:", "All skills are free to install. Current content licence:");
  await writeFile(hubPath, hub);
}

const agentLlmsPath = join(AGENT_ROOT, "llms.txt");
let agentLlms = await readFile(agentLlmsPath, "utf8");
const llmsAddition = `\n## Bias Skills\n\n- Bias Skills collection: ${biasIndexCanonical}\n- Bias Skills catalog: ${biasIndexCanonical}catalog.json\n- Every published canonical cognitive bias is also available as an individual free Agent Skill.\n- New canonical biases are generated into the Bias Skills collection automatically.\n`;
if (!agentLlms.includes("Bias Skills collection:")) {
  agentLlms = `${agentLlms.trimEnd()}${llmsAddition}\n`;
  await writeFile(agentLlmsPath, agentLlms);
}

const ragPath = join(DATA_OUT, "rag.ndjson");
let rag = await readFile(ragPath, "utf8");
const ragLines = rag.trim().split("\n").filter(Boolean);
const ragIds = new Set(ragLines.map((line) => JSON.parse(line).chunkId));
const release = JSON.parse(await readFile("data/release.json", "utf8"));
const addedRag = [];
for (const bias of canonicalBiases) {
  const skillName = skillNameForBias(bias);
  const chunkId = `cb-agent-skill-${skillName}-workflow`;
  if (ragIds.has(chunkId)) continue;
  const text = cleanText(`${skillDescription(bias)} Canonical bias: ${conceptTitle(bias)}. ${firstParagraph(bias.description)} Workflow: explain the pattern; identify the observed signal; provide an alternative non-bias explanation; preserve evidence uncertainty; suggest a practical counter-check; state what would change the assessment.`);
  addedRag.push(JSON.stringify({
    chunkId,
    canonicalId: skillName,
    canonicalUrl: `${SITE}/agent-skills/${skillName}/`,
    resourceType: "agent-skill",
    section: "bias-lens",
    title: conceptTitle(bias),
    text,
    reviewState: "canonical-bias-derived",
    sourceIds: [String(bias.id)],
    releaseVersion: release.releaseVersion,
    schemaVersion: release.schemaVersion,
    contentHash: hashText(text)
  }));
}
if (addedRag.length) {
  rag = `${rag.trimEnd()}\n${addedRag.join("\n")}\n`;
  await writeFile(ragPath, rag);
  const ragManifestPath = join(DATA_OUT, "rag-manifest.json");
  const ragManifest = JSON.parse(await readFile(ragManifestPath, "utf8"));
  ragManifest.chunkCount = rag.trim().split("\n").filter(Boolean).length;
  ragManifest.contentSha256 = hashText(rag);
  await writeFile(ragManifestPath, `${JSON.stringify(ragManifest, null, 2)}\n`);
}

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
const today = new Date().toISOString().slice(0, 10);
const sitemapUrls = [biasIndexCanonical, ...biasSkillRecords.map((skill) => skill.canonicalUrl)];
const newEntries = sitemapUrls.filter((url) => !sitemap.includes(`<loc>${url}</loc>`)).map((url) => `<url><loc>${url}</loc><lastmod>${today}</lastmod></url>`).join("");
if (newEntries) {
  if (!sitemap.includes("</urlset>")) throw new Error("sitemap.xml is missing </urlset>.");
  sitemap = sitemap.replace("</urlset>", `${newEntries}</urlset>`);
  await writeFile(sitemapPath, sitemap);
}

console.log(`Generated ${biasSkillRecords.length} free per-bias Agent Skills plus ${workflowSkills.length} workflow Agent Skills (${catalog.skills.length} total).`);
