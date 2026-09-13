import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadFrenchTranslations } from "./lib/french-translations.mjs";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const TODAY = "2026-09-13";

const [techniqueTranslations, ui, pages, release, canonicalBiasesRaw, canonicalTechniques] = await Promise.all([
  readJson("data/techniques-fr.json"),
  readJson("data/ui-fr.json"),
  readJson("data/pages-fr.json"),
  readJson("data/release.json"),
  readJson("data/biases.json"),
  readJson("data/techniques.json")
]);

const canonicalBiases = Array.isArray(canonicalBiasesRaw) ? canonicalBiasesRaw : canonicalBiasesRaw.biases || [];
const publishedBiases = canonicalBiases.filter((entry) => entry.published);
const translations = await loadFrenchTranslations({ canonicalBiases, releaseVersion: release.releaseVersion, today: TODAY });
const biasBySlug = new Map(publishedBiases.map((entry) => [entry.slug, entry]));
const frByCanonical = new Map(translations.entries.map((entry) => [entry.canonicalId, entry]));
const techniqueBySlug = new Map(canonicalTechniques.techniques.map((entry) => [entry.slug, entry]));
const frTechniqueByCanonical = new Map(techniqueTranslations.entries.map((entry) => [entry.canonicalSlug, entry]));
const evidenceBySlug = await loadEvidenceReviews();

for (const entry of translations.entries) {
  if (!biasBySlug.has(entry.canonicalId)) throw new Error(`French translation points to unknown or unpublished bias: ${entry.canonicalId}`);
}
for (const entry of techniqueTranslations.entries) {
  if (!techniqueBySlug.has(entry.canonicalSlug)) throw new Error(`French technique points to unknown canonical technique: ${entry.canonicalSlug}`);
}

const esc = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);
const jsonLd = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
const normalize = (value = "") => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const metaDescription = (value) => String(value).replace(/\s+/g, " ").trim().slice(0, 154).replace(/\s+\S*$/, "").replace(/[,:;–—-]+$/, "") + ".";

function frenchBiasPath(entry) { return `/fr/biais/${entry.localizedSlug}/`; }
function englishBiasPath(entry) { return `/biases/${entry.canonicalId}/`; }
function frenchTechniquePath(entry) { return `/fr/techniques/${entry.localizedSlug}/`; }
function englishTechniquePath(entry) { return `/techniques/${entry.canonicalSlug}/`; }
function url(path) { return `${SITE}${path}`; }

function nav(englishEquivalent = "/") {
  return `<div class="locale-bar" aria-label="Choix de la langue"><span aria-current="page">Français</span><a href="${englishEquivalent}" hreflang="en" lang="en">English</a></div><header class="site-header"><a class="brand" href="/fr/"><picture><source srcset="/assets/brand.webp" type="image/webp"><img src="/assets/biases_icon.png" width="48" height="48" alt=""></picture><span>Cognitive<br>Biases</span></a><nav aria-label="Navigation principale"><a href="/fr/">${esc(ui.nav.home)}</a><a href="/fr/explorer/">${esc(ui.nav.explore)}</a><a href="/fr/techniques/">${esc(ui.nav.techniques)}</a></nav></header>`;
}
function footer() {
  return `<footer class="site-footer"><div><a class="brand brand--footer" href="/fr/"><picture><source srcset="/assets/brand.webp" type="image/webp"><img src="/assets/biases_icon.png" width="40" height="40" alt=""></picture><span>Cognitive Biases</span></a><p>${esc(ui.footer.tagline)}</p></div><div class="footer-links"><a href="/fr/explorer/">${esc(ui.nav.explore)}</a><a href="/fr/techniques/">${esc(ui.nav.techniques)}</a><a href="/explore/" hreflang="en" lang="en">English library</a><a href="/fr/data/index.json">Données FR</a></div><p class="fine-print">${esc(ui.notices.educational)} ${esc(ui.footer.maintainedBy)}.</p></footer>`;
}
function breadcrumb(items) {
  return `<nav class="fr-breadcrumbs" aria-label="Fil d'Ariane">${items.map((item, index) => item.href ? `<a href="${item.href}">${esc(item.label)}</a>${index < items.length - 1 ? " › " : ""}` : `<span aria-current="page">${esc(item.label)}</span>`).join("")}</nav>`;
}
function page({ title, description, path, englishPath, body, schemas = [] }) {
  const canonical = url(path);
  const english = url(englishPath);
  const webPage = {
    "@context": "https://schema.org", "@type": "WebPage", "@id": `${canonical}#webpage`,
    name: title, description, url: canonical, inLanguage: "fr",
    isPartOf: { "@type": "WebSite", "@id": `${SITE}/#website`, name: "Cognitive Biases", url: `${SITE}/` }
  };
  const schemaScripts = [webPage, ...schemas].map((schema) => `<script type="application/ld+json">${jsonLd(schema)}</script>`).join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${esc(title)}</title><meta name="description" content="${esc(metaDescription(description))}"><link rel="canonical" href="${canonical}"><link rel="alternate" hreflang="fr" href="${canonical}"><link rel="alternate" hreflang="en" href="${english}"><link rel="alternate" hreflang="x-default" href="${english}"><link rel="icon" href="/favicon.png"><meta property="og:locale" content="fr_FR"><meta property="og:locale:alternate" content="en_US"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(metaDescription(description))}"><meta property="og:url" content="${canonical}"><meta property="og:type" content="website"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/fr.css">${schemaScripts}</head><body><a class="skip" href="#main">${esc(ui.skipToContent)}</a>${nav(englishPath)}<main id="main">${body}</main>${footer()}</body></html>`;
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
  const entry = frByCanonical.get(problem.canonicalId);
  if (!entry) return "";
  return `<article class="fr-problem"><p>${esc(problem.question)}</p><a href="${frenchBiasPath(entry)}">${esc(entry.localizedLabel)} →</a></article>`;
}
function localizedTechniqueCard(technique) {
  return card({ eyebrow: ui.labels.technique, title: technique.title, text: technique.whenToUse, href: frenchTechniquePath(technique), cta: ui.actions.openTechnique });
}
function localizedBiasCard(entry) {
  return card({ eyebrow: ui.labels.bias, title: entry.localizedLabel, text: entry.summary, href: frenchBiasPath(entry), cta: ui.actions.readEntry });
}

const reviewedEvidenceCount = translations.entries.filter((entry) => evidenceBySlug.has(entry.canonicalId)).length;
const homeJourneyCards = pages.home.journeys.map((journey) => card({ eyebrow: "Parcours", title: journey.title, text: journey.text, href: journey.href, cta: journey.cta })).join("");
const homeProblemCards = pages.home.problems.map(problemLink).join("");
const homeTechniqueCards = techniqueTranslations.entries.slice(0, 3).map(localizedTechniqueCard).join("");
const homeBody = `<section class="page-hero"><div class="fr-hero-grid"><div><p class="eyebrow">${esc(pages.home.eyebrow)}</p><h1>${esc(pages.home.title)}</h1><p class="lede">${esc(pages.home.lede)}</p><p><a class="button" href="/fr/explorer/">${esc(ui.actions.browseBiases)}</a> <a class="button button--dark" href="/fr/techniques/">${esc(ui.actions.browseTechniques)}</a></p></div><aside class="fr-note"><strong>Couverture française complète</strong><p>${translations.entries.length} fiches publiées en français. ${reviewedEvidenceCount} disposent actuellement d'une revue de preuves canonique dédiée ; les autres affichent explicitement cette limite.</p></aside></div></section><section class="section"><p class="kicker">Utilité</p><h2>${esc(pages.home.whyTitle)}</h2><p class="lede">${esc(pages.home.whyText)}</p></section><section class="section"><p class="kicker">Par où commencer ?</p><h2>${esc(pages.home.startTitle)}</h2><div class="fr-card-grid">${homeJourneyCards}</div></section><section class="section section--ink" id="problemes"><p class="kicker">Situation d'abord</p><h2>${esc(pages.home.problemTitle)}</h2><div class="fr-problem-grid">${homeProblemCards}</div></section><section class="section"><p class="kicker">Techniques</p><h2>Trois façons de changer le processus, pas seulement le vocabulaire.</h2><div class="fr-card-grid">${homeTechniqueCards}</div><p><a class="button button--dark" href="/fr/techniques/">${esc(ui.actions.browseTechniques)}</a></p></section><section class="section"><p class="kicker">Preuves</p><h2>${esc(pages.home.evidenceTitle)}</h2><p class="lede">${esc(pages.home.evidenceText)}</p><p><a href="/evidence/" hreflang="en" lang="en">Evidence reviews (English) →</a></p></section>`;
await emit("/fr/", page({
  title: "Biais cognitifs : comprendre, vérifier, agir | Cognitive Biases",
  description: "Bibliothèque complète des biais cognitifs en français, avec définitions, exemples, questions pratiques, limites et techniques de décision.",
  path: "/fr/", englishPath: "/", body: homeBody,
  schemas: [{ "@context": "https://schema.org", "@type": "CollectionPage", "@id": `${SITE}/fr/#collection`, name: "Cognitive Biases en français", inLanguage: "fr", url: `${SITE}/fr/`, numberOfItems: translations.entries.length, about: "Biais cognitifs et prise de décision" }]
}));

const searchableBiasCards = translations.entries.map((entry) => {
  const searchable = normalize([entry.localizedLabel, entry.englishLabel, ...(entry.aliases || []), ...(entry.searchTerms || []), entry.summary].join(" "));
  return `<article class="fr-card" data-fr-result data-search="${esc(searchable)}"><span class="kicker">${esc(ui.labels.bias)}</span><h2>${esc(entry.localizedLabel)}</h2><p class="fr-english-term"><span>${esc(ui.labels.englishTerm)} :</span> <span lang="en">${esc(entry.englishLabel)}</span></p><p>${esc(entry.summary)}</p><a href="${frenchBiasPath(entry)}">${esc(ui.actions.readEntry)} →</a></article>`;
}).join("");
const explorerProblems = pages.home.problems.map(problemLink).join("");
const explorerBody = `${breadcrumb([{ label: ui.nav.home, href: "/fr/" }, { label: ui.nav.explore }])}<section class="page-hero"><p class="eyebrow">${esc(pages.explorer.eyebrow)}</p><h1>${esc(pages.explorer.title)}</h1><p class="lede">${esc(pages.explorer.lede)}</p></section><section class="section"><div class="fr-search-panel"><label for="fr-bias-search"><strong>${esc(ui.search.label)}</strong></label><input class="fr-search" id="fr-bias-search" type="search" autocomplete="off" placeholder="${esc(ui.search.placeholder)}" aria-describedby="fr-search-status"><p id="fr-search-status" class="fr-results-status" aria-live="polite"></p></div><div class="fr-card-grid" id="fr-results">${searchableBiasCards}</div><div id="fr-search-empty" class="fr-locale-note fr-hidden"><p>${esc(ui.search.empty)}</p></div></section><section class="section section--ink" id="problemes"><p class="kicker">Découverte par problème</p><h2>${esc(pages.explorer.problemTitle)}</h2><div class="fr-problem-grid">${explorerProblems}</div></section><section class="section"><p class="kicker">Couverture</p><h2>${esc(pages.explorer.coverageTitle)}</h2><p class="lede">${esc(pages.explorer.coverageText)}</p></section><script>(()=>{const input=document.getElementById('fr-bias-search');const cards=[...document.querySelectorAll('[data-fr-result]')];const empty=document.getElementById('fr-search-empty');const status=document.getElementById('fr-search-status');const norm=(v)=>v.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().trim();const render=()=>{const q=norm(input.value);let visible=0;for(const card of cards){const match=!q||card.dataset.search.includes(q);card.classList.toggle('fr-hidden',!match);if(match)visible++;}empty.classList.toggle('fr-hidden',visible!==0);status.textContent=visible+' '+(visible===1?'${esc(ui.search.countSingular)}':'${esc(ui.search.countPlural)}');};input.addEventListener('input',render);render();})();</script>`;
await emit("/fr/explorer/", page({
  title: "Biais cognitifs en français : bibliothèque complète | Cognitive Biases",
  description: `Explorez ${translations.entries.length} biais cognitifs en français par nom, terme anglais ou situation, avec définitions, exemples et limites.`,
  path: "/fr/explorer/", englishPath: "/explore/", body: explorerBody,
  schemas: [{ "@context": "https://schema.org", "@type": "CollectionPage", "@id": `${SITE}/fr/explorer/#collection`, name: "Biais cognitifs en français", inLanguage: "fr", url: `${SITE}/fr/explorer/`, numberOfItems: translations.entries.length }]
}));

const techniqueHubCards = techniqueTranslations.entries.map(localizedTechniqueCard).join("");
const techniqueHubBody = `${breadcrumb([{ label: ui.nav.home, href: "/fr/" }, { label: ui.nav.techniques }])}<section class="page-hero"><p class="eyebrow">${esc(pages.techniques.eyebrow)}</p><h1>${esc(pages.techniques.title)}</h1><p class="lede">${esc(pages.techniques.lede)}</p></section><section class="section"><div class="fr-card-grid">${techniqueHubCards}</div></section><section class="section section--ink"><p class="kicker">Limite</p><h2>${esc(pages.techniques.boundaryTitle)}</h2><p class="lede">${esc(pages.techniques.boundaryText)}</p></section>`;
await emit("/fr/techniques/", page({
  title: "Techniques de décision en français | Cognitive Biases",
  description: "Techniques pratiques pour tester une hypothèse, produire une estimation indépendante, utiliser des taux de base et revoir une décision.",
  path: "/fr/techniques/", englishPath: "/techniques/", body: techniqueHubBody,
  schemas: [{ "@context": "https://schema.org", "@type": "CollectionPage", "@id": `${SITE}/fr/techniques/#collection`, name: "Techniques de décision", inLanguage: "fr", url: `${SITE}/fr/techniques/`, numberOfItems: techniqueTranslations.entries.length }]
}));

for (const entry of translations.entries) {
  const review = evidenceBySlug.get(entry.canonicalId);
  const route = frenchBiasPath(entry);
  const englishRoute = englishBiasPath(entry);
  const techniqueCards = entry.techniqueSlugs.map((slug) => frTechniqueByCanonical.get(slug)).filter(Boolean).map(localizedTechniqueCard).join("");
  const examples = entry.examples.length ? entry.examples : ["Utilisez cette fiche comme une question de contrôle : cherchez un cas concret où le mécanisme pourrait changer votre jugement, puis vérifiez les faits avant de conclure."];
  const entitySchema = {
    "@context": "https://schema.org", "@type": "DefinedTerm", "@id": `${url(route)}#term`,
    identifier: entry.canonicalId, name: entry.localizedLabel,
    alternateName: [...new Set([entry.englishLabel, ...(entry.aliases || [])])],
    description: entry.summary, inLanguage: "fr", url: url(route), sameAs: url(englishRoute),
    inDefinedTermSet: { "@type": "DefinedTermSet", name: "Cognitive Biases", url: `${SITE}/explore/` }
  };
  const schemas = [entitySchema];
  let evidenceSection;
  if (review) {
    const sources = review.sources.map((source) => `<li><a href="${esc(source.url)}" rel="external noreferrer">${esc(source.title)}</a><span> ${esc(source.type)} · ${esc(source.year)}${source.doi ? ` · DOI ${esc(source.doi)}` : ""}</span></li>`).join("");
    schemas.push({
      "@context": "https://schema.org", "@type": "Article", "@id": `${url(route)}#evidence-review`,
      headline: `${entry.localizedLabel} — synthèse des preuves`, dateModified: review.reviewedAt, inLanguage: "fr",
      mainEntityOfPage: url(route), about: { "@id": `${url(route)}#term` }, citation: review.sources.map((source) => source.url)
    });
    evidenceSection = `<section class="section"><p class="kicker">${esc(ui.labels.evidence)}</p><h2>Ce que la revue canonique permet de dire.</h2><p class="fr-evidence-state">Statut canonique : <span lang="en">${esc(review.evidenceStatus)}</span></p><p class="lede">${esc(entry.evidenceSummary || review.summary || "Une revue de preuves canonique est disponible pour cette entrée.")}</p><h3>Sources relues</h3><ol class="evidence-sources">${sources}</ol><p class="evidence-reviewed">Revue éditoriale canonique : ${esc(review.reviewedAt)}. Les titres des sources restent dans leur langue d'origine.</p></section>`;
  } else {
    evidenceSection = `<section class="section"><p class="kicker">${esc(ui.labels.evidence)}</p><h2>Preuves : revue dédiée pas encore disponible.</h2><div class="fr-locale-note"><strong>Traduction relue ≠ preuve scientifique relue.</strong><p>Cette page localise la définition canonique actuelle. Aucune revue de preuves dédiée n'est encore reliée à cette entrée ; évitez donc d'utiliser ce concept comme diagnostic ou comme explication certaine d'un cas individuel.</p></div><p><a href="${englishRoute}" hreflang="en" lang="en">Consulter la fiche canonique en anglais →</a></p></section>`;
  }
  const actionSection = techniqueCards
    ? `<section class="section section--ink"><p class="kicker">${esc(ui.labels.whatToDo)}</p><h2>Changez quelque chose dans le processus.</h2><div class="fr-card-grid">${techniqueCards}</div></section>`
    : `<section class="section section--ink"><p class="kicker">${esc(ui.labels.whatToDo)}</p><h2>Commencez par une question de contrôle.</h2><p class="lede">${esc(entry.practicalQuestion)}</p><p><a href="/fr/techniques/">Voir les techniques de décision →</a></p></section>`;
  const body = `${breadcrumb([{ label: ui.nav.home, href: "/fr/" }, { label: ui.nav.explore, href: "/fr/explorer/" }, { label: entry.localizedLabel }])}<section class="page-hero"><p class="eyebrow">Traduction française relue</p><h1>${esc(entry.localizedLabel)}</h1><p class="fr-english-term">${esc(ui.labels.englishTerm)} : <span lang="en">${esc(entry.englishLabel)}</span></p><p class="lede">${esc(entry.summary)}</p><ul class="fr-meta"><li>ID : <code>${esc(entry.canonicalId)}</code></li><li>Revue linguistique FR : ${esc(entry.reviewedAt)}</li><li>Release source : ${esc(entry.sourceRelease)}</li></ul></section><section class="section"><p class="kicker">${esc(ui.labels.inBrief)}</p><h2>${esc(entry.practicalQuestion)}</h2><p class="lede">${esc(entry.summary)}</p></section><section class="section"><p class="kicker">${esc(ui.labels.whereItShows)}</p><h2>Un exemple pour reconnaître le mécanisme sans le surdiagnostiquer.</h2><ul>${examples.map((example) => `<li>${esc(example)}</li>`).join("")}</ul></section>${actionSection}${evidenceSection}<section class="section"><p class="kicker">${esc(ui.labels.limits)}</p><h2>Gardez la frontière du concept visible.</h2><p class="lede fr-boundary">${esc(entry.boundary)}</p></section><section class="section"><p class="kicker">${esc(ui.labels.canonicalEnglish)}</p><p><a href="${englishRoute}" hreflang="en" lang="en">${esc(ui.actions.englishVersion)} →</a></p></section>`;
  await emit(route, page({
    title: `${entry.localizedLabel} : définition, exemple et limites | Cognitive Biases`,
    description: `${entry.summary} Exemple, question pratique et limites en français.`,
    path: route, englishPath: englishRoute, body, schemas
  }));
}

for (const technique of techniqueTranslations.entries) {
  const canonical = techniqueBySlug.get(technique.canonicalSlug);
  const route = frenchTechniquePath(technique);
  const englishRoute = englishTechniquePath(technique);
  const related = canonical.biases.map((slug) => frByCanonical.get(slug)).filter(Boolean).map(localizedBiasCard).join("");
  const howToSchema = {
    "@context": "https://schema.org", "@type": "HowTo", "@id": `${url(route)}#howto`, name: technique.title,
    description: technique.whenToUse, inLanguage: "fr", url: url(route), sameAs: url(englishRoute),
    step: technique.steps.map((text, index) => ({ "@type": "HowToStep", position: index + 1, text }))
  };
  const body = `${breadcrumb([{ label: ui.nav.home, href: "/fr/" }, { label: ui.nav.techniques, href: "/fr/techniques/" }, { label: technique.title }])}<section class="page-hero"><p class="eyebrow">${esc(ui.labels.technique)}</p><h1>${esc(technique.title)}</h1><p class="lede">${esc(technique.whenToUse)}</p><div class="fr-locale-note"><strong>${esc(ui.notices.techniqueBoundary)}</strong></div></section><section class="section"><p class="kicker">${esc(ui.labels.whenToUse)}</p><h2>Utilisez-la pour un problème précis.</h2><p class="lede">${esc(technique.whenToUse)}</p></section><section class="section section--ink"><p class="kicker">${esc(ui.labels.tryThis)}</p><h2>Procédure</h2><ol class="fr-steps">${technique.steps.map((step) => `<li>${esc(step)}</li>`).join("")}</ol></section><section class="section"><p class="kicker">${esc(ui.labels.example)}</p><h2>À quoi cela peut ressembler.</h2><p class="lede">${esc(technique.example)}</p></section><section class="section"><p class="kicker">${esc(ui.labels.whyItCanHelp)}</p><h2>Le mécanisme visé.</h2><p class="lede">${esc(technique.whyItCanHelp)}</p></section><section class="section section--ink"><p class="kicker">Limites</p><h2>Ce que cette technique ne garantit pas.</h2><p class="lede">${esc(technique.limitations)}</p></section>${related ? `<section class="section"><p class="kicker">${esc(ui.labels.relatedBiases)}</p><h2>Les grilles de lecture reliées à cette technique.</h2><div class="fr-card-grid">${related}</div></section>` : ""}<section class="section"><p><a href="${englishRoute}" hreflang="en" lang="en">${esc(ui.actions.englishVersion)} →</a></p></section>`;
  await emit(route, page({
    title: `${technique.title} : technique de décision | Cognitive Biases`,
    description: `${technique.whenToUse} Étapes, exemple, mécanisme et limites en français.`,
    path: route, englishPath: englishRoute, body, schemas: [howToSchema]
  }));
}

const localizedPairs = [
  { englishPath: "/", frenchPath: "/fr/" },
  { englishPath: "/explore/", frenchPath: "/fr/explorer/" },
  { englishPath: "/techniques/", frenchPath: "/fr/techniques/" },
  ...translations.entries.map((entry) => ({ englishPath: englishBiasPath(entry), frenchPath: frenchBiasPath(entry) })),
  ...techniqueTranslations.entries.map((entry) => ({ englishPath: englishTechniquePath(entry), frenchPath: frenchTechniquePath(entry) }))
];
for (const pair of localizedPairs) await addReciprocalLocale(pair.englishPath, pair.frenchPath);
await appendEnglishLocaleStyles();
await writeFrenchMachineSurfaces();
await updateSitemap(localizedPairs.map((pair) => pair.frenchPath));

console.log(`Generated French localization: ${translations.entries.length}/${publishedBiases.length} published bias pages, ${techniqueTranslations.entries.length} techniques, home and explorer.`);

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
async function addReciprocalLocale(englishPath, frenchPath) {
  const target = englishPath === "/" ? join(OUT, "index.html") : join(OUT, englishPath.replace(/^\//, ""), "index.html");
  let html;
  try { html = await readFile(target, "utf8"); } catch { throw new Error(`English equivalent missing for French localization: ${englishPath}`); }
  const englishUrl = url(englishPath);
  const frenchUrl = url(frenchPath);
  const tags = [
    [`hreflang="en"`, `<link rel="alternate" hreflang="en" href="${englishUrl}">`],
    [`hreflang="fr"`, `<link rel="alternate" hreflang="fr" href="${frenchUrl}">`],
    [`hreflang="x-default"`, `<link rel="alternate" hreflang="x-default" href="${englishUrl}">`]
  ];
  for (const [needle, tag] of tags) if (!html.includes(needle)) html = html.replace("</head>", `${tag}</head>`);
  if (!html.includes('data-locale-switch="fr"')) {
    const switcher = `<div class="locale-switch-bar" data-locale-switch="fr" aria-label="Language"><span aria-current="page">English</span><a href="${frenchPath}" hreflang="fr" lang="fr">Français</a></div>`;
    html = html.replace(/<body([^>]*)>/, `<body$1>${switcher}`);
  }
  await writeFile(target, html);
}
async function appendEnglishLocaleStyles() {
  const path = join(OUT, "styles.css");
  let css = await readFile(path, "utf8");
  if (!css.includes(".locale-switch-bar{")) {
    css += `\n.locale-switch-bar{display:flex;justify-content:flex-end;gap:.65rem;align-items:center;padding:.65rem max(1rem,calc((100vw - 1160px)/2));font-size:.9rem;background:#f5f2ea;border-bottom:1px solid rgba(16,22,34,.12)}.locale-switch-bar a{font-weight:900}.locale-switch-bar [aria-current="page"]{text-decoration:underline;text-underline-offset:.2em}\n`;
    await writeFile(path, css);
  }
}
async function writeFrenchMachineSurfaces() {
  await mkdir(join(OUT, "data"), { recursive: true });
  await mkdir(join(OUT, "ai"), { recursive: true });
  await mkdir(join(OUT, "fr", "data"), { recursive: true });
  await writeFile(join(OUT, "data", "locales.json"), await readFile("data/locales.json", "utf8"));
  await writeFile(join(OUT, "data", "translations-fr.json"), JSON.stringify(translations, null, 2) + "\n");
  await writeFile(join(OUT, "data", "techniques-fr.json"), await readFile("data/techniques-fr.json", "utf8"));
  await writeFile(join(OUT, "data", "ui-fr.json"), await readFile("data/ui-fr.json", "utf8"));
  await writeFile(join(OUT, "ai", "locales.json"), await readFile("ai/locales.json", "utf8"));
  await writeFile(join(OUT, "fr", "llms.txt"), await readFile("ai/llms.fr.txt", "utf8"));
  const manifest = {
    version: 2, locale: "fr", canonicalLocale: "en", status: "reviewed-layer", sourceRelease: release.releaseVersion,
    generatedAt: TODAY, canonicalSite: `${SITE}/`, localizedSite: `${SITE}/fr/`,
    coverage: { concepts: translations.entries.length, canonicalPublishedConcepts: publishedBiases.length, evidenceReviewedConcepts: reviewedEvidenceCount, techniques: techniqueTranslations.entries.length, fallback: "none-for-published-biases" },
    semantics: { canonicalIdentifiersRemainEnglish: true, evidenceStatusRemainsCanonical: true, translationReviewSeparateFromEvidenceReview: true, sourceTitlesRemainOriginal: true, translateJsonFieldNames: false },
    datasets: { localeRegistry: `${SITE}/data/locales.json`, concepts: `${SITE}/data/translations-fr.json`, techniques: `${SITE}/data/techniques-fr.json`, canonicalBiases: `${SITE}/data/biases.json`, canonicalTechniques: `${SITE}/data/techniques.json` },
    agentRouting: `${SITE}/fr/llms.txt`, localeRegistry: `${SITE}/ai/locales.json`
  };
  await writeFile(join(OUT, "fr", "data", "index.json"), JSON.stringify(manifest, null, 2) + "\n");
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
