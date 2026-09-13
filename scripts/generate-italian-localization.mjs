import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const OUT = "dist";
const SITE = "https://cognitive-biases.github.io";
const TODAY = "2026-09-13";
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const release = await readJson("data/release.json");
const canonicalBiases = await readJson("data/biases.json");
const techniqueDocument = await readJson("data/techniques.json");
const canonicalSkills = await readJson("data/skills.json");
const canonicalAgentSkills = await readJson("data/agent-skills.json");
const ui = await readJson("data/ui-it.json");
const pages = await readJson("data/pages-it.json");
const translations = await readJson("data/translations-it.json");
const techniques = await readJson("data/techniques-it.json");
const skills = await readJson("data/skills-it.json");
const agentSkills = await readJson("data/agent-skills-it.json");
const evidenceReviews = await loadEvidenceReviews();

const publishedBiases = canonicalBiases.filter((entry) => entry.published);
const canonicalBiasBySlug = new Map(publishedBiases.map((entry) => [entry.slug, entry]));
const canonicalTechniqueBySlug = new Map((techniqueDocument.techniques || []).map((entry) => [entry.slug, entry]));
const canonicalSkillBySlug = new Map((canonicalSkills.entries || []).map((entry) => [entry.slug, entry]));
const canonicalAgentByName = new Map((canonicalAgentSkills.skills || []).map((entry) => [entry.name, entry]));
const localizedTechniqueByCanonical = new Map(techniques.entries.map((entry) => [entry.canonicalSlug, entry]));
const generatedPaths = [];

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function jsonLd(value) { return JSON.stringify(value).replace(/</g, "\\u003c"); }
function url(path) { return `${SITE}${path}`; }
function biasPath(entry) { return `/it/bias/${entry.localizedSlug}/`; }
function englishBiasPath(entry) { return `/biases/${entry.canonicalId}/`; }
function techniquePath(entry) { return `/it/tecniche/${entry.localizedSlug}/`; }
function skillPath(entry) { return `/it/competenze/${entry.localizedSlug}/`; }
function agentSkillPath(entry) { return `/it/agent-skills/${entry.canonicalSlug}/`; }
function cleanMeta(value = "") {
  const text = String(value).replace(/\s+/g, " ").trim();
  if (text.length <= 155) return text;
  return `${text.slice(0, 151).replace(/\s+\S*$/, "").replace(/[,:;–—-]+$/, "")}…`;
}

function validateParity() {
  if (translations.locale !== "it" || translations.canonicalLocale !== "en") throw new Error("Italian translation locale contract is invalid.");
  if (translations.sourceRelease !== release.releaseVersion) throw new Error(`Italian bias source release ${translations.sourceRelease} does not match ${release.releaseVersion}.`);
  for (const entry of translations.entries) {
    if (!canonicalBiasBySlug.has(entry.canonicalId)) throw new Error(`Unknown or unpublished Italian bias: ${entry.canonicalId}`);
    for (const slug of entry.techniqueSlugs || []) if (!localizedTechniqueByCanonical.has(slug)) throw new Error(`${entry.canonicalId}: unknown linked Italian technique ${slug}`);
  }
  for (const entry of techniques.entries) if (!canonicalTechniqueBySlug.has(entry.canonicalSlug)) throw new Error(`Unknown canonical technique in Italian: ${entry.canonicalSlug}`);
  if (techniques.entries.length !== canonicalTechniqueBySlug.size) throw new Error(`Italian techniques coverage is ${techniques.entries.length}/${canonicalTechniqueBySlug.size}; full parity is required.`);
  for (const entry of skills.entries) if (!canonicalSkillBySlug.has(entry.canonicalSlug)) throw new Error(`Unknown canonical Decision Skill in Italian: ${entry.canonicalSlug}`);
  if (skills.entries.length !== canonicalSkillBySlug.size) throw new Error(`Italian Decision Skills coverage is ${skills.entries.length}/${canonicalSkillBySlug.size}; full parity is required.`);
  for (const entry of agentSkills.entries) if (!canonicalAgentByName.has(entry.canonicalSlug)) throw new Error(`Unknown canonical Agent Skill in Italian: ${entry.canonicalSlug}`);
  if (agentSkills.entries.length !== canonicalAgentByName.size) throw new Error(`Italian Agent Skills coverage is ${agentSkills.entries.length}/${canonicalAgentByName.size}; full parity is required.`);
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

function nav(englishEquivalent = "/") {
  return `<header class="it-header"><div class="it-shell it-nav"><a class="it-brand" href="/it/">Cognitive Biases</a><nav aria-label="Navigazione principale"><a href="/it/bias-cognitivi/">${esc(ui.navigation.explore)}</a><a href="/it/tecniche/">${esc(ui.navigation.techniques)}</a><a href="/it/competenze/">${esc(ui.navigation.skills)}</a><a href="/it/agent-skills/">${esc(ui.navigation.agentSkills)}</a><a hreflang="en" lang="en" href="${esc(englishEquivalent)}">English</a></nav></div></header>`;
}
function footer() {
  return `<footer class="it-footer"><div class="it-shell"><p>${esc(ui.notices.educational)}</p><p>${esc(ui.notices.evidenceBoundary)}</p><p><a href="/about/editorial/">Processo editoriale</a> · <a href="/methodology/">Metodologia canonica</a> · <a href="/it/data/index.json">Dati IT</a> · <a href="/it/llms.txt">Routing LLM</a></p></div></footer>`;
}
function renderPage({ route, englishRoute, title, description, body, schemas = [] }) {
  const canonical = url(route);
  const english = url(englishRoute);
  const webPage = { "@context": "https://schema.org", "@type": "WebPage", "@id": `${canonical}#webpage`, name: title, description, url: canonical, inLanguage: "it", isPartOf: { "@type": "WebSite", "@id": `${SITE}/#website`, name: "Cognitive Biases", url: `${SITE}/` } };
  const schemaScripts = [webPage, ...schemas].map((schema) => `<script type="application/ld+json">${jsonLd(schema)}</script>`).join("");
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><meta name="robots" content="max-image-preview:large,max-snippet:-1,max-video-preview:-1"><title>${esc(title)}</title><meta name="description" content="${esc(cleanMeta(description))}"><link rel="canonical" href="${canonical}"><link rel="alternate" hreflang="it" href="${canonical}"><link rel="alternate" hreflang="en" href="${english}"><link rel="alternate" hreflang="x-default" href="${english}"><link rel="icon" href="/favicon.png"><meta property="og:locale" content="it_IT"><meta property="og:locale:alternate" content="en_US"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(cleanMeta(description))}"><meta property="og:url" content="${canonical}"><meta property="og:type" content="website"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/it.css">${schemaScripts}</head><body><a class="skip" href="#main">${esc(ui.skipToContent)}</a>${nav(englishRoute)}<main id="main">${body}</main>${footer()}</body></html>`;
}
async function emit(route, html) {
  const target = join(OUT, route.replace(/^\//, ""), "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
  generatedPaths.push(route);
}

async function generateHome() {
  const cards = translations.entries.slice(0, 8).map((entry) => `<article class="it-card"><p class="it-kicker"><span lang="en">${esc(entry.englishLabel)}</span></p><h3><a href="${biasPath(entry)}">${esc(entry.localizedLabel)}</a></h3><p>${esc(entry.summary)}</p><p class="it-question">${esc(entry.practicalQuestion)}</p></article>`).join("");
  const journeys = pages.home.journeys.map((entry) => `<article class="it-card"><h3>${esc(entry.title)}</h3><p>${esc(entry.text)}</p></article>`).join("");
  const body = `<section class="it-hero"><div class="it-shell"><p class="it-kicker">${esc(pages.home.eyebrow)}</p><h1>${esc(pages.home.title)}</h1><p class="it-lede">${esc(pages.home.lede)}</p><div class="it-actions"><a class="it-button" href="/it/bias-cognitivi/">${esc(ui.actions.browseAll)}</a><a class="it-button it-button--quiet" href="/it/tecniche/">${esc(ui.actions.browseTechniques)}</a></div><div class="it-note"><strong>Italiano revisionato, senza fallback invisibile.</strong><p>${esc(ui.notices.partialCatalog)}</p></div></div></section><section class="it-section"><div class="it-shell"><p class="it-kicker">Parti dal tuo obiettivo</p><h2>Dal concetto alla decisione.</h2><div class="it-grid">${journeys}</div></div></section><section class="it-section it-section--ink"><div class="it-shell"><p class="it-kicker">Bias in evidenza</p><h2>Pattern che compaiono nelle decisioni reali.</h2><div class="it-grid">${cards}</div></div></section>`;
  await emit("/it/", renderPage({ route: "/it/", englishRoute: "/", title: `${pages.home.title} | Cognitive Biases`, description: pages.home.description, body, schemas: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "Bias cognitivi in italiano", inLanguage: "it", url: `${SITE}/it/`, numberOfItems: translations.entries.length, about: "Bias cognitivi e processo decisionale" }] }));
}

async function generateExplorer() {
  const cards = translations.entries.map((entry) => `<article class="it-card it-search-card" data-search="${esc([entry.localizedLabel, entry.englishLabel, ...(entry.aliases || []), ...(entry.searchTerms || [])].join(" ").toLowerCase())}"><p class="it-kicker"><span lang="en">${esc(entry.englishLabel)}</span></p><h2><a href="${biasPath(entry)}">${esc(entry.localizedLabel)}</a></h2><p>${esc(entry.summary)}</p><p class="it-question">${esc(entry.practicalQuestion)}</p></article>`).join("");
  const body = `<section class="it-hero it-hero--compact"><div class="it-shell"><p class="it-kicker">Bias cognitivi</p><h1>${esc(pages.explorer.title)}</h1><p class="it-lede">${esc(pages.explorer.intro)}</p><label class="it-search">${esc(ui.search.label)}<input id="it-search" type="search" placeholder="${esc(ui.search.placeholder)}" autocomplete="off"></label><p class="it-muted">${translations.entries.length} schede revisionate in italiano · ${publishedBiases.length} concetti pubblicati nel catalogo canonico.</p></div></section><section class="it-section"><div class="it-shell"><div id="it-results" class="it-grid">${cards}</div><p id="it-empty" class="it-note" hidden>${esc(ui.search.noResults)}</p></div></section><script>(()=>{const i=document.getElementById('it-search'),c=[...document.querySelectorAll('.it-search-card')],e=document.getElementById('it-empty');const n=s=>s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();i.addEventListener('input',()=>{const q=n(i.value.trim());let shown=0;c.forEach(x=>{const ok=!q||n(x.dataset.search).includes(q);x.hidden=!ok;if(ok)shown++});e.hidden=shown!==0})})()</script>`;
  await emit("/it/bias-cognitivi/", renderPage({ route: "/it/bias-cognitivi/", englishRoute: "/explore/", title: `${pages.explorer.title} | Cognitive Biases`, description: pages.explorer.description, body }));
}

async function generateBiasPages() {
  for (const entry of translations.entries) {
    const canonical = canonicalBiasBySlug.get(entry.canonicalId);
    const review = evidenceReviews.get(entry.canonicalId);
    const linked = (entry.techniqueSlugs || []).map((slug) => localizedTechniqueByCanonical.get(slug)).filter(Boolean);
    const evidence = review ? `<section class="it-section"><div class="it-shell it-prose"><p class="it-kicker">${esc(ui.labels.evidence)}</p><h2>Che cosa consente di affermare la revisione canonica.</h2><p><strong>Stato canonico:</strong> <span lang="en">${esc(review.evidenceStatus)}</span></p><p>${esc(entry.evidenceSummary || review.summary || "Esiste una revisione canonica delle evidenze collegata a questo concetto.")}</p><ol>${(review.sources || []).map((source) => `<li><a href="${esc(source.url)}" rel="external noreferrer">${esc(source.title)}</a>${source.year ? ` · ${esc(source.year)}` : ""}</li>`).join("")}</ol><p class="it-muted">Revisione canonica: ${esc(review.reviewedAt || "data non indicata")}.</p></div></section>` : `<section class="it-section"><div class="it-shell it-prose"><p class="it-kicker">${esc(ui.labels.evidence)}</p><h2>Revisione dedicata non ancora disponibile.</h2><div class="it-note"><strong>Localizzazione revisionata ≠ evidenza scientifica revisionata.</strong><p>Questa pagina localizza il concetto canonico corrente, ma non esiste una revisione delle evidenze dedicata collegata a esso. Non usare l'etichetta come diagnosi né come causa certa di un caso individuale.</p></div></div></section>`;
    const techniqueCards = linked.map((technique) => `<article class="it-card"><h3><a href="${techniquePath(technique)}">${esc(technique.title)}</a></h3><p>${esc(technique.summary)}</p></article>`).join("");
    const schema = { "@context": "https://schema.org", "@type": "DefinedTerm", "@id": `${url(biasPath(entry))}#term`, name: entry.localizedLabel, alternateName: [entry.englishLabel, ...(entry.aliases || [])], description: entry.summary, inDefinedTermSet: `${SITE}/`, sameAs: url(englishBiasPath(entry)), identifier: entry.canonicalId, inLanguage: "it" };
    const body = `<article><section class="it-hero it-hero--compact"><div class="it-shell"><p class="it-kicker"><span lang="en">${esc(entry.englishLabel)}</span></p><h1>${esc(entry.localizedLabel)}</h1><p class="it-lede">${esc(entry.summary)}</p><p class="it-question">${esc(entry.practicalQuestion)}</p><div class="it-meta"><span>${esc(ui.labels.canonicalId)}: <code>${esc(entry.canonicalId)}</code></span><span>${esc(ui.labels.reviewStatus)}: ${esc(ui.labels.reviewed)}</span><span>${esc(ui.labels.sourceRelease)}: ${esc(entry.sourceRelease || translations.sourceRelease)}</span></div></div></section><section class="it-section"><div class="it-shell it-prose"><p class="it-kicker">Nella pratica</p><h2>Come può manifestarsi.</h2><ul>${entry.examples.map((example) => `<li>${esc(example)}</li>`).join("")}</ul><h2>${esc(ui.labels.limits)}</h2><p>${esc(entry.boundary)}</p></div></section>${evidence}${techniqueCards ? `<section class="it-section it-section--ink"><div class="it-shell"><p class="it-kicker">${esc(ui.labels.techniques)}</p><h2>Cambia il processo, non soltanto l'etichetta.</h2><div class="it-grid">${techniqueCards}</div></div></section>` : ""}<section class="it-section"><div class="it-shell"><p><a href="${englishBiasPath(entry)}" hreflang="en" lang="en">${esc(ui.actions.openEnglish)} →</a></p><p class="it-muted">Voce canonica #${esc(canonical?.number ?? "—")} · localizzazione revisionata il ${esc(translations.reviewedAt)}.</p></div></section></article>`;
    await emit(biasPath(entry), renderPage({ route: biasPath(entry), englishRoute: englishBiasPath(entry), title: `${entry.localizedLabel}: esempi, evidenze e controlli pratici | Cognitive Biases`, description: `${entry.summary} Esempi, limiti, evidenze e un controllo pratico per decisioni migliori.`, body, schemas: [schema] }));
  }
}

async function generateTechniques() {
  const cards = techniques.entries.map((entry) => `<article class="it-card"><p class="it-kicker"><code>${esc(entry.canonicalSlug)}</code></p><h2><a href="${techniquePath(entry)}">${esc(entry.title)}</a></h2><p>${esc(entry.summary)}</p></article>`).join("");
  const body = `<section class="it-hero it-hero--compact"><div class="it-shell"><p class="it-kicker">Controlli decisionali</p><h1>${esc(pages.techniques.title)}</h1><p class="it-lede">${esc(pages.techniques.intro)}</p><div class="it-note"><p>${esc(ui.notices.techniqueBoundary)}</p></div></div></section><section class="it-section"><div class="it-shell"><div class="it-grid">${cards}</div></div></section>`;
  await emit("/it/tecniche/", renderPage({ route: "/it/tecniche/", englishRoute: "/techniques/", title: `${pages.techniques.title} | Cognitive Biases`, description: pages.techniques.description, body }));
  for (const entry of techniques.entries) {
    const schema = { "@context": "https://schema.org", "@type": "HowTo", name: entry.title, description: entry.summary, inLanguage: "it", step: entry.steps.map((text, index) => ({ "@type": "HowToStep", position: index + 1, text })), sameAs: url(`/techniques/${entry.canonicalSlug}/`) };
    const pageBody = `<article><section class="it-hero it-hero--compact"><div class="it-shell"><p class="it-kicker">Tecnica decisionale</p><h1>${esc(entry.title)}</h1><p class="it-lede">${esc(entry.summary)}</p></div></section><section class="it-section"><div class="it-shell it-prose"><h2>Come applicarla</h2><ol>${entry.steps.map((step) => `<li>${esc(step)}</li>`).join("")}</ol><h2>Esempio</h2><p>${esc(entry.example)}</p><h2>${esc(ui.labels.limits)}</h2><p>${esc(entry.boundary)}</p><p><a href="/techniques/${entry.canonicalSlug}/" hreflang="en" lang="en">Vedi la tecnica canonica in inglese →</a></p></div></section></article>`;
    await emit(techniquePath(entry), renderPage({ route: techniquePath(entry), englishRoute: `/techniques/${entry.canonicalSlug}/`, title: `${entry.title}: come applicarla | Cognitive Biases`, description: `${entry.summary} Passi, esempio e limiti per usarla in decisioni reali.`, body: pageBody, schemas: [schema] }));
  }
}

async function generateSkills() {
  const cards = skills.entries.map((entry) => `<article class="it-card"><h2><a href="${skillPath(entry)}">${esc(entry.title)}</a></h2><p>${esc(entry.summary)}</p><p class="it-question">${esc(entry.outcome)}</p></article>`).join("");
  const body = `<section class="it-hero it-hero--compact"><div class="it-shell"><p class="it-kicker">Pratica deliberata</p><h1>${esc(pages.skills.title)}</h1><p class="it-lede">${esc(pages.skills.intro)}</p></div></section><section class="it-section"><div class="it-shell"><div class="it-grid">${cards}</div></div></section>`;
  await emit("/it/competenze/", renderPage({ route: "/it/competenze/", englishRoute: "/skills/", title: `${pages.skills.title} | Cognitive Biases`, description: pages.skills.description, body }));
  for (const entry of skills.entries) {
    const schema = { "@context": "https://schema.org", "@type": "LearningResource", name: entry.title, description: entry.summary, educationalUse: "practice", learningResourceType: "Decision Skill", inLanguage: "it", sameAs: url(`/skills/${entry.canonicalSlug}/`), identifier: entry.canonicalSlug };
    const pageBody = `<article><section class="it-hero it-hero--compact"><div class="it-shell"><p class="it-kicker">Competenza decisionale</p><h1>${esc(entry.title)}</h1><p class="it-lede">${esc(entry.summary)}</p><p class="it-question">${esc(entry.outcome)}</p></div></section><section class="it-section"><div class="it-shell it-prose"><h2>${esc(ui.labels.whenToUse)}</h2><ul>${entry.whenToUse.map((item) => `<li>${esc(item)}</li>`).join("")}</ul><h2>${esc(ui.labels.actions)}</h2><ol>${entry.actions.map((item) => `<li>${esc(item)}</li>`).join("")}</ol><h2>Esempio</h2><p>${esc(entry.example)}</p><h2>${esc(ui.labels.limits)}</h2><p>${esc(entry.boundary)}</p><p><a href="/skills/${entry.canonicalSlug}/" hreflang="en" lang="en">Vedi la skill canonica in inglese →</a></p></div></section></article>`;
    await emit(skillPath(entry), renderPage({ route: skillPath(entry), englishRoute: `/skills/${entry.canonicalSlug}/`, title: `${entry.title} | Cognitive Biases`, description: `${entry.summary} Quando usarla, come esercitarla, esempio e limiti.`, body: pageBody, schemas: [schema] }));
  }
}

async function generateAgentSkills() {
  const cards = agentSkills.entries.map((entry) => `<article class="it-card"><p class="it-kicker"><code>${esc(entry.canonicalSlug)}</code></p><h2><a href="${agentSkillPath(entry)}">${esc(entry.name)}</a></h2><p>${esc(entry.summary)}</p></article>`).join("");
  const body = `<section class="it-hero it-hero--compact"><div class="it-shell"><p class="it-kicker">Agent Skills · IT</p><h1>${esc(pages.agentSkills.title)}</h1><p class="it-lede">${esc(pages.agentSkills.intro)}</p><div class="it-actions"><a class="it-button" href="/it/data/agent-skills.json">JSON</a><a class="it-button it-button--quiet" href="/it/llms.txt">llms.txt</a></div></div></section><section class="it-section"><div class="it-shell"><div class="it-grid">${cards}</div></div></section>`;
  await emit("/it/agent-skills/", renderPage({ route: "/it/agent-skills/", englishRoute: "/agent-skills/", title: `${pages.agentSkills.title} | Cognitive Biases`, description: pages.agentSkills.description, body }));
  for (const entry of agentSkills.entries) {
    const canonical = canonicalAgentByName.get(entry.canonicalSlug);
    const pageBody = `<article><section class="it-hero it-hero--compact"><div class="it-shell"><p class="it-kicker">Agent Skill · <code>${esc(entry.canonicalSlug)}</code></p><h1>${esc(entry.name)}</h1><p class="it-lede">${esc(entry.summary)}</p></div></section><section class="it-section"><div class="it-shell it-prose"><h2>Usa quando</h2><ul>${entry.useWhen.map((item) => `<li>${esc(item)}</li>`).join("")}</ul><h2>Procedura</h2><ol>${entry.procedure.map((item) => `<li>${esc(item)}</li>`).join("")}</ol><h2>Formato della risposta</h2><ul>${entry.output.map((item) => `<li>${esc(item)}</li>`).join("")}</ul><h2>Guardrail</h2><ul>${entry.guardrails.map((item) => `<li>${esc(item)}</li>`).join("")}</ul><p><a href="/it/agent-skills/${entry.canonicalSlug}/SKILL.md">Apri SKILL.md in italiano →</a></p><p><a href="/agent-skills/${entry.canonicalSlug}/" hreflang="en" lang="en">Apri l'Agent Skill canonica →</a></p></div></section></article>`;
    await emit(agentSkillPath(entry), renderPage({ route: agentSkillPath(entry), englishRoute: `/agent-skills/${entry.canonicalSlug}/`, title: `${entry.name} — Agent Skill in italiano | Cognitive Biases`, description: entry.summary, body: pageBody }));
    const dir = join(OUT, "it", "agent-skills", entry.canonicalSlug);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "SKILL.md"), workflowSkillMarkdown(entry, canonical));
  }
  for (const entry of translations.entries) {
    const dir = join(OUT, "it", "agent-skills", `bias-${entry.canonicalId}`);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "SKILL.md"), biasSkillMarkdown(entry));
  }
}

function workflowSkillMarkdown(entry, canonical) {
  return `---\nname: ${entry.canonicalSlug}\ndescription: ${entry.summary.replace(/\n/g, " ")}\nmetadata:\n  locale: it\n  canonical_skill: ${entry.canonicalSlug}\n  source_release: ${release.releaseVersion}\n  canonical_category: ${canonical?.category || "unknown"}\n---\n\n# ${entry.name}\n\n${entry.summary}\n\n## Usa quando\n${entry.useWhen.map((item) => `- ${item}`).join("\n")}\n\n## Procedura\n${entry.procedure.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\n## Formato della risposta\n${entry.output.map((item) => `- ${item}`).join("\n")}\n\n## Guardrail\n${entry.guardrails.map((item) => `- ${item}`).join("\n")}\n\n## Provenienza\n\nQuesta è la localizzazione italiana della skill canonica \`${entry.canonicalSlug}\`. ID, limiti delle evidenze e fonti restano definiti dalla libreria canonica in inglese.\n`;
}
function biasSkillMarkdown(entry) {
  const checks = (entry.techniqueSlugs || []).map((slug) => localizedTechniqueByCanonical.get(slug)?.title).filter(Boolean);
  return `---\nname: bias-${entry.canonicalId}\ndescription: Analizza ${entry.localizedLabel} in italiano mantenendo esplicite evidenze, alternative e incertezza.\nmetadata:\n  locale: it\n  canonical_bias: ${entry.canonicalId}\n  source_release: ${release.releaseVersion}\n---\n\n# ${entry.localizedLabel}\n\n${entry.summary}\n\n## Procedura\n\n1. Riformula la situazione in modo neutro e identifica i fatti osservabili.\n2. Spiega perché **${entry.localizedLabel}** potrebbe essere un'ipotesi pertinente.\n3. Includi almeno una spiegazione alternativa plausibile.\n4. Chiedi: **${entry.practicalQuestion}**\n5. Cerca evidenze che possano distinguere le ipotesi.\n6. Conserva l'incertezza e lo stato canonico delle evidenze.\n\n## Controlli pratici\n${checks.length ? checks.map((item) => `- ${item}`).join("\n") : "- Usa un controllo coerente con il contesto prima di agire."}\n\n## Limite\n\n${entry.boundary}\n\nFonte canonica: ${url(englishBiasPath(entry))}\nLocalizzazione revisionata: ${url(biasPath(entry))}\n`;
}

async function generateMachineData() {
  const dir = join(OUT, "it", "data");
  await mkdir(dir, { recursive: true });
  const localizedBiases = translations.entries.map((entry) => {
    const review = evidenceReviews.get(entry.canonicalId);
    return { canonicalId: entry.canonicalId, locale: "it", localizedSlug: entry.localizedSlug, localizedLabel: entry.localizedLabel, englishLabel: entry.englishLabel, aliases: entry.aliases, searchTerms: entry.searchTerms, summary: entry.summary, practicalQuestion: entry.practicalQuestion, examples: entry.examples, boundary: entry.boundary, techniqueSlugs: entry.techniqueSlugs, translationReview: { status: entry.state, reviewedAt: translations.reviewedAt, sourceRelease: translations.sourceRelease }, canonicalEvidence: review ? { status: review.evidenceStatus, reviewedAt: review.reviewedAt, summary: review.summary, sources: review.sources } : null, url: url(biasPath(entry)), canonicalUrl: url(englishBiasPath(entry)) };
  });
  const workflowSkills = agentSkills.entries.map((entry) => ({ ...entry, locale: "it", canonical: canonicalAgentByName.get(entry.canonicalSlug) || null, skillUrl: url(agentSkillPath(entry)), skillMarkdown: url(`/it/agent-skills/${entry.canonicalSlug}/SKILL.md`) }));
  const biasSkills = translations.entries.map((entry) => ({ name: `bias-${entry.canonicalId}`, locale: "it", canonicalBias: entry.canonicalId, title: entry.localizedLabel, skillMarkdown: url(`/it/agent-skills/bias-${entry.canonicalId}/SKILL.md`), humanPage: url(biasPath(entry)) }));
  const manifest = { version: 1, locale: "it", canonicalLocale: "en", status: "reviewed-partial-human-layer", sourceRelease: release.releaseVersion, generatedAt: TODAY, canonicalSite: `${SITE}/`, localizedSite: `${SITE}/it/`, coverage: { concepts: translations.entries.length, canonicalPublishedConcepts: publishedBiases.length, conceptPolicy: "curated-reviewed-subset-no-silent-fallback", techniques: techniques.entries.length, canonicalTechniques: canonicalTechniqueBySlug.size, decisionSkills: skills.entries.length, canonicalDecisionSkills: canonicalSkillBySlug.size, workflowAgentSkills: agentSkills.entries.length, canonicalWorkflowAgentSkills: canonicalAgentByName.size, localizedBiasAgentSkills: biasSkills.length }, semantics: { canonicalIdentifiersRemainEnglish: true, evidenceStatusRemainsCanonical: true, translationReviewSeparateFromEvidenceReview: true, sourceTitlesRemainOriginal: true, translateJsonFieldNames: false, noEnglishFallbackPresentedAsReviewedItalian: true }, datasets: { concepts: `${SITE}/it/data/biases.json`, techniques: `${SITE}/it/data/techniques.json`, decisionSkills: `${SITE}/it/data/skills.json`, agentSkills: `${SITE}/it/data/agent-skills.json`, search: `${SITE}/it/data/search.json`, localeRegistry: `${SITE}/data/locales.json`, aiLocaleRegistry: `${SITE}/ai/locales.json` }, agentRouting: `${SITE}/it/llms.txt` };
  const search = [...localizedBiases.map((entry) => ({ kind: "bias", id: entry.canonicalId, title: entry.localizedLabel, englishTitle: entry.englishLabel, url: entry.url, terms: [...entry.aliases, ...entry.searchTerms] })), ...techniques.entries.map((entry) => ({ kind: "technique", id: entry.canonicalSlug, title: entry.title, url: url(techniquePath(entry)), terms: entry.aliases || [] })), ...skills.entries.map((entry) => ({ kind: "decision-skill", id: entry.canonicalSlug, title: entry.title, url: url(skillPath(entry)), terms: entry.aliases || [] })), ...agentSkills.entries.map((entry) => ({ kind: "agent-skill", id: entry.canonicalSlug, title: entry.name, url: url(agentSkillPath(entry)), terms: [entry.summary] }))];
  await writeFile(join(dir, "index.json"), JSON.stringify(manifest, null, 2) + "\n");
  await writeFile(join(dir, "biases.json"), JSON.stringify({ version: 1, locale: "it", entries: localizedBiases }, null, 2) + "\n");
  await writeFile(join(dir, "techniques.json"), JSON.stringify(techniques, null, 2) + "\n");
  await writeFile(join(dir, "skills.json"), JSON.stringify(skills, null, 2) + "\n");
  await writeFile(join(dir, "agent-skills.json"), JSON.stringify({ version: 1, locale: "it", workflowSkills, biasSkills }, null, 2) + "\n");
  await writeFile(join(dir, "search.json"), JSON.stringify({ version: 1, locale: "it", entries: search }, null, 2) + "\n");
  await writeFile(join(OUT, "it", "llms.txt"), await readFile("ai/llms.it.txt", "utf8"));
}

async function updateSitemap(paths) {
  const sitemapPath = join(OUT, "sitemap.xml");
  let sitemap = await readFile(sitemapPath, "utf8");
  for (const path of paths) {
    const loc = url(path);
    if (!sitemap.includes(`<loc>${loc}</loc>`)) sitemap = sitemap.replace("</urlset>", `<url><loc>${loc}</loc></url></urlset>`);
  }
  await writeFile(sitemapPath, sitemap);
  await writeFile(join(OUT, "it", "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${url(path)}</loc></url>`).join("")}</urlset>\n`);
}

async function patchEnglishDiscovery() {
  const pairs = [["/", "/it/"], ["/explore/", "/it/bias-cognitivi/"], ["/techniques/", "/it/tecniche/"], ["/skills/", "/it/competenze/"], ["/agent-skills/", "/it/agent-skills/"], ...translations.entries.map((entry) => [englishBiasPath(entry), biasPath(entry)]), ...techniques.entries.map((entry) => [`/techniques/${entry.canonicalSlug}/`, techniquePath(entry)]), ...skills.entries.map((entry) => [`/skills/${entry.canonicalSlug}/`, skillPath(entry)]), ...agentSkills.entries.map((entry) => [`/agent-skills/${entry.canonicalSlug}/`, agentSkillPath(entry)])];
  for (const [englishRoute, italianRoute] of pairs) await patchEnglishPage(englishRoute, italianRoute);
}
async function patchEnglishPage(englishRoute, italianRoute) {
  const path = englishRoute === "/" ? join(OUT, "index.html") : join(OUT, englishRoute.replace(/^\//, ""), "index.html");
  let html;
  try { html = await readFile(path, "utf8"); } catch { return; }
  const alternate = `<link rel="alternate" hreflang="it" href="${url(italianRoute)}">`;
  if (!html.includes(`hreflang="it" href="${url(italianRoute)}"`)) html = html.replace("</head>", `${alternate}</head>`);
  if (!html.includes('data-locale-switch="it"')) {
    const link = `<a data-locale-switch="it" hreflang="it" lang="it" href="${italianRoute}">Italiano</a>`;
    html = html.includes("</footer>") ? html.replace("</footer>", `<p class="fine-print">${link}</p></footer>`) : html.replace("</body>", `<p class="fine-print">${link}</p></body>`);
  }
  await writeFile(path, html);
}

function stylesheet() {
  return `:root{--it-ink:#101622;--it-line:#d9d9d2;--it-soft:#f3f1e9;--it-accent:#8d3f22}.it-shell{width:min(1120px,calc(100% - 2rem));margin-inline:auto}.it-header{border-bottom:1px solid var(--it-line);background:#fff}.it-nav{display:flex;gap:1rem;align-items:center;justify-content:space-between;padding:1rem 0}.it-nav nav{display:flex;flex-wrap:wrap;gap:.9rem}.it-brand{font-weight:800;color:var(--it-ink);text-decoration:none}.it-hero{padding:5rem 0 4rem;background:linear-gradient(135deg,#fffdf7,#f0eee4)}.it-hero--compact{padding:3.25rem 0}.it-hero h1{max-width:900px;font-size:clamp(2.2rem,5vw,4.8rem);line-height:1.02;margin:.5rem 0 1rem}.it-lede{max-width:800px;font-size:1.18rem;line-height:1.65}.it-kicker{text-transform:uppercase;letter-spacing:.08em;font-size:.78rem;font-weight:800}.it-actions{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.5rem}.it-button{display:inline-block;padding:.8rem 1rem;border-radius:999px;background:var(--it-ink);color:#fff;text-decoration:none;font-weight:700}.it-button--quiet{background:transparent;color:var(--it-ink);border:1px solid var(--it-ink)}.it-section{padding:3.5rem 0}.it-section--ink{background:var(--it-ink);color:#fff}.it-section--ink a{color:#fff}.it-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1rem}.it-card{border:1px solid var(--it-line);border-radius:16px;padding:1.25rem;background:#fff;color:var(--it-ink)}.it-card h2,.it-card h3{margin:.35rem 0 .7rem}.it-card a{color:inherit}.it-question{font-weight:700}.it-note{max-width:800px;margin-top:1.5rem;padding:1rem 1.1rem;border-left:4px solid var(--it-accent);background:#fff;color:var(--it-ink)}.it-meta{display:flex;flex-wrap:wrap;gap:.7rem 1.2rem;font-size:.9rem}.it-prose{max-width:820px}.it-prose li{margin:.55rem 0;line-height:1.55}.it-search{display:grid;gap:.45rem;max-width:650px;margin-top:1.5rem;font-weight:700}.it-search input{font:inherit;padding:.85rem 1rem;border:1px solid var(--it-line);border-radius:10px;background:#fff}.it-muted{opacity:.72}.it-footer{border-top:1px solid var(--it-line);padding:2rem 0;background:var(--it-soft);font-size:.92rem}.it-footer p{max-width:920px}.it-footer a{color:inherit}@media(max-width:760px){.it-nav{align-items:flex-start;flex-direction:column}.it-nav nav{gap:.7rem}.it-hero{padding:3.5rem 0 3rem}}`;
}

validateParity();
await rm(join(OUT, "it"), { recursive: true, force: true });
await mkdir(join(OUT, "it"), { recursive: true });
await writeFile(join(OUT, "it.css"), stylesheet());
await generateHome();
await generateExplorer();
await generateTechniques();
await generateSkills();
await generateAgentSkills();
await generateBiasPages();
await generateMachineData();
await updateSitemap(generatedPaths);
await patchEnglishDiscovery();
console.log(`Generated Italian localization: ${translations.entries.length}/${publishedBiases.length} reviewed bias pages, ${techniques.entries.length} techniques, ${skills.entries.length} Decision Skills, ${agentSkills.entries.length} workflow Agent Skills.`);
