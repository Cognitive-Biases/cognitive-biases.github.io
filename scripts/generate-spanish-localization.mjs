import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadSpanishTranslations } from "./lib/spanish-translations.mjs";
import { loadFrenchTranslations } from "./lib/french-translations.mjs";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const TODAY = "2026-09-13";

const [techniqueTranslations, frenchTechniques, ui, pages, release, canonicalBiasesRaw, canonicalTechniques] = await Promise.all([
  readJson("data/techniques-es.json"),
  readJson("data/techniques-fr.json"),
  readJson("data/ui-es.json"),
  readJson("data/pages-es.json"),
  readJson("data/release.json"),
  readJson("data/biases.json"),
  readJson("data/techniques.json")
]);

const canonicalBiases = Array.isArray(canonicalBiasesRaw) ? canonicalBiasesRaw : canonicalBiasesRaw.biases || [];
const publishedBiases = canonicalBiases.filter((entry) => entry.published);
const translations = await loadSpanishTranslations({ canonicalBiases, releaseVersion: release.releaseVersion, today: TODAY });
const frenchTranslations = await loadFrenchTranslations({ canonicalBiases, releaseVersion: release.releaseVersion, today: TODAY });
if (translations.entries.length !== publishedBiases.length) {
  const localized = new Set(translations.entries.map((entry) => entry.canonicalId));
  const missing = publishedBiases.map((entry) => entry.slug).filter((slug) => !localized.has(slug));
  throw new Error(`Spanish published-bias coverage incomplete: ${translations.entries.length}/${publishedBiases.length}. Missing: ${missing.join(", ") || "none"}`);
}

const biasBySlug = new Map(publishedBiases.map((entry) => [entry.slug, entry]));
const esByCanonical = new Map(translations.entries.map((entry) => [entry.canonicalId, entry]));
const frByCanonical = new Map(frenchTranslations.entries.map((entry) => [entry.canonicalId, entry]));
const techniqueBySlug = new Map(canonicalTechniques.techniques.map((entry) => [entry.slug, entry]));
const esTechniqueByCanonical = new Map(techniqueTranslations.entries.map((entry) => [entry.canonicalSlug, entry]));
const frTechniqueByCanonical = new Map(frenchTechniques.entries.map((entry) => [entry.canonicalSlug, entry]));
const evidenceBySlug = await loadEvidenceReviews();

if (techniqueTranslations.entries.length !== canonicalTechniques.techniques.length) {
  throw new Error(`Spanish technique coverage incomplete: ${techniqueTranslations.entries.length}/${canonicalTechniques.techniques.length}.`);
}
for (const entry of translations.entries) {
  if (!biasBySlug.has(entry.canonicalId)) throw new Error(`Spanish translation points to unknown or unpublished bias: ${entry.canonicalId}`);
}
for (const entry of techniqueTranslations.entries) {
  if (!techniqueBySlug.has(entry.canonicalSlug)) throw new Error(`Spanish technique points to unknown canonical technique: ${entry.canonicalSlug}`);
}

const esc = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);
const jsonLd = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
const normalize = (value = "") => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const metaDescription = (value) => {
  const clean = String(value).replace(/\s+/g, " ").trim();
  if (clean.length <= 155) return clean;
  return `${clean.slice(0, 151).replace(/\s+\S*$/, "").replace(/[,:;–—-]+$/, "")}…`;
};

function spanishBiasPath(entry) { return `/es/sesgos/${entry.localizedSlug}/`; }
function englishBiasPath(entry) { return `/biases/${entry.canonicalId}/`; }
function frenchBiasPath(entry) { return `/fr/biais/${entry.localizedSlug}/`; }
function spanishTechniquePath(entry) { return `/es/tecnicas/${entry.localizedSlug}/`; }
function englishTechniquePath(entry) { return `/techniques/${entry.canonicalSlug}/`; }
function frenchTechniquePath(entry) { return `/fr/techniques/${entry.localizedSlug}/`; }
function url(path) { return `${SITE}${path}`; }

function nav(englishEquivalent = "/", frenchEquivalent = "/fr/") {
  return `<div class="locale-bar" aria-label="Idioma"><span aria-current="page">Español</span><a href="${englishEquivalent}" hreflang="en" lang="en">English</a><a href="${frenchEquivalent}" hreflang="fr" lang="fr">Français</a></div><header class="site-header"><a class="brand" href="/es/"><picture><source srcset="/assets/brand.webp" type="image/webp"><img src="/assets/biases_icon.png" width="48" height="48" alt=""></picture><span>Cognitive<br>Biases</span></a><nav aria-label="Navegación principal"><a href="/es/">${esc(ui.nav.home)}</a><a href="/es/explorar/">${esc(ui.nav.explore)}</a><a href="/es/tecnicas/">${esc(ui.nav.techniques)}</a></nav></header>`;
}
function footer() {
  return `<footer class="site-footer"><div><a class="brand brand--footer" href="/es/"><picture><source srcset="/assets/brand.webp" type="image/webp"><img src="/assets/biases_icon.png" width="40" height="40" alt=""></picture><span>Cognitive Biases</span></a><p>${esc(ui.footer.tagline)}</p></div><div class="footer-links"><a href="/es/explorar/">${esc(ui.nav.explore)}</a><a href="/es/tecnicas/">${esc(ui.nav.techniques)}</a><a href="/explore/" hreflang="en" lang="en">English library</a><a href="/fr/explorer/" hreflang="fr" lang="fr">Bibliothèque française</a><a href="/es/data/index.json">Datos ES</a></div><p class="fine-print">${esc(ui.notices.educational)} ${esc(ui.footer.maintainedBy)}.</p></footer>`;
}
function breadcrumb(items) {
  return `<nav class="fr-breadcrumbs" aria-label="Migas de pan">${items.map((item, index) => item.href ? `<a href="${item.href}">${esc(item.label)}</a>${index < items.length - 1 ? " › " : ""}` : `<span aria-current="page">${esc(item.label)}</span>`).join("")}</nav>`;
}
function page({ title, description, path, englishPath, frenchPath, body, schemas = [] }) {
  const canonical = url(path);
  const english = url(englishPath);
  const french = url(frenchPath);
  const webPage = {
    "@context": "https://schema.org", "@type": "WebPage", "@id": `${canonical}#webpage`,
    name: title, description, url: canonical, inLanguage: "es",
    isPartOf: { "@type": "WebSite", "@id": `${SITE}/#website`, name: "Cognitive Biases", url: `${SITE}/` }
  };
  const schemaScripts = [webPage, ...schemas].map((schema) => `<script type="application/ld+json">${jsonLd(schema)}</script>`).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${esc(title)}</title><meta name="description" content="${esc(metaDescription(description))}"><link rel="canonical" href="${canonical}"><link rel="alternate" hreflang="es" href="${canonical}"><link rel="alternate" hreflang="en" href="${english}"><link rel="alternate" hreflang="fr" href="${french}"><link rel="alternate" hreflang="x-default" href="${english}"><link rel="icon" href="/favicon.png"><meta property="og:locale" content="es_ES"><meta property="og:locale:alternate" content="en_US"><meta property="og:locale:alternate" content="fr_FR"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(metaDescription(description))}"><meta property="og:url" content="${canonical}"><meta property="og:type" content="website"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/es.css">${schemaScripts}</head><body><a class="skip" href="#main">${esc(ui.skipToContent)}</a>${nav(englishPath, frenchPath)}<main id="main">${body}</main>${footer()}</body></html>`;
}
async function emit(path, html) {
  const target = join(OUT, path.replace(/^\//, ""), "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}
function card({ eyebrow, title, text, href, cta }) {
  return `<article class="fr-card"><span class="kicker">${esc(eyebrow)}</span><h3>${esc(title)}</h3><p>${esc(text)}</p><a href="${href}">${esc(cta)} →</a></article>`;
}
function problemLink(problem) {
  const entry = esByCanonical.get(problem.canonicalId);
  if (!entry) return "";
  return `<article class="fr-problem"><p>${esc(problem.question)}</p><a href="${spanishBiasPath(entry)}">${esc(entry.localizedLabel)} →</a></article>`;
}
function localizedTechniqueCard(technique) {
  return card({ eyebrow: ui.labels.technique, title: technique.title, text: technique.whenToUse, href: spanishTechniquePath(technique), cta: ui.actions.openTechnique });
}
function localizedBiasCard(entry) {
  return card({ eyebrow: ui.labels.bias, title: entry.localizedLabel, text: entry.summary, href: spanishBiasPath(entry), cta: ui.actions.readEntry });
}

const reviewedEvidenceCount = translations.entries.filter((entry) => evidenceBySlug.has(entry.canonicalId)).length;
const homeJourneyCards = pages.home.journeys.map((journey) => card({ eyebrow: "Ruta", title: journey.title, text: journey.text, href: journey.href, cta: journey.cta })).join("");
const homeProblemCards = pages.home.problems.map(problemLink).join("");
const homeTechniqueCards = techniqueTranslations.entries.slice(0, 3).map(localizedTechniqueCard).join("");
const homeBody = `<section class="page-hero"><div class="fr-hero-grid"><div><p class="eyebrow">${esc(pages.home.eyebrow)}</p><h1>${esc(pages.home.title)}</h1><p class="lede">${esc(pages.home.lede)}</p><p><a class="button" href="/es/explorar/">${esc(ui.actions.browseBiases)}</a> <a class="button button--dark" href="/es/tecnicas/">${esc(ui.actions.browseTechniques)}</a></p></div><aside class="fr-note"><strong>Cobertura completa en español</strong><p>${translations.entries.length} fichas publicadas en español. ${reviewedEvidenceCount} tienen actualmente una revisión canónica de evidencia dedicada; las demás muestran de forma explícita esa limitación.</p></aside></div></section><section class="section"><p class="kicker">Utilidad</p><h2>${esc(pages.home.whyTitle)}</h2><p class="lede">${esc(pages.home.whyText)}</p></section><section class="section"><p class="kicker">¿Por dónde empezar?</p><h2>${esc(pages.home.startTitle)}</h2><div class="fr-card-grid">${homeJourneyCards}</div></section><section class="section section--ink" id="problemas"><p class="kicker">Primero la situación</p><h2>${esc(pages.home.problemTitle)}</h2><div class="fr-problem-grid">${homeProblemCards}</div></section><section class="section"><p class="kicker">Técnicas</p><h2>Tres formas de cambiar el proceso, no solo el vocabulario.</h2><div class="fr-card-grid">${homeTechniqueCards}</div><p><a class="button button--dark" href="/es/tecnicas/">${esc(ui.actions.browseTechniques)}</a></p></section><section class="section"><p class="kicker">Evidencia</p><h2>${esc(pages.home.evidenceTitle)}</h2><p class="lede">${esc(pages.home.evidenceText)}</p><p><a href="/evidence/" hreflang="en" lang="en">Evidence reviews (English) →</a></p></section>`;
await emit("/es/", page({
  title: "Sesgos cognitivos: entender, comprobar y actuar | Cognitive Biases",
  description: "Biblioteca completa de sesgos cognitivos en español con definiciones, ejemplos, preguntas prácticas, límites y técnicas de decisión.",
  path: "/es/", englishPath: "/", frenchPath: "/fr/", body: homeBody,
  schemas: [{ "@context": "https://schema.org", "@type": "CollectionPage", "@id": `${SITE}/es/#collection`, name: "Cognitive Biases en español", inLanguage: "es", url: `${SITE}/es/`, numberOfItems: translations.entries.length, about: "Sesgos cognitivos y toma de decisiones" }]
}));

const searchableBiasCards = translations.entries.map((entry) => {
  const searchable = normalize([entry.localizedLabel, entry.englishLabel, ...(entry.aliases || []), ...(entry.searchTerms || []), entry.summary].join(" "));
  return `<article class="fr-card" data-es-result data-search="${esc(searchable)}"><span class="kicker">${esc(ui.labels.bias)}</span><h2>${esc(entry.localizedLabel)}</h2><p class="fr-english-term"><span>${esc(ui.labels.englishTerm)}:</span> <span lang="en">${esc(entry.englishLabel)}</span></p><p>${esc(entry.summary)}</p><a href="${spanishBiasPath(entry)}">${esc(ui.actions.readEntry)} →</a></article>`;
}).join("");
const explorerProblems = pages.home.problems.map(problemLink).join("");
const explorerBody = `${breadcrumb([{ label: ui.nav.home, href: "/es/" }, { label: ui.nav.explore }])}<section class="page-hero"><p class="eyebrow">${esc(pages.explorer.eyebrow)}</p><h1>${esc(pages.explorer.title)}</h1><p class="lede">${esc(pages.explorer.lede)}</p></section><section class="section"><div class="fr-search-panel"><label for="es-bias-search"><strong>${esc(ui.search.label)}</strong></label><input class="fr-search" id="es-bias-search" type="search" autocomplete="off" placeholder="${esc(ui.search.placeholder)}" aria-describedby="es-search-status"><p id="es-search-status" class="fr-results-status" aria-live="polite"></p></div><div class="fr-card-grid" id="es-results">${searchableBiasCards}</div><div id="es-search-empty" class="fr-locale-note fr-hidden"><p>${esc(ui.search.empty)}</p></div></section><section class="section section--ink" id="problemas"><p class="kicker">Descubrir por problema</p><h2>${esc(pages.explorer.problemTitle)}</h2><div class="fr-problem-grid">${explorerProblems}</div></section><section class="section"><p class="kicker">Cobertura</p><h2>${esc(pages.explorer.coverageTitle)}</h2><p class="lede">${esc(pages.explorer.coverageText)}</p></section><script>(()=>{const input=document.getElementById('es-bias-search');const cards=[...document.querySelectorAll('[data-es-result]')];const empty=document.getElementById('es-search-empty');const status=document.getElementById('es-search-status');const norm=(v)=>v.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().trim();const render=()=>{const q=norm(input.value);let visible=0;for(const card of cards){const match=!q||card.dataset.search.includes(q);card.classList.toggle('fr-hidden',!match);if(match)visible++;}empty.classList.toggle('fr-hidden',visible!==0);status.textContent=visible+' '+(visible===1?'${esc(ui.search.countSingular)}':'${esc(ui.search.countPlural)}');};input.addEventListener('input',render);render();})();</script>`;
await emit("/es/explorar/", page({
  title: "Sesgos cognitivos en español: biblioteca completa | Cognitive Biases",
  description: `Explora ${translations.entries.length} sesgos cognitivos en español por nombre, término inglés o situación, con definiciones, ejemplos y límites.`,
  path: "/es/explorar/", englishPath: "/explore/", frenchPath: "/fr/explorer/", body: explorerBody,
  schemas: [{ "@context": "https://schema.org", "@type": "CollectionPage", "@id": `${SITE}/es/explorar/#collection`, name: "Sesgos cognitivos en español", inLanguage: "es", url: `${SITE}/es/explorar/`, numberOfItems: translations.entries.length }]
}));

const techniqueHubCards = techniqueTranslations.entries.map(localizedTechniqueCard).join("");
const techniqueHubBody = `${breadcrumb([{ label: ui.nav.home, href: "/es/" }, { label: ui.nav.techniques }])}<section class="page-hero"><p class="eyebrow">${esc(pages.techniques.eyebrow)}</p><h1>${esc(pages.techniques.title)}</h1><p class="lede">${esc(pages.techniques.lede)}</p></section><section class="section"><div class="fr-card-grid">${techniqueHubCards}</div></section><section class="section section--ink"><p class="kicker">Límite</p><h2>${esc(pages.techniques.boundaryTitle)}</h2><p class="lede">${esc(pages.techniques.boundaryText)}</p></section>`;
await emit("/es/tecnicas/", page({
  title: "Técnicas de decisión en español | Cognitive Biases",
  description: "Procedimientos prácticos en español para contrastar hipótesis, estimar, usar tasas base, revisar decisiones y comprobar fuentes.",
  path: "/es/tecnicas/", englishPath: "/techniques/", frenchPath: "/fr/techniques/", body: techniqueHubBody,
  schemas: [{ "@context": "https://schema.org", "@type": "CollectionPage", "@id": `${SITE}/es/tecnicas/#collection`, name: "Técnicas de decisión en español", inLanguage: "es", url: `${SITE}/es/tecnicas/`, numberOfItems: techniqueTranslations.entries.length }]
}));

for (const entry of translations.entries) {
  const review = evidenceBySlug.get(entry.canonicalId);
  const route = spanishBiasPath(entry);
  const englishRoute = englishBiasPath(entry);
  const frenchEntry = frByCanonical.get(entry.canonicalId);
  if (!frenchEntry) throw new Error(`Spanish bias has no French equivalent for hreflang: ${entry.canonicalId}`);
  const frenchRoute = frenchBiasPath(frenchEntry);
  const techniqueCards = entry.techniqueSlugs.map((slug) => esTechniqueByCanonical.get(slug)).filter(Boolean).map(localizedTechniqueCard).join("");
  const examples = entry.examples.length ? entry.examples : ["Usa esta ficha como una pregunta de control: identifica un caso concreto en el que el mecanismo podría cambiar tu juicio y comprueba los hechos antes de concluir."];
  const entitySchema = {
    "@context": "https://schema.org", "@type": "DefinedTerm", "@id": `${url(route)}#term`,
    identifier: entry.canonicalId, name: entry.localizedLabel,
    alternateName: [...new Set([entry.englishLabel, ...(entry.aliases || [])])],
    description: entry.summary, inLanguage: "es", url: url(route), sameAs: url(englishRoute),
    inDefinedTermSet: { "@type": "DefinedTermSet", name: "Cognitive Biases", url: `${SITE}/explore/` }
  };
  const schemas = [entitySchema];
  let evidenceSection;
  if (review) {
    const sources = review.sources.map((source) => `<li><a href="${esc(source.url)}" rel="external noreferrer">${esc(source.title)}</a><span> ${esc(source.type)} · ${esc(source.year)}${source.doi ? ` · DOI ${esc(source.doi)}` : ""}</span></li>`).join("");
    schemas.push({
      "@context": "https://schema.org", "@type": "Article", "@id": `${url(route)}#evidence-review`,
      headline: `${entry.localizedLabel} — síntesis de evidencia`, dateModified: review.reviewedAt, inLanguage: "es",
      mainEntityOfPage: url(route), about: { "@id": `${url(route)}#term` }, citation: review.sources.map((source) => source.url)
    });
    const evidenceText = entry.evidenceSummary || "Existe una revisión canónica de evidencia para esta entrada. Mantén su estado, fuentes y límites; una localización lingüística no cambia la fuerza de la evidencia.";
    evidenceSection = `<section class="section"><p class="kicker">${esc(ui.labels.evidence)}</p><h2>Qué permite decir la revisión canónica.</h2><p class="fr-evidence-state">Estado canónico: <span lang="en">${esc(review.evidenceStatus)}</span></p><p class="lede">${esc(evidenceText)}</p><h3>Fuentes revisadas</h3><ol class="evidence-sources">${sources}</ol><p class="evidence-reviewed">Revisión editorial canónica: ${esc(review.reviewedAt)}. Los títulos de las fuentes se mantienen en su idioma original.</p></section>`;
  } else {
    evidenceSection = `<section class="section"><p class="kicker">${esc(ui.labels.evidence)}</p><h2>Evidencia: todavía no hay una revisión dedicada.</h2><div class="fr-locale-note"><strong>Traducción revisada ≠ evidencia científica revisada.</strong><p>Esta página localiza la definición canónica actual. Todavía no hay una revisión de evidencia dedicada enlazada con esta entrada; no uses el concepto como diagnóstico ni como explicación cierta de un caso individual.</p></div><p><a href="${englishRoute}" hreflang="en" lang="en">Consultar la ficha canónica en inglés →</a></p></section>`;
  }
  const actionSection = techniqueCards
    ? `<section class="section section--ink"><p class="kicker">${esc(ui.labels.whatToDo)}</p><h2>Cambia algo en el proceso.</h2><div class="fr-card-grid">${techniqueCards}</div></section>`
    : `<section class="section section--ink"><p class="kicker">${esc(ui.labels.whatToDo)}</p><h2>Empieza con una pregunta de control.</h2><p class="lede">${esc(entry.practicalQuestion)}</p><p><a href="/es/tecnicas/">Ver las técnicas de decisión →</a></p></section>`;
  const body = `${breadcrumb([{ label: ui.nav.home, href: "/es/" }, { label: ui.nav.explore, href: "/es/explorar/" }, { label: entry.localizedLabel }])}<section class="page-hero"><p class="eyebrow">Traducción española revisada</p><h1>${esc(entry.localizedLabel)}</h1><p class="fr-english-term">${esc(ui.labels.englishTerm)}: <span lang="en">${esc(entry.englishLabel)}</span></p><p class="lede">${esc(entry.summary)}</p><ul class="fr-meta"><li>ID: <code>${esc(entry.canonicalId)}</code></li><li>Revisión lingüística ES: ${esc(entry.reviewedAt)}</li><li>Release fuente: ${esc(entry.sourceRelease)}</li></ul></section><section class="section"><p class="kicker">${esc(ui.labels.inBrief)}</p><h2>${esc(entry.practicalQuestion)}</h2><p class="lede">${esc(entry.summary)}</p></section><section class="section"><p class="kicker">${esc(ui.labels.whereItShows)}</p><h2>Ejemplos para reconocer el mecanismo sin sobrediagnosticarlo.</h2><ul>${examples.map((example) => `<li>${esc(example)}</li>`).join("")}</ul></section>${actionSection}${evidenceSection}<section class="section"><p class="kicker">${esc(ui.labels.limits)}</p><h2>Mantén visible la frontera del concepto.</h2><p class="lede fr-boundary">${esc(entry.boundary)}</p></section><section class="section"><p class="kicker">${esc(ui.labels.canonicalEnglish)}</p><p><a href="${englishRoute}" hreflang="en" lang="en">${esc(ui.actions.englishVersion)} →</a></p></section>`;
  await emit(route, page({
    title: `${entry.localizedLabel}: definición, ejemplo y límites | Cognitive Biases`,
    description: `${entry.summary} Ejemplo, pregunta práctica y límites en español.`,
    path: route, englishPath: englishRoute, frenchPath: frenchRoute, body, schemas
  }));
}

for (const technique of techniqueTranslations.entries) {
  const canonical = techniqueBySlug.get(technique.canonicalSlug);
  const route = spanishTechniquePath(technique);
  const englishRoute = englishTechniquePath(technique);
  const frenchTechnique = frTechniqueByCanonical.get(technique.canonicalSlug);
  if (!frenchTechnique) throw new Error(`Spanish technique has no French equivalent: ${technique.canonicalSlug}`);
  const frenchRoute = frenchTechniquePath(frenchTechnique);
  const related = canonical.biases.map((slug) => esByCanonical.get(slug)).filter(Boolean).map(localizedBiasCard).join("");
  const howToSchema = {
    "@context": "https://schema.org", "@type": "HowTo", "@id": `${url(route)}#howto`, name: technique.title,
    description: technique.whenToUse, inLanguage: "es", url: url(route), sameAs: url(englishRoute),
    step: technique.steps.map((text, index) => ({ "@type": "HowToStep", position: index + 1, text }))
  };
  const body = `${breadcrumb([{ label: ui.nav.home, href: "/es/" }, { label: ui.nav.techniques, href: "/es/tecnicas/" }, { label: technique.title }])}<section class="page-hero"><p class="eyebrow">${esc(ui.labels.technique)}</p><h1>${esc(technique.title)}</h1><p class="lede">${esc(technique.whenToUse)}</p><div class="fr-locale-note"><strong>${esc(ui.notices.techniqueBoundary)}</strong></div></section><section class="section"><p class="kicker">${esc(ui.labels.whenToUse)}</p><h2>Úsala para un problema concreto.</h2><p class="lede">${esc(technique.whenToUse)}</p></section><section class="section section--ink"><p class="kicker">${esc(ui.labels.tryThis)}</p><h2>Procedimiento</h2><ol class="fr-steps">${technique.steps.map((step) => `<li>${esc(step)}</li>`).join("")}</ol></section><section class="section"><p class="kicker">${esc(ui.labels.example)}</p><h2>Cómo puede verse en la práctica.</h2><p class="lede">${esc(technique.example)}</p></section><section class="section"><p class="kicker">${esc(ui.labels.whyItCanHelp)}</p><h2>El mecanismo que intenta mejorar.</h2><p class="lede">${esc(technique.whyItCanHelp)}</p></section><section class="section section--ink"><p class="kicker">Límites</p><h2>Lo que esta técnica no garantiza.</h2><p class="lede">${esc(technique.limitations)}</p></section>${related ? `<section class="section"><p class="kicker">${esc(ui.labels.relatedBiases)}</p><h2>Sesgos que pueden servir como lentes de revisión.</h2><div class="fr-card-grid">${related}</div></section>` : ""}<section class="section"><p><a href="${englishRoute}" hreflang="en" lang="en">${esc(ui.actions.englishVersion)} →</a></p></section>`;
  await emit(route, page({
    title: `${technique.title}: técnica de decisión | Cognitive Biases`,
    description: `${technique.whenToUse} Pasos, ejemplo, mecanismo y límites en español.`,
    path: route, englishPath: englishRoute, frenchPath: frenchRoute, body, schemas: [howToSchema]
  }));
}

const localizedPairs = [
  { englishPath: "/", frenchPath: "/fr/", spanishPath: "/es/" },
  { englishPath: "/explore/", frenchPath: "/fr/explorer/", spanishPath: "/es/explorar/" },
  { englishPath: "/techniques/", frenchPath: "/fr/techniques/", spanishPath: "/es/tecnicas/" },
  ...translations.entries.map((entry) => ({ englishPath: englishBiasPath(entry), frenchPath: frenchBiasPath(frByCanonical.get(entry.canonicalId)), spanishPath: spanishBiasPath(entry) })),
  ...techniqueTranslations.entries.map((entry) => ({ englishPath: englishTechniquePath(entry), frenchPath: frenchTechniquePath(frTechniqueByCanonical.get(entry.canonicalSlug)), spanishPath: spanishTechniquePath(entry) }))
];
for (const pair of localizedPairs) {
  await addEnglishReciprocalLocale(pair.englishPath, pair.spanishPath);
  await addFrenchReciprocalLocale(pair.frenchPath, pair.spanishPath);
}
await writeSpanishMachineSurfaces();
await updateSitemap(localizedPairs.map((pair) => pair.spanishPath));

console.log(`Generated Spanish localization: ${translations.entries.length}/${publishedBiases.length} published bias pages, ${techniqueTranslations.entries.length} techniques, home and explorer.`);

async function readJson(path) { return JSON.parse(await readFile(path, "utf8")); }
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
async function addEnglishReciprocalLocale(englishPath, spanishPath) {
  const target = englishPath === "/" ? join(OUT, "index.html") : join(OUT, englishPath.replace(/^\//, ""), "index.html");
  let html;
  try { html = await readFile(target, "utf8"); } catch { throw new Error(`English equivalent missing for Spanish localization: ${englishPath}`); }
  const englishUrl = url(englishPath);
  const spanishUrl = url(spanishPath);
  if (!html.includes('hreflang="es"')) html = html.replace("</head>", `<link rel="alternate" hreflang="es" href="${spanishUrl}"></head>`);
  if (!html.includes('hreflang="en"')) html = html.replace("</head>", `<link rel="alternate" hreflang="en" href="${englishUrl}"></head>`);
  if (!html.includes('hreflang="x-default"')) html = html.replace("</head>", `<link rel="alternate" hreflang="x-default" href="${englishUrl}"></head>`);
  if (!html.includes(`href="${spanishPath}"`)) {
    const link = `<a data-locale-switch="es" href="${spanishPath}" hreflang="es" lang="es">Español</a>`;
    if (html.includes('class="locale-switch-bar"')) html = html.replace(/(<div class="locale-switch-bar"[^>]*>[\s\S]*?)(<\/div>)/, `$1${link}$2`);
    else html = html.replace(/<body([^>]*)>/, `<body$1><div class="locale-switch-bar" aria-label="Language"><span aria-current="page">English</span>${link}</div>`);
  }
  await writeFile(target, html);
}
async function addFrenchReciprocalLocale(frenchPath, spanishPath) {
  const target = frenchPath === "/fr/" ? join(OUT, "fr", "index.html") : join(OUT, frenchPath.replace(/^\//, ""), "index.html");
  let html;
  try { html = await readFile(target, "utf8"); } catch { throw new Error(`French equivalent missing for Spanish localization: ${frenchPath}`); }
  const spanishUrl = url(spanishPath);
  if (!html.includes(`hreflang="es" href="${spanishUrl}"`)) html = html.replace("</head>", `<link rel="alternate" hreflang="es" href="${spanishUrl}"></head>`);
  if (!html.includes(`href="${spanishPath}"`)) {
    const link = `<a data-locale-switch="es" href="${spanishPath}" hreflang="es" lang="es">Español</a>`;
    if (html.includes('class="locale-bar"')) html = html.replace(/(<div class="locale-bar"[^>]*>[\s\S]*?)(<\/div>)/, `$1${link}$2`);
    else html = html.replace(/<body([^>]*)>/, `<body$1><div class="locale-switch-bar" aria-label="Langue"><span aria-current="page">Français</span>${link}</div>`);
  }
  await writeFile(target, html);
}
async function writeSpanishMachineSurfaces() {
  await mkdir(join(OUT, "data"), { recursive: true });
  await mkdir(join(OUT, "ai"), { recursive: true });
  await mkdir(join(OUT, "es", "data"), { recursive: true });
  await writeFile(join(OUT, "data", "locales.json"), await readFile("data/locales.json", "utf8"));
  await writeFile(join(OUT, "data", "translations-es.json"), JSON.stringify(translations, null, 2) + "\n");
  await writeFile(join(OUT, "data", "techniques-es.json"), await readFile("data/techniques-es.json", "utf8"));
  await writeFile(join(OUT, "data", "ui-es.json"), await readFile("data/ui-es.json", "utf8"));
  await writeFile(join(OUT, "ai", "locales.json"), await readFile("ai/locales.json", "utf8"));
  await writeFile(join(OUT, "es", "llms.txt"), await readFile("ai/llms.es.txt", "utf8"));
  const manifest = {
    version: 2, locale: "es", canonicalLocale: "en", status: "reviewed-layer", sourceRelease: release.releaseVersion,
    generatedAt: TODAY, canonicalSite: `${SITE}/`, localizedSite: `${SITE}/es/`,
    coverage: { concepts: translations.entries.length, canonicalPublishedConcepts: publishedBiases.length, evidenceReviewedConcepts: reviewedEvidenceCount, techniques: techniqueTranslations.entries.length, fallback: "none-for-published-biases" },
    semantics: { canonicalIdentifiersRemainEnglish: true, evidenceStatusRemainsCanonical: true, translationReviewSeparateFromEvidenceReview: true, sourceTitlesRemainOriginal: true, translateJsonFieldNames: false },
    datasets: { localeRegistry: `${SITE}/data/locales.json`, concepts: `${SITE}/data/translations-es.json`, techniques: `${SITE}/data/techniques-es.json`, canonicalBiases: `${SITE}/data/biases.json`, canonicalTechniques: `${SITE}/data/techniques.json` },
    agentRouting: `${SITE}/es/llms.txt`, localeRegistry: `${SITE}/ai/locales.json`
  };
  await writeFile(join(OUT, "es", "data", "index.json"), JSON.stringify(manifest, null, 2) + "\n");
}
async function updateSitemap(paths) {
  const sitemapPath = join(OUT, "sitemap.xml");
  let sitemap = await readFile(sitemapPath, "utf8");
  for (const path of paths) {
    const loc = url(path);
    if (!sitemap.includes(`<loc>${loc}</loc>`)) sitemap = sitemap.replace("</urlset>", `<url><loc>${loc}</loc></url></urlset>`);
  }
  await writeFile(sitemapPath, sitemap);
}
