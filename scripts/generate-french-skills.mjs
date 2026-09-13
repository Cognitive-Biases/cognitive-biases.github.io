import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadFrenchTranslations } from "./lib/french-translations.mjs";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const TODAY = "2026-09-13";

const [canonicalSkillsDoc, localizedSkillsDoc, release, canonicalBiasesRaw] = await Promise.all([
  readJson("data/skills.json"),
  readJson("data/skills-fr.json"),
  readJson("data/release.json"),
  readJson("data/biases.json")
]);

const canonicalSkills = canonicalSkillsDoc.entries || [];
const canonicalBiases = Array.isArray(canonicalBiasesRaw) ? canonicalBiasesRaw : canonicalBiasesRaw.biases || [];
const translations = await loadFrenchTranslations({ canonicalBiases, releaseVersion: release.releaseVersion, today: TODAY });
const frBiasByCanonical = new Map(translations.entries.map((entry) => [entry.canonicalId, entry]));
const canonicalSkillBySlug = new Map(canonicalSkills.map((entry) => [entry.slug, entry]));
const localizedSkillByCanonical = new Map();

for (const entry of localizedSkillsDoc.entries || []) {
  if (localizedSkillByCanonical.has(entry.canonicalSlug)) throw new Error(`French decision skill defined more than once: ${entry.canonicalSlug}`);
  if (!canonicalSkillBySlug.has(entry.canonicalSlug)) throw new Error(`French decision skill points to unknown canonical skill: ${entry.canonicalSlug}`);
  localizedSkillByCanonical.set(entry.canonicalSlug, entry);
}
if (localizedSkillByCanonical.size !== canonicalSkills.length) {
  const missing = canonicalSkills.map((entry) => entry.slug).filter((slug) => !localizedSkillByCanonical.has(slug));
  throw new Error(`French decision skill coverage incomplete: ${localizedSkillByCanonical.size}/${canonicalSkills.length}. Missing: ${missing.join(", ") || "none"}`);
}

const esc = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);
const jsonLd = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
const normalize = (value = "") => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const url = (path) => `${SITE}${path}`;
const frenchSkillPath = (entry) => `/fr/competences/${entry.localizedSlug}/`;
const englishSkillPath = (entry) => `/skills/${entry.canonicalSlug}/`;
const contextLabel = (slug) => localizedSkillsDoc.contextLabels?.[slug] || slug.replace(/-/g, " ");

function nav(englishEquivalent = "/skills/") {
  return `<div class="locale-bar" aria-label="Choix de la langue"><span aria-current="page">Français</span><a href="${englishEquivalent}" hreflang="en" lang="en">English</a></div><header class="site-header"><a class="brand" href="/fr/"><picture><source srcset="/assets/brand.webp" type="image/webp"><img src="/assets/biases_icon.png" width="48" height="48" alt=""></picture><span>Cognitive<br>Biases</span></a><nav aria-label="Navigation principale"><a href="/fr/">Accueil</a><a href="/fr/explorer/">Explorer</a><a href="/fr/techniques/">Techniques</a><a href="/fr/competences/" aria-current="page">Compétences</a></nav></header>`;
}
function footer() {
  return `<footer class="site-footer"><div><a class="brand brand--footer" href="/fr/"><picture><source srcset="/assets/brand.webp" type="image/webp"><img src="/assets/biases_icon.png" width="40" height="40" alt=""></picture><span>Cognitive Biases</span></a><p>Comprendre les biais, vérifier les preuves et améliorer le prochain mouvement de raisonnement.</p></div><div class="footer-links"><a href="/fr/explorer/">Biais</a><a href="/fr/techniques/">Techniques</a><a href="/fr/competences/">Compétences</a><a href="/skills/" hreflang="en" lang="en">Decision Skills (English)</a><a href="/fr/data/index.json">Données FR</a></div><p class="fine-print">Informations pédagogiques, pas un conseil médical, juridique, financier ou de santé mentale.</p></footer>`;
}
function breadcrumb(items) {
  return `<nav class="fr-breadcrumbs" aria-label="Fil d'Ariane">${items.map((item, index) => item.href ? `<a href="${item.href}">${esc(item.label)}</a>${index < items.length - 1 ? " › " : ""}` : `<span aria-current="page">${esc(item.label)}</span>`).join("")}</nav>`;
}
function metaDescription(value) {
  const clean = String(value).replace(/\s+/g, " ").trim();
  if (clean.length <= 155) return clean;
  return `${clean.slice(0, 151).replace(/\s+\S*$/, "").replace(/[,:;–—-]+$/, "")}…`;
}
function page({ title, description, path, englishPath, body, schemas = [] }) {
  const canonical = url(path);
  const english = url(englishPath);
  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${canonical}#webpage`,
    name: title,
    description,
    url: canonical,
    inLanguage: "fr",
    isPartOf: { "@type": "WebSite", "@id": `${SITE}/#website`, name: "Cognitive Biases", url: `${SITE}/` }
  };
  const schemaScripts = [webPage, ...schemas].map((schema) => `<script type="application/ld+json">${jsonLd(schema)}</script>`).join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${esc(title)}</title><meta name="description" content="${esc(metaDescription(description))}"><link rel="canonical" href="${canonical}"><link rel="alternate" hreflang="fr" href="${canonical}"><link rel="alternate" hreflang="en" href="${english}"><link rel="alternate" hreflang="x-default" href="${english}"><link rel="icon" href="/favicon.png"><meta property="og:locale" content="fr_FR"><meta property="og:locale:alternate" content="en_US"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(metaDescription(description))}"><meta property="og:url" content="${canonical}"><meta property="og:type" content="website"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/fr.css">${schemaScripts}</head><body><a class="skip" href="#main">Aller au contenu</a>${nav(englishPath)}<main id="main">${body}</main>${footer()}</body></html>`;
}
async function emit(path, html) {
  const target = join(OUT, path.replace(/^\//, ""), "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}
function list(items, ordered = false) {
  const tag = ordered ? "ol" : "ul";
  return `<${tag}>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</${tag}>`;
}
function skillCard(entry) {
  const englishTitle = canonicalSkillBySlug.get(entry.canonicalSlug)?.title || entry.canonicalSlug;
  return `<article class="fr-card" data-fr-skill data-search="${esc(normalize([entry.title, englishTitle, ...(entry.aliases || []), entry.summary, entry.outcome].join(" ")))}"><span class="kicker">Compétence de décision</span><h2>${esc(entry.title)}</h2><p class="fr-english-term"><span>Terme anglais :</span> <span lang="en">${esc(englishTitle)}</span></p><p>${esc(entry.summary)}</p><p><strong>Objectif :</strong> ${esc(entry.outcome)}</p><a href="${frenchSkillPath(entry)}">Ouvrir la compétence →</a></article>`;
}
function biasCard(slug) {
  const entry = frBiasByCanonical.get(slug);
  if (!entry) throw new Error(`French skill references bias without French translation: ${slug}`);
  return `<article class="fr-card"><span class="kicker">Grille de lecture</span><h3>${esc(entry.localizedLabel)}</h3><p>${esc(entry.summary)}</p><a href="/fr/biais/${entry.localizedSlug}/">Lire la fiche →</a></article>`;
}

const localizedSkills = canonicalSkills.map((canonical) => {
  const localized = localizedSkillByCanonical.get(canonical.slug);
  const aliases = [...new Set([canonical.title, ...(localized.aliases || [])])];
  return {
    ...localized,
    canonicalSlug: canonical.slug,
    englishTitle: canonical.title,
    aliases,
    contexts: canonical.contexts,
    biases: canonical.biases,
    sourceRelease: localized.sourceRelease || localizedSkillsDoc.sourceRelease || release.releaseVersion,
    reviewedAt: localized.reviewedAt || localizedSkillsDoc.reviewedAt || TODAY,
    canonicalUrl: url(`/skills/${canonical.slug}/`),
    localizedUrl: url(frenchSkillPath(localized))
  };
});

const hubCards = localizedSkills.map(skillCard).join("");
const hubBody = `${breadcrumb([{ label: "Accueil", href: "/fr/" }, { label: "Compétences" }])}<section class="page-hero"><p class="eyebrow">Compétences de décision</p><h1>Apprenez quoi faire, pas seulement comment le biais s'appelle.</h1><p class="lede">Les noms de biais donnent du vocabulaire. Une compétence vous donne une procédure : vérifier une affirmation, prévoir, décider sous incertitude, revoir votre raisonnement ou utiliser l'IA sans lui déléguer la preuve.</p><div class="fr-locale-note"><strong>${localizedSkills.length}/${canonicalSkills.length} compétences canoniques disponibles en français.</strong><p>Les identifiants, les relations et l'état des preuves restent canoniques en anglais. La couche française traduit l'usage et la pratique, pas la structure des données.</p></div></section><section class="section"><div class="fr-search-panel"><label for="fr-skill-search"><strong>Rechercher une compétence</strong></label><input class="fr-search" id="fr-skill-search" type="search" autocomplete="off" placeholder="Ex. preuves, forecasting, IA, incertitude"><p id="fr-skill-search-status" class="fr-results-status" aria-live="polite"></p></div><div class="fr-card-grid" id="fr-skill-results">${hubCards}</div><div id="fr-skill-search-empty" class="fr-locale-note fr-hidden"><p>Aucune compétence ne correspond à cette recherche.</p></div></section><section class="section section--ink"><p class="kicker">Comment l'utiliser</p><h2>Partez de la tâche à mieux accomplir.</h2><p class="lede">Choisissez une compétence, appliquez sa procédure à une décision réelle, puis ouvrez les biais reliés seulement s'ils aident à poser une meilleure question. Le but n'est pas de produire une liste de diagnostics.</p></section><script>(()=>{const input=document.getElementById('fr-skill-search');const cards=[...document.querySelectorAll('[data-fr-skill]')];const empty=document.getElementById('fr-skill-search-empty');const status=document.getElementById('fr-skill-search-status');const norm=(v)=>v.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().trim();const render=()=>{const q=norm(input.value);let visible=0;for(const card of cards){const match=!q||card.dataset.search.includes(q);card.classList.toggle('fr-hidden',!match);if(match)visible++;}empty.classList.toggle('fr-hidden',visible!==0);status.textContent=visible+' '+(visible===1?'compétence':'compétences');};input.addEventListener('input',render);render();})();</script>`;
await emit("/fr/competences/", page({
  title: "Compétences de décision en français | Cognitive Biases",
  description: "Compétences pratiques pour évaluer les preuves, décider sous incertitude, prévoir, vérifier l'information, revoir son raisonnement et travailler avec l'IA.",
  path: "/fr/competences/",
  englishPath: "/skills/",
  body: hubBody,
  schemas: [{
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${SITE}/fr/competences/#collection`,
    name: "Compétences de décision en français",
    inLanguage: "fr",
    url: `${SITE}/fr/competences/`,
    numberOfItems: localizedSkills.length
  }]
}));

for (const skill of localizedSkills) {
  const route = frenchSkillPath(skill);
  const englishRoute = englishSkillPath(skill);
  const contextCards = skill.contexts.map((slug) => `<article class="fr-card"><span class="kicker">Contexte de décision</span><h3>${esc(contextLabel(slug))}</h3><p>Approfondissez cette compétence dans un guide de décision canonique.</p><a href="/contexts/${slug}/" hreflang="en" lang="en">Ouvrir le guide en anglais →</a></article>`).join("");
  const biasCards = skill.biases.map(biasCard).join("");
  const schema = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    "@id": `${url(route)}#resource`,
    identifier: skill.canonicalSlug,
    url: url(route),
    sameAs: url(englishRoute),
    name: skill.title,
    alternateName: skill.aliases,
    description: skill.summary,
    learningResourceType: "Compétence de décision",
    educationalUse: "Pratique",
    inLanguage: "fr",
    teaches: skill.outcome,
    about: skill.biases.map((slug) => {
      const bias = frBiasByCanonical.get(slug);
      return { "@type": "DefinedTerm", identifier: slug, name: bias?.localizedLabel || slug, url: bias ? url(`/fr/biais/${bias.localizedSlug}/`) : url(`/biases/${slug}/`) };
    })
  };
  const body = `${breadcrumb([{ label: "Accueil", href: "/fr/" }, { label: "Compétences", href: "/fr/competences/" }, { label: skill.title }])}<section class="page-hero"><p class="eyebrow">Compétence de décision · traduction française relue</p><h1>${esc(skill.title)}</h1><p class="fr-english-term">Terme anglais : <span lang="en">${esc(skill.englishTitle)}</span></p><p class="lede">${esc(skill.summary)}</p><p><strong>Objectif :</strong> ${esc(skill.outcome)}</p><ul class="fr-meta"><li>ID : <code>${esc(skill.canonicalSlug)}</code></li><li>Revue linguistique FR : ${esc(skill.reviewedAt)}</li><li>Release source : ${esc(skill.sourceRelease)}</li></ul></section><section class="section"><p class="kicker">Quand l'utiliser</p><h2>Repérez le type de problème avant de chercher un nom de biais.</h2>${list(skill.whenToUse)}</section><section class="section section--ink"><p class="kicker">À essayer</p><h2>Une procédure pour rendre le raisonnement plus inspectable.</h2>${list(skill.actions, true)}</section><section class="section"><p class="kicker">Exemple</p><h2>À quoi cela peut ressembler en pratique.</h2><p class="lede">${esc(skill.example)}</p></section><section class="section"><p class="kicker">Contextes de décision</p><h2>Appliquez la compétence à une situation réelle.</h2><p>Ces guides connexes restent actuellement canoniques en anglais ; la page française ne les traduit pas silencieusement.</p><div class="fr-card-grid">${contextCards}</div></section><section class="section"><p class="kicker">Grilles de lecture reliées</p><h2>Des biais à vérifier, pas des étiquettes à coller aux personnes.</h2><div class="fr-card-grid">${biasCards}</div></section><section class="section section--ink"><p class="kicker">Limite</p><h2>Ce que cette compétence ne garantit pas.</h2><p class="lede">${esc(skill.boundary)}</p></section><section class="section"><p class="kicker">Version canonique</p><p><a href="${englishRoute}" hreflang="en" lang="en">Voir la compétence en anglais →</a></p></section>`;
  await emit(route, page({
    title: `${skill.title} : compétence de décision | Cognitive Biases`,
    description: `${skill.summary} Procédure, exemple, limites et biais reliés en français.`,
    path: route,
    englishPath: englishRoute,
    body,
    schemas: [schema]
  }));
}

const localizedPairs = [
  { englishPath: "/skills/", frenchPath: "/fr/competences/" },
  ...localizedSkills.map((entry) => ({ englishPath: englishSkillPath(entry), frenchPath: frenchSkillPath(entry) }))
];
for (const pair of localizedPairs) await addReciprocalLocale(pair.englishPath, pair.frenchPath);
await addFrenchSkillsToHomepage(localizedSkills);
await patchFrenchNavigation(join(OUT, "fr"));
await writeFrenchSkillData(localizedSkills);
await updateSitemap(localizedPairs.map((pair) => pair.frenchPath));

console.log(`Generated French decision skills: ${localizedSkills.length}/${canonicalSkills.length}.`);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
async function addReciprocalLocale(englishPath, frenchPath) {
  const target = join(OUT, englishPath.replace(/^\//, ""), "index.html");
  let html = await readFile(target, "utf8");
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
async function addFrenchSkillsToHomepage(skills) {
  const path = join(OUT, "fr", "index.html");
  let html = await readFile(path, "utf8");
  if (html.includes('data-fr-skill-teaser="true"')) return;
  const featured = skills.slice(0, 3).map((skill) => `<article class="fr-card"><span class="kicker">Compétence</span><h3>${esc(skill.title)}</h3><p>${esc(skill.summary)}</p><a href="${frenchSkillPath(skill)}">Ouvrir →</a></article>`).join("");
  const section = `<section class="section" data-fr-skill-teaser="true"><p class="kicker">Compétences</p><h2>Transformez un concept en procédure de décision.</h2><p class="lede">Savoir nommer un biais aide. Savoir quoi faire ensuite aide davantage.</p><div class="fr-card-grid">${featured}</div><p><a class="button button--dark" href="/fr/competences/">Voir les compétences de décision</a></p></section>`;
  const marker = '<section class="section"><p class="kicker">Preuves</p>';
  html = html.includes(marker) ? html.replace(marker, `${section}${marker}`) : html.replace("</main>", `${section}</main>`);
  await writeFile(path, html);
}
async function patchFrenchNavigation(root) {
  for (const path of await htmlFiles(root)) {
    let html = await readFile(path, "utf8");
    if (!html.includes('href="/fr/competences/"')) {
      html = html.replace(/(<a href="\/fr\/techniques\/"[^>]*>[^<]+<\/a>)(<\/nav>)/, '$1<a href="/fr/competences/">Compétences</a>$2');
    }
    await writeFile(path, html);
  }
}
async function htmlFiles(root) {
  const output = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name === "index.html") output.push(full);
    }
  }
  await walk(root);
  return output;
}
async function writeFrenchSkillData(skills) {
  await mkdir(join(OUT, "data"), { recursive: true });
  await mkdir(join(OUT, "fr", "data"), { recursive: true });
  await writeFile(join(OUT, "data", "skills-fr.json"), `${JSON.stringify(localizedSkillsDoc, null, 2)}\n`);
  const publicData = {
    schemaVersion: release.schemaVersion,
    releaseVersion: release.releaseVersion,
    locale: "fr",
    canonicalLocale: "en",
    reviewedAt: localizedSkillsDoc.reviewedAt || TODAY,
    skills
  };
  await writeFile(join(OUT, "fr", "data", "skills.json"), `${JSON.stringify(publicData, null, 2)}\n`);
  const manifestPath = join(OUT, "fr", "data", "index.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.coverage = { ...(manifest.coverage || {}), skills: skills.length, canonicalDecisionSkills: canonicalSkills.length };
  manifest.datasets = { ...(manifest.datasets || {}), skills: `${SITE}/fr/data/skills.json`, canonicalSkills: `${SITE}/data/skills.json` };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
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
