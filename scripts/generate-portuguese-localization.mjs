import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadPortugueseTranslations } from "./lib/portuguese-translations.mjs";

const OUT = "dist";
const SITE = "https://cognitive-biases.github.io";
const TODAY = "2026-09-13";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const release = await readJson("data/release.json");
const canonicalBiases = await readJson("data/biases.json");
const techniqueDocument = await readJson("data/techniques.json");
const canonicalSkills = await readJson("data/skills.json");
const canonicalAgentSkills = await readJson("data/agent-skills.json");
const ui = await readJson("data/ui-pt-br.json");
const pages = await readJson("data/pages-pt-br.json");
const techniques = await readJson("data/techniques-pt-br.json");
const skills = await readJson("data/skills-pt-br.json");
const agentSkills = await readJson("data/agent-skills-pt-br.json");
const translations = await loadPortugueseTranslations({ canonicalBiases, releaseVersion: release.releaseVersion, today: TODAY });
const evidenceReviews = await loadEvidenceReviews();

const publishedBiases = canonicalBiases.filter((entry) => entry.published);
const canonicalBiasBySlug = new Map(publishedBiases.map((entry) => [entry.slug, entry]));
const canonicalTechniqueBySlug = new Map((techniqueDocument.techniques || []).map((entry) => [entry.slug, entry]));
const canonicalSkillBySlug = new Map((canonicalSkills.entries || []).map((entry) => [entry.slug, entry]));
const canonicalAgentByName = new Map((canonicalAgentSkills.skills || []).map((entry) => [entry.name, entry]));
const localizedTechniqueByCanonical = new Map(techniques.entries.map((entry) => [entry.canonicalSlug, entry]));

validateParity();
await rm(join(OUT, "pt-br"), { recursive: true, force: true });
await mkdir(join(OUT, "pt-br"), { recursive: true });
await writeFile(join(OUT, "pt-br.css"), stylesheet());

const generatedPaths = [];
await generateHome();
await generateExplorer();
await generateTechniques();
await generateSkills();
await generateAgentSkills();
await generateBiasPages();
await generateMachineData();
await updateSitemap(generatedPaths);
await patchEnglishDiscovery();

console.log(`Generated Brazilian Portuguese localization: ${translations.entries.length}/${publishedBiases.length} reviewed bias pages, ${techniques.entries.length} techniques, ${skills.entries.length} Decision Skills, ${agentSkills.entries.length} workflow Agent Skills.`);

function validateParity() {
  for (const entry of techniques.entries) {
    if (!canonicalTechniqueBySlug.has(entry.canonicalSlug)) throw new Error(`Unknown canonical technique in pt-BR: ${entry.canonicalSlug}`);
  }
  if (techniques.entries.length !== canonicalTechniqueBySlug.size) throw new Error(`pt-BR techniques coverage is ${techniques.entries.length}/${canonicalTechniqueBySlug.size}; full technique parity is required.`);
  for (const entry of skills.entries) {
    if (!canonicalSkillBySlug.has(entry.canonicalSlug)) throw new Error(`Unknown canonical Decision Skill in pt-BR: ${entry.canonicalSlug}`);
  }
  if (skills.entries.length !== canonicalSkillBySlug.size) throw new Error(`pt-BR Decision Skills coverage is ${skills.entries.length}/${canonicalSkillBySlug.size}; full skill parity is required.`);
  for (const entry of agentSkills.entries) {
    if (!canonicalAgentByName.has(entry.canonicalSlug)) throw new Error(`Unknown canonical Agent Skill in pt-BR: ${entry.canonicalSlug}`);
  }
  if (agentSkills.entries.length !== canonicalAgentByName.size) throw new Error(`pt-BR Agent Skills coverage is ${agentSkills.entries.length}/${canonicalAgentByName.size}; full workflow skill parity is required.`);
  for (const entry of translations.entries) {
    for (const techniqueSlug of entry.techniqueSlugs) {
      if (!localizedTechniqueByCanonical.has(techniqueSlug)) throw new Error(`${entry.canonicalId}: unknown linked technique ${techniqueSlug}`);
    }
  }
}

async function loadEvidenceReviews() {
  const names = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name)).sort();
  const map = new Map();
  for (const name of names) {
    const document = await readJson(join("data", name));
    for (const review of document.reviews || []) {
      if (map.has(review.slug)) throw new Error(`Evidence review defined more than once: ${review.slug}`);
      map.set(review.slug, review);
    }
  }
  return map;
}

const esc = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const jsonLd = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
const url = (path) => `${SITE}${path}`;
const biasPath = (entry) => `/pt-br/vieses/${entry.localizedSlug}/`;
const englishBiasPath = (entry) => `/biases/${entry.canonicalId}/`;
const techniquePath = (entry) => `/pt-br/tecnicas/${entry.localizedSlug}/`;
const skillPath = (entry) => `/pt-br/habilidades/${entry.localizedSlug}/`;
const agentSkillPath = (entry) => `/pt-br/agent-skills/${entry.canonicalSlug}/`;
const cleanMeta = (value = "") => {
  const text = String(value).replace(/\s+/g, " ").trim();
  if (text.length <= 155) return text;
  return `${text.slice(0, 151).replace(/\s+\S*$/, "").replace(/[,:;–—-]+$/, "")}…`;
};

function nav(englishEquivalent = "/") {
  return `<header class="pt-header"><div class="pt-shell pt-nav"><a class="pt-brand" href="/pt-br/">Cognitive Biases</a><nav aria-label="Navegação principal"><a href="/pt-br/explorar/">${esc(ui.navigation.explore)}</a><a href="/pt-br/tecnicas/">${esc(ui.navigation.techniques)}</a><a href="/pt-br/habilidades/">${esc(ui.navigation.skills)}</a><a href="/pt-br/agent-skills/">${esc(ui.navigation.agentSkills)}</a><a hreflang="en" lang="en" href="${esc(englishEquivalent)}">English</a></nav></div></header>`;
}

function footer() {
  return `<footer class="pt-footer"><div class="pt-shell"><p>${esc(ui.notices.educational)}</p><p>${esc(ui.notices.evidenceBoundary)}</p><p><a href="/about/editorial/">Processo editorial</a> · <a href="/methodology/">Metodologia canônica</a> · <a href="/pt-br/data/index.json">Dados pt-BR</a> · <a href="/pt-br/llms.txt">LLM routing</a></p></div></footer>`;
}

function renderPage({ route, englishRoute, title, description, body, schemas = [] }) {
  const canonical = url(route);
  const english = url(englishRoute);
  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${canonical}#webpage`,
    name: title,
    description,
    url: canonical,
    inLanguage: "pt-BR",
    isPartOf: { "@type": "WebSite", "@id": `${SITE}/#website`, name: "Cognitive Biases", url: `${SITE}/` }
  };
  const schemaScripts = [webPage, ...schemas].map((schema) => `<script type="application/ld+json">${jsonLd(schema)}</script>`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><meta name="robots" content="max-image-preview:large,max-snippet:-1,max-video-preview:-1"><title>${esc(title)}</title><meta name="description" content="${esc(cleanMeta(description))}"><link rel="canonical" href="${canonical}"><link rel="alternate" hreflang="pt-BR" href="${canonical}"><link rel="alternate" hreflang="en" href="${english}"><link rel="alternate" hreflang="x-default" href="${english}"><link rel="icon" href="/favicon.png"><meta property="og:locale" content="pt_BR"><meta property="og:locale:alternate" content="en_US"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(cleanMeta(description))}"><meta property="og:url" content="${canonical}"><meta property="og:type" content="website"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/pt-br.css">${schemaScripts}</head><body><a class="skip" href="#main">${esc(ui.skipToContent)}</a>${nav(englishRoute)}<main id="main">${body}</main>${footer()}</body></html>`;
}

async function emit(route, html) {
  const target = join(OUT, route.replace(/^\//, ""), "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
  generatedPaths.push(route);
}

async function generateHome() {
  const biasCards = translations.entries.slice(0, 8).map((entry) => `<article class="pt-card"><p class="pt-kicker">${esc(entry.englishLabel)}</p><h3><a href="${biasPath(entry)}">${esc(entry.localizedLabel)}</a></h3><p>${esc(entry.summary)}</p><p class="pt-question">${esc(entry.practicalQuestion)}</p></article>`).join("");
  const journeys = pages.home.journeys.map((entry) => `<article class="pt-card"><h3>${esc(entry.title)}</h3><p>${esc(entry.text)}</p></article>`).join("");
  const body = `<section class="pt-hero"><div class="pt-shell"><p class="pt-kicker">${esc(pages.home.eyebrow)}</p><h1>${esc(pages.home.title)}</h1><p class="pt-lede">${esc(pages.home.lede)}</p><div class="pt-actions"><a class="pt-button" href="/pt-br/explorar/">${esc(ui.actions.browseAll)}</a><a class="pt-button pt-button--quiet" href="/pt-br/tecnicas/">${esc(ui.actions.browseTechniques)}</a></div><div class="pt-note"><strong>pt-BR revisado, sem fallback silencioso.</strong><p>${esc(ui.notices.partialCatalog)}</p></div></div></section><section class="pt-section"><div class="pt-shell"><p class="pt-kicker">Comece pelo seu objetivo</p><h2>De conceito para decisão.</h2><div class="pt-grid">${journeys}</div></div></section><section class="pt-section pt-section--ink"><div class="pt-shell"><p class="pt-kicker">Vieses em foco</p><h2>Termos que aparecem em decisões reais.</h2><div class="pt-grid">${biasCards}</div></div></section>`;
  await emit("/pt-br/", renderPage({ route: "/pt-br/", englishRoute: "/", title: `${pages.home.title} | Cognitive Biases`, description: pages.home.description, body }));
}

async function generateExplorer() {
  const cards = translations.entries.map((entry) => `<article class="pt-card pt-search-card" data-search="${esc([entry.localizedLabel, entry.englishLabel, ...(entry.aliases || []), ...(entry.searchTerms || [])].join(" ").toLowerCase())}"><p class="pt-kicker"><span lang="en">${esc(entry.englishLabel)}</span></p><h2><a href="${biasPath(entry)}">${esc(entry.localizedLabel)}</a></h2><p>${esc(entry.summary)}</p><p class="pt-question">${esc(entry.practicalQuestion)}</p></article>`).join("");
  const body = `<section class="pt-hero pt-hero--compact"><div class="pt-shell"><p class="pt-kicker">Vieses cognitivos</p><h1>${esc(pages.explorer.title)}</h1><p class="pt-lede">${esc(pages.explorer.intro)}</p><label class="pt-search">${esc(ui.search.label)}<input id="pt-search" type="search" placeholder="${esc(ui.search.placeholder)}" autocomplete="off"></label><p class="pt-muted">${translations.entries.length} fichas revisadas em pt-BR · ${publishedBiases.length} conceitos publicados no catálogo canônico.</p></div></section><section class="pt-section"><div class="pt-shell"><div id="pt-results" class="pt-grid">${cards}</div><p id="pt-empty" class="pt-note" hidden>${esc(ui.search.noResults)}</p></div></section><script>(()=>{const i=document.getElementById('pt-search'),c=[...document.querySelectorAll('.pt-search-card')],e=document.getElementById('pt-empty');const n=s=>s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();i.addEventListener('input',()=>{const q=n(i.value.trim());let shown=0;c.forEach(x=>{const ok=!q||n(x.dataset.search).includes(q);x.hidden=!ok;if(ok)shown++});e.hidden=shown!==0})})()</script>`;
  await emit("/pt-br/explorar/", renderPage({ route: "/pt-br/explorar/", englishRoute: "/explore/", title: `${pages.explorer.title} | Cognitive Biases`, description: pages.explorer.description, body }));
}

async function generateBiasPages() {
  for (const entry of translations.entries) {
    const canonical = canonicalBiasBySlug.get(entry.canonicalId);
    const review = evidenceReviews.get(entry.canonicalId);
    const linkedTechniques = entry.techniqueSlugs.map((slug) => localizedTechniqueByCanonical.get(slug)).filter(Boolean);
    const evidence = review ? `<section class="pt-section"><div class="pt-shell pt-prose"><p class="pt-kicker">${esc(ui.labels.evidence)}</p><h2>O que a revisão canônica permite afirmar.</h2><p><strong>Status canônico:</strong> <span lang="en">${esc(review.evidenceStatus)}</span></p><p>${esc(entry.evidenceSummary || review.summary || "Há uma revisão de evidências ligada a este conceito.")}</p><ol>${(review.sources || []).map((source) => `<li><a href="${esc(source.url)}" rel="external noreferrer">${esc(source.title)}</a>${source.year ? ` · ${esc(source.year)}` : ""}</li>`).join("")}</ol><p class="pt-muted">Revisão canônica: ${esc(review.reviewedAt || "data não informada")}. Títulos e status permanecem na forma canônica.</p></div></section>` : `<section class="pt-section"><div class="pt-shell pt-prose"><p class="pt-kicker">${esc(ui.labels.evidence)}</p><h2>Revisão dedicada ainda não disponível.</h2><div class="pt-note"><strong>Tradução revisada ≠ evidência científica revisada.</strong><p>Esta página localiza o conceito canônico atual, mas nenhuma revisão de evidências dedicada está ligada a ele no conjunto canônico. Não use o rótulo como diagnóstico nem como causa certa de um caso individual.</p></div></div></section>`;
    const techniqueCards = linkedTechniques.map((technique) => `<article class="pt-card"><h3><a href="${techniquePath(technique)}">${esc(technique.title)}</a></h3><p>${esc(technique.summary)}</p></article>`).join("");
    const schema = { "@context": "https://schema.org", "@type": "DefinedTerm", "@id": `${url(biasPath(entry))}#term`, name: entry.localizedLabel, alternateName: [entry.englishLabel, ...(entry.aliases || [])], description: entry.summary, inDefinedTermSet: `${SITE}/`, sameAs: url(englishBiasPath(entry)), identifier: entry.canonicalId, inLanguage: "pt-BR" };
    const body = `<article><section class="pt-hero pt-hero--compact"><div class="pt-shell"><p class="pt-kicker"><span lang="en">${esc(entry.englishLabel)}</span></p><h1>${esc(entry.localizedLabel)}</h1><p class="pt-lede">${esc(entry.summary)}</p><p class="pt-question">${esc(entry.practicalQuestion)}</p><div class="pt-meta"><span>${esc(ui.labels.canonicalId)}: <code>${esc(entry.canonicalId)}</code></span><span>${esc(ui.labels.reviewStatus)}: ${esc(ui.labels.reviewed)}</span><span>${esc(ui.labels.sourceRelease)}: ${esc(entry.sourceRelease)}</span></div></div></section><section class="pt-section"><div class="pt-shell pt-prose"><p class="pt-kicker">Na prática</p><h2>Como isso pode aparecer.</h2><ul>${entry.examples.map((example) => `<li>${esc(example)}</li>`).join("")}</ul><h2>${esc(ui.labels.limits)}</h2><p>${esc(entry.boundary)}</p></div></section>${evidence}${techniqueCards ? `<section class="pt-section pt-section--ink"><div class="pt-shell"><p class="pt-kicker">${esc(ui.labels.techniques)}</p><h2>Mude algo no processo, não apenas no rótulo.</h2><div class="pt-grid">${techniqueCards}</div></div></section>` : ""}<section class="pt-section"><div class="pt-shell"><p><a href="${englishBiasPath(entry)}" hreflang="en" lang="en">${esc(ui.actions.openEnglish)} →</a></p><p class="pt-muted">Entrada canônica #${esc(canonical?.number ?? "—")} · localização revisada em ${esc(entry.reviewedAt)}.</p></div></section></article>`;
    await emit(biasPath(entry), renderPage({ route: biasPath(entry), englishRoute: englishBiasPath(entry), title: `${entry.localizedLabel}: exemplos, evidências e como reduzir o efeito | Cognitive Biases`, description: `${entry.summary} Veja exemplos, limites, evidências e uma checagem prática para decisões melhores.`, body, schemas: [schema] }));
  }
}

async function generateTechniques() {
  const cards = techniques.entries.map((entry) => `<article class="pt-card"><p class="pt-kicker"><span lang="en">${esc(entry.canonicalSlug)}</span></p><h2><a href="${techniquePath(entry)}">${esc(entry.title)}</a></h2><p>${esc(entry.summary)}</p></article>`).join("");
  const body = `<section class="pt-hero pt-hero--compact"><div class="pt-shell"><p class="pt-kicker">Checagens de decisão</p><h1>${esc(pages.techniques.title)}</h1><p class="pt-lede">${esc(pages.techniques.intro)}</p><div class="pt-note"><p>${esc(ui.notices.techniqueBoundary)}</p></div></div></section><section class="pt-section"><div class="pt-shell"><div class="pt-grid">${cards}</div></div></section>`;
  await emit("/pt-br/tecnicas/", renderPage({ route: "/pt-br/tecnicas/", englishRoute: "/techniques/", title: `${pages.techniques.title} | Cognitive Biases`, description: pages.techniques.description, body }));
  for (const entry of techniques.entries) {
    const schema = { "@context": "https://schema.org", "@type": "HowTo", name: entry.title, description: entry.summary, inLanguage: "pt-BR", step: entry.steps.map((text, index) => ({ "@type": "HowToStep", position: index + 1, text })), sameAs: url(`/techniques/${entry.canonicalSlug}/`) };
    const bodyPage = `<article><section class="pt-hero pt-hero--compact"><div class="pt-shell"><p class="pt-kicker">Técnica de decisão</p><h1>${esc(entry.title)}</h1><p class="pt-lede">${esc(entry.summary)}</p></div></section><section class="pt-section"><div class="pt-shell pt-prose"><h2>Como aplicar</h2><ol>${entry.steps.map((step) => `<li>${esc(step)}</li>`).join("")}</ol><h2>Exemplo</h2><p>${esc(entry.example)}</p><h2>${esc(ui.labels.limits)}</h2><p>${esc(entry.boundary)}</p><p><a href="/techniques/${entry.canonicalSlug}/" hreflang="en" lang="en">Ver técnica canônica em inglês →</a></p></div></section></article>`;
    await emit(techniquePath(entry), renderPage({ route: techniquePath(entry), englishRoute: `/techniques/${entry.canonicalSlug}/`, title: `${entry.title}: como aplicar | Cognitive Biases`, description: `${entry.summary} Passos, exemplo e limites para usar a técnica em decisões reais.`, body: bodyPage, schemas: [schema] }));
  }
}

async function generateSkills() {
  const cards = skills.entries.map((entry) => `<article class="pt-card"><h2><a href="${skillPath(entry)}">${esc(entry.title)}</a></h2><p>${esc(entry.summary)}</p><p class="pt-question">${esc(entry.outcome)}</p></article>`).join("");
  const body = `<section class="pt-hero pt-hero--compact"><div class="pt-shell"><p class="pt-kicker">Prática deliberada</p><h1>${esc(pages.skills.title)}</h1><p class="pt-lede">${esc(pages.skills.intro)}</p></div></section><section class="pt-section"><div class="pt-shell"><div class="pt-grid">${cards}</div></div></section>`;
  await emit("/pt-br/habilidades/", renderPage({ route: "/pt-br/habilidades/", englishRoute: "/skills/", title: `${pages.skills.title} | Cognitive Biases`, description: pages.skills.description, body }));
  for (const entry of skills.entries) {
    const schema = { "@context": "https://schema.org", "@type": "LearningResource", name: entry.title, description: entry.summary, educationalUse: "practice", learningResourceType: "Decision Skill", inLanguage: "pt-BR", sameAs: url(`/skills/${entry.canonicalSlug}/`), identifier: entry.canonicalSlug };
    const bodyPage = `<article><section class="pt-hero pt-hero--compact"><div class="pt-shell"><p class="pt-kicker">Habilidade de decisão</p><h1>${esc(entry.title)}</h1><p class="pt-lede">${esc(entry.summary)}</p><p class="pt-question">${esc(entry.outcome)}</p></div></section><section class="pt-section"><div class="pt-shell pt-prose"><h2>${esc(ui.labels.whenToUse)}</h2><ul>${entry.whenToUse.map((item) => `<li>${esc(item)}</li>`).join("")}</ul><h2>${esc(ui.labels.actions)}</h2><ol>${entry.actions.map((item) => `<li>${esc(item)}</li>`).join("")}</ol><h2>Exemplo</h2><p>${esc(entry.example)}</p><h2>${esc(ui.labels.limits)}</h2><p>${esc(entry.boundary)}</p><p><a href="/skills/${entry.canonicalSlug}/" hreflang="en" lang="en">Ver skill canônica em inglês →</a></p></div></section></article>`;
    await emit(skillPath(entry), renderPage({ route: skillPath(entry), englishRoute: `/skills/${entry.canonicalSlug}/`, title: `${entry.title} | Cognitive Biases`, description: `${entry.summary} Quando usar, como praticar, exemplo e limites.`, body: bodyPage, schemas: [schema] }));
  }
}

async function generateAgentSkills() {
  const cards = agentSkills.entries.map((entry) => `<article class="pt-card"><p class="pt-kicker"><code>${esc(entry.canonicalSlug)}</code></p><h2><a href="${agentSkillPath(entry)}">${esc(entry.name)}</a></h2><p>${esc(entry.summary)}</p></article>`).join("");
  const body = `<section class="pt-hero pt-hero--compact"><div class="pt-shell"><p class="pt-kicker">Agent Skills · pt-BR</p><h1>${esc(pages.agentSkills.title)}</h1><p class="pt-lede">${esc(pages.agentSkills.intro)}</p><div class="pt-actions"><a class="pt-button" href="/pt-br/data/agent-skills.json">JSON</a><a class="pt-button pt-button--quiet" href="/pt-br/llms.txt">llms.txt</a></div></div></section><section class="pt-section"><div class="pt-shell"><div class="pt-grid">${cards}</div></div></section>`;
  await emit("/pt-br/agent-skills/", renderPage({ route: "/pt-br/agent-skills/", englishRoute: "/agent-skills/", title: `${pages.agentSkills.title} | Cognitive Biases`, description: pages.agentSkills.description, body }));
  for (const entry of agentSkills.entries) {
    const canonical = canonicalAgentByName.get(entry.canonicalSlug);
    const bodyPage = `<article><section class="pt-hero pt-hero--compact"><div class="pt-shell"><p class="pt-kicker">Agent Skill · <code>${esc(entry.canonicalSlug)}</code></p><h1>${esc(entry.name)}</h1><p class="pt-lede">${esc(entry.summary)}</p></div></section><section class="pt-section"><div class="pt-shell pt-prose"><h2>Use quando</h2><ul>${entry.useWhen.map((item) => `<li>${esc(item)}</li>`).join("")}</ul><h2>Procedimento</h2><ol>${entry.procedure.map((item) => `<li>${esc(item)}</li>`).join("")}</ol><h2>Formato da resposta</h2><ul>${entry.output.map((item) => `<li>${esc(item)}</li>`).join("")}</ul><h2>Guardrails</h2><ul>${entry.guardrails.map((item) => `<li>${esc(item)}</li>`).join("")}</ul><p><a href="/pt-br/agent-skills/${entry.canonicalSlug}/SKILL.md">Abrir SKILL.md em pt-BR →</a></p><p><a href="/agent-skills/${entry.canonicalSlug}/" hreflang="en" lang="en">Abrir Agent Skill canônica →</a></p><p class="pt-muted">ID canônico: <code>${esc(entry.canonicalSlug)}</code>${canonical?.category ? ` · categoria canônica: <span lang="en">${esc(canonical.category)}</span>` : ""}</p></div></section></article>`;
    await emit(agentSkillPath(entry), renderPage({ route: agentSkillPath(entry), englishRoute: `/agent-skills/${entry.canonicalSlug}/`, title: `${entry.name} — Agent Skill em pt-BR | Cognitive Biases`, description: entry.summary, body: bodyPage }));
    const dir = join(OUT, "pt-br", "agent-skills", entry.canonicalSlug);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "SKILL.md"), workflowSkillMarkdown(entry, canonical));
  }
  for (const bias of translations.entries) {
    const skillName = `bias-${bias.canonicalId}`;
    const dir = join(OUT, "pt-br", "agent-skills", skillName);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "SKILL.md"), biasSkillMarkdown(bias));
  }
}

function workflowSkillMarkdown(entry, canonical) {
  return `---\nname: ${entry.canonicalSlug}\ndescription: ${entry.summary.replace(/\n/g, " ")}\nmetadata:\n  locale: pt-BR\n  canonical_skill: ${entry.canonicalSlug}\n  source_release: ${release.releaseVersion}\n  canonical_category: ${canonical?.category || "unknown"}\n---\n\n# ${entry.name}\n\n${entry.summary}\n\n## Use quando\n${entry.useWhen.map((item) => `- ${item}`).join("\n")}\n\n## Procedimento\n${entry.procedure.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\n## Formato da resposta\n${entry.output.map((item) => `- ${item}`).join("\n")}\n\n## Guardrails\n${entry.guardrails.map((item) => `- ${item}`).join("\n")}\n\n## Proveniência\n\nEsta é a localização pt-BR da skill canônica \`${entry.canonicalSlug}\`. IDs, limites de evidência e fontes permanecem definidos pela biblioteca canônica em inglês.\n`;
}

function biasSkillMarkdown(entry) {
  const checks = entry.techniqueSlugs.map((slug) => localizedTechniqueByCanonical.get(slug)?.title).filter(Boolean);
  return `---\nname: bias-${entry.canonicalId}\ndescription: Analise ${entry.localizedLabel} em português do Brasil mantendo evidência, alternativas e incerteza explícitas.\nmetadata:\n  locale: pt-BR\n  canonical_bias: ${entry.canonicalId}\n  source_release: ${release.releaseVersion}\n---\n\n# ${entry.localizedLabel}\n\n${entry.summary}\n\n## Use esta lente\n\n- Quando o padrão descrito por **${entry.localizedLabel}** for uma hipótese relevante para uma decisão, argumento ou revisão.\n- Não use o rótulo como diagnóstico, intenção ou prova de causa.\n\n## Procedimento\n\n1. Reformule a situação de modo neutro e identifique fatos observáveis.\n2. Explique por que **${entry.localizedLabel}** poderia ser uma hipótese relevante.\n3. Inclua pelo menos uma explicação alternativa plausível.\n4. Pergunte: **${entry.practicalQuestion}**\n5. Procure evidência que possa diferenciar as hipóteses, não apenas confirmar uma delas.\n6. Preserve incerteza e o status de evidência canônico.\n\n## Checagens práticas\n${checks.length ? checks.map((item) => `- ${item}`).join("\n") : "- Use uma checagem compatível com o contexto antes de agir."}\n\n## Limite\n\n${entry.boundary}\n\nFonte canônica: ${url(englishBiasPath(entry))}\nLocalização revisada: ${url(biasPath(entry))}\n`;
}

async function generateMachineData() {
  const dir = join(OUT, "pt-br", "data");
  await mkdir(dir, { recursive: true });
  const localizedBiases = translations.entries.map((entry) => {
    const review = evidenceReviews.get(entry.canonicalId);
    return {
      canonicalId: entry.canonicalId,
      locale: "pt-BR",
      localizedSlug: entry.localizedSlug,
      localizedLabel: entry.localizedLabel,
      englishLabel: entry.englishLabel,
      aliases: entry.aliases,
      searchTerms: entry.searchTerms,
      summary: entry.summary,
      practicalQuestion: entry.practicalQuestion,
      examples: entry.examples,
      boundary: entry.boundary,
      techniqueSlugs: entry.techniqueSlugs,
      translationReview: { status: entry.state, reviewedAt: entry.reviewedAt, sourceRelease: entry.sourceRelease },
      canonicalEvidence: review ? { status: review.evidenceStatus, reviewedAt: review.reviewedAt, summary: review.summary, sources: review.sources } : null,
      url: url(biasPath(entry)),
      canonicalUrl: url(englishBiasPath(entry))
    };
  });
  const localizedAgentSkills = agentSkills.entries.map((entry) => ({ ...entry, locale: "pt-BR", canonical: canonicalAgentByName.get(entry.canonicalSlug) || null, skillUrl: url(agentSkillPath(entry)), skillMarkdown: url(`/pt-br/agent-skills/${entry.canonicalSlug}/SKILL.md`) }));
  const biasAgentSkills = translations.entries.map((entry) => ({ name: `bias-${entry.canonicalId}`, locale: "pt-BR", canonicalBias: entry.canonicalId, title: entry.localizedLabel, skillMarkdown: url(`/pt-br/agent-skills/bias-${entry.canonicalId}/SKILL.md`), humanPage: url(biasPath(entry)) }));
  const manifest = {
    version: 1,
    locale: "pt-BR",
    canonicalLocale: "en",
    status: "reviewed-partial-human-layer",
    sourceRelease: release.releaseVersion,
    generatedAt: TODAY,
    canonicalSite: `${SITE}/`,
    localizedSite: `${SITE}/pt-br/`,
    coverage: {
      concepts: translations.entries.length,
      canonicalPublishedConcepts: publishedBiases.length,
      conceptPolicy: "curated-reviewed-subset-no-silent-fallback",
      techniques: techniques.entries.length,
      canonicalTechniques: canonicalTechniqueBySlug.size,
      decisionSkills: skills.entries.length,
      canonicalDecisionSkills: canonicalSkillBySlug.size,
      workflowAgentSkills: agentSkills.entries.length,
      canonicalWorkflowAgentSkills: canonicalAgentByName.size,
      localizedBiasAgentSkills: biasAgentSkills.length
    },
    semantics: {
      canonicalIdentifiersRemainEnglish: true,
      evidenceStatusRemainsCanonical: true,
      translationReviewSeparateFromEvidenceReview: true,
      sourceTitlesRemainOriginal: true,
      translateJsonFieldNames: false,
      noEnglishFallbackPresentedAsReviewedPortuguese: true
    },
    datasets: {
      concepts: `${SITE}/pt-br/data/biases.json`,
      techniques: `${SITE}/pt-br/data/techniques.json`,
      decisionSkills: `${SITE}/pt-br/data/skills.json`,
      agentSkills: `${SITE}/pt-br/data/agent-skills.json`,
      search: `${SITE}/pt-br/data/search.json`,
      localeRegistry: `${SITE}/data/locales.json`,
      aiLocaleRegistry: `${SITE}/ai/locales.json`
    },
    agentRouting: `${SITE}/pt-br/llms.txt`
  };
  const search = [
    ...localizedBiases.map((entry) => ({ kind: "bias", id: entry.canonicalId, title: entry.localizedLabel, englishTitle: entry.englishLabel, url: entry.url, terms: [...entry.aliases, ...entry.searchTerms] })),
    ...techniques.entries.map((entry) => ({ kind: "technique", id: entry.canonicalSlug, title: entry.title, url: url(techniquePath(entry)), terms: entry.aliases || [] })),
    ...skills.entries.map((entry) => ({ kind: "decision-skill", id: entry.canonicalSlug, title: entry.title, url: url(skillPath(entry)), terms: entry.aliases || [] })),
    ...agentSkills.entries.map((entry) => ({ kind: "agent-skill", id: entry.canonicalSlug, title: entry.name, url: url(agentSkillPath(entry)), terms: [entry.summary] }))
  ];
  await writeFile(join(dir, "index.json"), JSON.stringify(manifest, null, 2) + "\n");
  await writeFile(join(dir, "biases.json"), JSON.stringify({ version: 1, locale: "pt-BR", entries: localizedBiases }, null, 2) + "\n");
  await writeFile(join(dir, "techniques.json"), JSON.stringify(techniques, null, 2) + "\n");
  await writeFile(join(dir, "skills.json"), JSON.stringify(skills, null, 2) + "\n");
  await writeFile(join(dir, "agent-skills.json"), JSON.stringify({ version: 1, locale: "pt-BR", workflowSkills: localizedAgentSkills, biasSkills: biasAgentSkills }, null, 2) + "\n");
  await writeFile(join(dir, "search.json"), JSON.stringify({ version: 1, locale: "pt-BR", entries: search }, null, 2) + "\n");
  await writeFile(join(OUT, "pt-br", "llms.txt"), await readFile("ai/llms.pt-br.txt", "utf8"));
}

async function updateSitemap(paths) {
  const sitemapPath = join(OUT, "sitemap.xml");
  let sitemap = await readFile(sitemapPath, "utf8");
  for (const path of paths) {
    const loc = url(path);
    if (!sitemap.includes(`<loc>${loc}</loc>`)) sitemap = sitemap.replace("</urlset>", `<url><loc>${loc}</loc></url></urlset>`);
  }
  await writeFile(sitemapPath, sitemap);
  const local = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${url(path)}</loc></url>`).join("")}</urlset>\n`;
  await writeFile(join(OUT, "pt-br", "sitemap.xml"), local);
}

async function patchEnglishDiscovery() {
  const pairs = [
    ["/", "/pt-br/"],
    ["/explore/", "/pt-br/explorar/"],
    ["/techniques/", "/pt-br/tecnicas/"],
    ["/skills/", "/pt-br/habilidades/"],
    ["/agent-skills/", "/pt-br/agent-skills/"],
    ...translations.entries.map((entry) => [englishBiasPath(entry), biasPath(entry)]),
    ...techniques.entries.map((entry) => [`/techniques/${entry.canonicalSlug}/`, techniquePath(entry)]),
    ...skills.entries.map((entry) => [`/skills/${entry.canonicalSlug}/`, skillPath(entry)]),
    ...agentSkills.entries.map((entry) => [`/agent-skills/${entry.canonicalSlug}/`, agentSkillPath(entry)])
  ];
  for (const [englishRoute, portugueseRoute] of pairs) await patchEnglishPage(englishRoute, portugueseRoute);
}

async function patchEnglishPage(englishRoute, portugueseRoute) {
  const path = englishRoute === "/" ? join(OUT, "index.html") : join(OUT, englishRoute.replace(/^\//, ""), "index.html");
  let html;
  try { html = await readFile(path, "utf8"); } catch { return; }
  const alternate = `<link rel="alternate" hreflang="pt-BR" href="${url(portugueseRoute)}">`;
  if (!html.includes('hreflang="pt-BR"')) html = html.replace("</head>", `${alternate}</head>`);
  if (!html.includes('data-locale-switch="pt-BR"')) {
    const link = `<a data-locale-switch="pt-BR" hreflang="pt-BR" lang="pt-BR" href="${portugueseRoute}">Português (Brasil)</a>`;
    html = html.includes("</footer>") ? html.replace("</footer>", `<p class="fine-print">${link}</p></footer>`) : html.replace("</body>", `<p class="fine-print">${link}</p></body>`);
  }
  await writeFile(path, html);
}

function stylesheet() {
  return `:root{--pt-ink:#101622;--pt-paper:#fffdf7;--pt-line:#d9d9d2;--pt-soft:#f3f1e9;--pt-accent:#8d3f22}.pt-shell{width:min(1120px,calc(100% - 2rem));margin-inline:auto}.pt-header{border-bottom:1px solid var(--pt-line);background:#fff}.pt-nav{display:flex;gap:1rem;align-items:center;justify-content:space-between;padding:1rem 0}.pt-nav nav{display:flex;flex-wrap:wrap;gap:.9rem}.pt-brand{font-weight:800;color:var(--pt-ink);text-decoration:none}.pt-hero{padding:5rem 0 4rem;background:linear-gradient(135deg,#fffdf7,#f0eee4)}.pt-hero--compact{padding:3.25rem 0}.pt-hero h1{max-width:880px;font-size:clamp(2.2rem,5vw,4.8rem);line-height:1.02;margin:.5rem 0 1rem}.pt-lede{max-width:780px;font-size:1.18rem;line-height:1.65}.pt-kicker{text-transform:uppercase;letter-spacing:.08em;font-size:.78rem;font-weight:800}.pt-actions{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.5rem}.pt-button{display:inline-block;padding:.8rem 1rem;border-radius:999px;background:var(--pt-ink);color:#fff;text-decoration:none;font-weight:700}.pt-button--quiet{background:transparent;color:var(--pt-ink);border:1px solid var(--pt-ink)}.pt-section{padding:3.5rem 0}.pt-section--ink{background:var(--pt-ink);color:#fff}.pt-section--ink a{color:#fff}.pt-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1rem}.pt-card{border:1px solid var(--pt-line);border-radius:16px;padding:1.25rem;background:#fff;color:var(--pt-ink)}.pt-card h2,.pt-card h3{margin:.35rem 0 .7rem}.pt-card a{color:inherit}.pt-question{font-weight:700}.pt-note{max-width:780px;margin-top:1.5rem;padding:1rem 1.1rem;border-left:4px solid var(--pt-accent);background:#fff}.pt-section--ink .pt-note{color:var(--pt-ink)}.pt-meta{display:flex;flex-wrap:wrap;gap:.7rem 1.2rem;font-size:.9rem}.pt-prose{max-width:800px}.pt-prose li{margin:.55rem 0;line-height:1.55}.pt-search{display:grid;gap:.45rem;max-width:650px;margin-top:1.5rem;font-weight:700}.pt-search input{font:inherit;padding:.85rem 1rem;border:1px solid var(--pt-line);border-radius:10px;background:#fff}.pt-muted{opacity:.72}.pt-footer{border-top:1px solid var(--pt-line);padding:2rem 0;background:var(--pt-soft);font-size:.92rem}.pt-footer p{max-width:900px}.pt-footer a{color:inherit}@media(max-width:760px){.pt-nav{align-items:flex-start;flex-direction:column}.pt-nav nav{gap:.7rem}.pt-hero{padding:3.5rem 0 3rem}}`;
}
