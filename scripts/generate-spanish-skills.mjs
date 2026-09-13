import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadSpanishTranslations } from "./lib/spanish-translations.mjs";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const TODAY = "2026-09-13";

const [canonicalSkillsDoc, localizedSkillsDoc, frenchSkillsDoc, release, canonicalBiasesRaw] = await Promise.all([
  readJson("data/skills.json"),
  readJson("data/skills-es.json"),
  readJson("data/skills-fr.json"),
  readJson("data/release.json"),
  readJson("data/biases.json")
]);

const canonicalSkills = canonicalSkillsDoc.entries || [];
const canonicalBiases = Array.isArray(canonicalBiasesRaw) ? canonicalBiasesRaw : canonicalBiasesRaw.biases || [];
const translations = await loadSpanishTranslations({ canonicalBiases, releaseVersion: release.releaseVersion, today: TODAY });
const esBiasByCanonical = new Map(translations.entries.map((entry) => [entry.canonicalId, entry]));
const canonicalSkillBySlug = new Map(canonicalSkills.map((entry) => [entry.slug, entry]));
const localizedSkillByCanonical = new Map();
const frenchSkillByCanonical = new Map((frenchSkillsDoc.entries || []).map((entry) => [entry.canonicalSlug, entry]));

for (const entry of localizedSkillsDoc.entries || []) {
  if (localizedSkillByCanonical.has(entry.canonicalSlug)) throw new Error(`Spanish decision skill defined more than once: ${entry.canonicalSlug}`);
  if (!canonicalSkillBySlug.has(entry.canonicalSlug)) throw new Error(`Spanish decision skill points to unknown canonical skill: ${entry.canonicalSlug}`);
  localizedSkillByCanonical.set(entry.canonicalSlug, entry);
}
if (localizedSkillByCanonical.size !== canonicalSkills.length) {
  const missing = canonicalSkills.map((entry) => entry.slug).filter((slug) => !localizedSkillByCanonical.has(slug));
  throw new Error(`Spanish decision skill coverage incomplete: ${localizedSkillByCanonical.size}/${canonicalSkills.length}. Missing: ${missing.join(", ") || "none"}`);
}

const esc = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);
const jsonLd = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
const normalize = (value = "") => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const url = (path) => `${SITE}${path}`;
const spanishSkillPath = (entry) => `/es/habilidades/${entry.localizedSlug}/`;
const englishSkillPath = (entry) => `/skills/${entry.canonicalSlug}/`;
const frenchSkillPath = (entry) => `/fr/competences/${entry.localizedSlug}/`;
const contextLabel = (slug) => localizedSkillsDoc.contextLabels?.[slug] || slug.replace(/-/g, " ");

function nav(englishEquivalent = "/skills/", frenchEquivalent = "/fr/competences/") {
  return `<div class="locale-bar" aria-label="Idioma"><span aria-current="page">Español</span><a href="${englishEquivalent}" hreflang="en" lang="en">English</a><a href="${frenchEquivalent}" hreflang="fr" lang="fr">Français</a></div><header class="site-header"><a class="brand" href="/es/"><picture><source srcset="/assets/brand.webp" type="image/webp"><img src="/assets/biases_icon.png" width="48" height="48" alt=""></picture><span>Cognitive<br>Biases</span></a><nav aria-label="Navegación principal"><a href="/es/">Inicio</a><a href="/es/explorar/">Explorar</a><a href="/es/tecnicas/">Técnicas</a><a href="/es/habilidades/" aria-current="page">Habilidades</a></nav></header>`;
}
function footer() {
  return `<footer class="site-footer"><div><a class="brand brand--footer" href="/es/"><picture><source srcset="/assets/brand.webp" type="image/webp"><img src="/assets/biases_icon.png" width="40" height="40" alt=""></picture><span>Cognitive Biases</span></a><p>Comprende los sesgos, comprueba la evidencia y mejora el siguiente paso del razonamiento.</p></div><div class="footer-links"><a href="/es/explorar/">Sesgos</a><a href="/es/tecnicas/">Técnicas</a><a href="/es/habilidades/">Habilidades</a><a href="/skills/" hreflang="en" lang="en">Decision Skills (English)</a><a href="/fr/competences/" hreflang="fr" lang="fr">Compétences (Français)</a><a href="/es/data/index.json">Datos ES</a></div><p class="fine-print">Información educativa, no asesoramiento médico, jurídico, financiero ni de salud mental.</p></footer>`;
}
function breadcrumb(items) {
  return `<nav class="fr-breadcrumbs" aria-label="Migas de pan">${items.map((item, index) => item.href ? `<a href="${item.href}">${esc(item.label)}</a>${index < items.length - 1 ? " › " : ""}` : `<span aria-current="page">${esc(item.label)}</span>`).join("")}</nav>`;
}
function metaDescription(value) {
  const clean = String(value).replace(/\s+/g, " ").trim();
  if (clean.length <= 155) return clean;
  return `${clean.slice(0, 151).replace(/\s+\S*$/, "").replace(/[,:;–—-]+$/, "")}…`;
}
function page({ title, description, path, englishPath, frenchPath, body, schemas = [] }) {
  const canonical = url(path);
  const english = url(englishPath);
  const french = url(frenchPath);
  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${canonical}#webpage`,
    name: title,
    description,
    url: canonical,
    inLanguage: "es",
    isPartOf: { "@type": "WebSite", "@id": `${SITE}/#website`, name: "Cognitive Biases", url: `${SITE}/` }
  };
  const schemaScripts = [webPage, ...schemas].map((schema) => `<script type="application/ld+json">${jsonLd(schema)}</script>`).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${esc(title)}</title><meta name="description" content="${esc(metaDescription(description))}"><link rel="canonical" href="${canonical}"><link rel="alternate" hreflang="es" href="${canonical}"><link rel="alternate" hreflang="en" href="${english}"><link rel="alternate" hreflang="fr" href="${french}"><link rel="alternate" hreflang="x-default" href="${english}"><link rel="icon" href="/favicon.png"><meta property="og:locale" content="es_ES"><meta property="og:locale:alternate" content="en_US"><meta property="og:locale:alternate" content="fr_FR"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(metaDescription(description))}"><meta property="og:url" content="${canonical}"><meta property="og:type" content="website"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/es.css">${schemaScripts}</head><body><a class="skip" href="#main">Ir al contenido</a>${nav(englishPath, frenchPath)}<main id="main">${body}</main>${footer()}</body></html>`;
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
  return `<article class="fr-card" data-es-skill data-search="${esc(normalize([entry.title, englishTitle, ...(entry.aliases || []), entry.summary, entry.outcome].join(" ")))}"><span class="kicker">Habilidad de decisión</span><h2>${esc(entry.title)}</h2><p class="fr-english-term"><span>Término en inglés:</span> <span lang="en">${esc(englishTitle)}</span></p><p>${esc(entry.summary)}</p><p><strong>Objetivo:</strong> ${esc(entry.outcome)}</p><a href="${spanishSkillPath(entry)}">Abrir la habilidad →</a></article>`;
}
function biasCard(slug) {
  const entry = esBiasByCanonical.get(slug);
  if (!entry) throw new Error(`Spanish skill references bias without Spanish translation: ${slug}`);
  return `<article class="fr-card"><span class="kicker">Lente de revisión</span><h3>${esc(entry.localizedLabel)}</h3><p>${esc(entry.summary)}</p><a href="/es/sesgos/${entry.localizedSlug}/">Leer la ficha →</a></article>`;
}

const localizedSkills = canonicalSkills.map((canonical) => {
  const localized = localizedSkillByCanonical.get(canonical.slug);
  const french = frenchSkillByCanonical.get(canonical.slug);
  if (!french) throw new Error(`Spanish skill has no French equivalent: ${canonical.slug}`);
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
    localizedUrl: url(spanishSkillPath(localized)),
    frenchUrl: url(frenchSkillPath(french))
  };
});

const hubCards = localizedSkills.map(skillCard).join("");
const hubBody = `${breadcrumb([{ label: "Inicio", href: "/es/" }, { label: "Habilidades" }])}<section class="page-hero"><p class="eyebrow">Habilidades de decisión</p><h1>Aprende qué hacer, no solo cómo se llama el sesgo.</h1><p class="lede">Los nombres de sesgos dan vocabulario. Una habilidad ofrece un procedimiento: comprobar una afirmación, prever, decidir bajo incertidumbre, revisar el propio razonamiento o usar IA sin delegarle la evidencia.</p><div class="fr-locale-note"><strong>${localizedSkills.length}/${canonicalSkills.length} habilidades canónicas disponibles en español.</strong><p>Los identificadores, relaciones y estados de evidencia siguen siendo canónicos en inglés. La capa española localiza el uso y la práctica, no reescribe la estructura de datos.</p></div></section><section class="section"><div class="fr-search-panel"><label for="es-skill-search"><strong>Buscar una habilidad</strong></label><input class="fr-search" id="es-skill-search" type="search" autocomplete="off" placeholder="Ej. evidencia, previsión, IA, incertidumbre"><p id="es-skill-search-status" class="fr-results-status" aria-live="polite"></p></div><div class="fr-card-grid" id="es-skill-results">${hubCards}</div><div id="es-skill-search-empty" class="fr-locale-note fr-hidden"><p>Ninguna habilidad coincide con esta búsqueda.</p></div></section><section class="section section--ink"><p class="kicker">Cómo usarlo</p><h2>Empieza por la tarea que quieres hacer mejor.</h2><p class="lede">Elige una habilidad, aplica el procedimiento a una decisión real y abre los sesgos relacionados solo cuando ayuden a formular una pregunta mejor. El objetivo no es producir una lista de diagnósticos.</p></section><script>(()=>{const input=document.getElementById('es-skill-search');const cards=[...document.querySelectorAll('[data-es-skill]')];const empty=document.getElementById('es-skill-search-empty');const status=document.getElementById('es-skill-search-status');const norm=(v)=>v.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().trim();const render=()=>{const q=norm(input.value);let visible=0;for(const card of cards){const match=!q||card.dataset.search.includes(q);card.classList.toggle('fr-hidden',!match);if(match)visible++;}empty.classList.toggle('fr-hidden',visible!==0);status.textContent=visible+' '+(visible===1?'habilidad':'habilidades');};input.addEventListener('input',render);render();})();</script>`;
await emit("/es/habilidades/", page({
  title: "Habilidades de decisión en español | Cognitive Biases",
  description: "Habilidades prácticas para evaluar evidencia, decidir bajo incertidumbre, prever, verificar información, revisar el razonamiento y trabajar con IA.",
  path: "/es/habilidades/",
  englishPath: "/skills/",
  frenchPath: "/fr/competences/",
  body: hubBody,
  schemas: [{
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${SITE}/es/habilidades/#collection`,
    name: "Habilidades de decisión en español",
    inLanguage: "es",
    url: `${SITE}/es/habilidades/`,
    numberOfItems: localizedSkills.length
  }]
}));

for (const skill of localizedSkills) {
  const route = spanishSkillPath(skill);
  const englishRoute = englishSkillPath(skill);
  const french = frenchSkillByCanonical.get(skill.canonicalSlug);
  const frenchRoute = frenchSkillPath(french);
  const contextCards = skill.contexts.map((slug) => `<article class="fr-card"><span class="kicker">Contexto de decisión</span><h3>${esc(contextLabel(slug))}</h3><p>Profundiza esta habilidad en una guía canónica de decisión.</p><a href="/contexts/${slug}/" hreflang="en" lang="en">Abrir la guía en inglés →</a></article>`).join("");
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
    learningResourceType: "Habilidad de decisión",
    educationalUse: "Práctica",
    inLanguage: "es",
    teaches: skill.outcome,
    about: skill.biases.map((slug) => {
      const bias = esBiasByCanonical.get(slug);
      return { "@type": "DefinedTerm", identifier: slug, name: bias?.localizedLabel || slug, url: bias ? url(`/es/sesgos/${bias.localizedSlug}/`) : url(`/biases/${slug}/`) };
    })
  };
  const body = `${breadcrumb([{ label: "Inicio", href: "/es/" }, { label: "Habilidades", href: "/es/habilidades/" }, { label: skill.title }])}<section class="page-hero"><p class="eyebrow">Habilidad de decisión · traducción española revisada</p><h1>${esc(skill.title)}</h1><p class="fr-english-term">Término en inglés: <span lang="en">${esc(skill.englishTitle)}</span></p><p class="lede">${esc(skill.summary)}</p><p><strong>Objetivo:</strong> ${esc(skill.outcome)}</p><ul class="fr-meta"><li>ID: <code>${esc(skill.canonicalSlug)}</code></li><li>Revisión lingüística ES: ${esc(skill.reviewedAt)}</li><li>Release fuente: ${esc(skill.sourceRelease)}</li></ul></section><section class="section"><p class="kicker">Cuándo usarla</p><h2>Detecta el tipo de problema antes de buscar el nombre de un sesgo.</h2>${list(skill.whenToUse)}</section><section class="section section--ink"><p class="kicker">Procedimiento</p><h2>Haz que el razonamiento sea más fácil de inspeccionar.</h2>${list(skill.actions, true)}</section><section class="section"><p class="kicker">Ejemplo</p><h2>Cómo puede verse en la práctica.</h2><p class="lede">${esc(skill.example)}</p></section><section class="section"><p class="kicker">Contextos de decisión</p><h2>Aplica la habilidad a una situación real.</h2><p>Estas guías relacionadas siguen siendo canónicas en inglés; la página española no las traduce silenciosamente.</p><div class="fr-card-grid">${contextCards}</div></section><section class="section"><p class="kicker">Lentes de revisión relacionadas</p><h2>Sesgos que conviene comprobar, no etiquetas que colocar a personas.</h2><div class="fr-card-grid">${biasCards}</div></section><section class="section section--ink"><p class="kicker">Límite</p><h2>Lo que esta habilidad no garantiza.</h2><p class="lede">${esc(skill.boundary)}</p></section><section class="section"><p class="kicker">Versión canónica</p><p><a href="${englishRoute}" hreflang="en" lang="en">Ver la habilidad en inglés →</a></p></section>`;
  await emit(route, page({
    title: `${skill.title}: habilidad de decisión | Cognitive Biases`,
    description: `${skill.summary} Procedimiento, ejemplo, límites y sesgos relacionados en español.`,
    path: route,
    englishPath: englishRoute,
    frenchPath: frenchRoute,
    body,
    schemas: [schema]
  }));
}

const localizedPairs = [
  { englishPath: "/skills/", frenchPath: "/fr/competences/", spanishPath: "/es/habilidades/" },
  ...localizedSkills.map((entry) => ({ englishPath: englishSkillPath(entry), frenchPath: frenchSkillPath(frenchSkillByCanonical.get(entry.canonicalSlug)), spanishPath: spanishSkillPath(entry) }))
];
for (const pair of localizedPairs) {
  await addEnglishReciprocalLocale(pair.englishPath, pair.spanishPath);
  await addFrenchReciprocalLocale(pair.frenchPath, pair.spanishPath);
}
await addSpanishSkillsToHomepage(localizedSkills);
await patchSpanishNavigation(join(OUT, "es"));
await writeSpanishSkillData(localizedSkills);
await updateSitemap(localizedPairs.map((pair) => pair.spanishPath));

console.log(`Generated Spanish decision skills: ${localizedSkills.length}/${canonicalSkills.length}.`);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
async function addEnglishReciprocalLocale(englishPath, spanishPath) {
  const target = join(OUT, englishPath.replace(/^\//, ""), "index.html");
  let html = await readFile(target, "utf8");
  const spanishUrl = url(spanishPath);
  if (!html.includes(`hreflang="es" href="${spanishUrl}"`)) html = html.replace("</head>", `<link rel="alternate" hreflang="es" href="${spanishUrl}"></head>`);
  if (!html.includes(`href="${spanishPath}"`)) {
    const link = `<a data-locale-switch="es" href="${spanishPath}" hreflang="es" lang="es">Español</a>`;
    if (html.includes('class="locale-switch-bar"')) html = html.replace(/(<div class="locale-switch-bar"[^>]*>[\s\S]*?)(<\/div>)/, `$1${link}$2`);
    else html = html.replace(/<body([^>]*)>/, `<body$1><div class="locale-switch-bar" aria-label="Language"><span aria-current="page">English</span>${link}</div>`);
  }
  await writeFile(target, html);
}
async function addFrenchReciprocalLocale(frenchPath, spanishPath) {
  const target = join(OUT, frenchPath.replace(/^\//, ""), "index.html");
  let html = await readFile(target, "utf8");
  const spanishUrl = url(spanishPath);
  if (!html.includes(`hreflang="es" href="${spanishUrl}"`)) html = html.replace("</head>", `<link rel="alternate" hreflang="es" href="${spanishUrl}"></head>`);
  if (!html.includes(`href="${spanishPath}"`)) {
    const link = `<a data-locale-switch="es" href="${spanishPath}" hreflang="es" lang="es">Español</a>`;
    if (html.includes('class="locale-bar"')) html = html.replace(/(<div class="locale-bar"[^>]*>[\s\S]*?)(<\/div>)/, `$1${link}$2`);
    else html = html.replace(/<body([^>]*)>/, `<body$1><div class="locale-switch-bar" aria-label="Langue"><span aria-current="page">Français</span>${link}</div>`);
  }
  await writeFile(target, html);
}
async function addSpanishSkillsToHomepage(skills) {
  const path = join(OUT, "es", "index.html");
  let html = await readFile(path, "utf8");
  if (html.includes('data-es-skill-teaser="true"')) return;
  const featured = skills.slice(0, 3).map((skill) => `<article class="fr-card"><span class="kicker">Habilidad</span><h3>${esc(skill.title)}</h3><p>${esc(skill.summary)}</p><a href="${spanishSkillPath(skill)}">Abrir →</a></article>`).join("");
  const section = `<section class="section" data-es-skill-teaser="true"><p class="kicker">Habilidades</p><h2>Convierte un concepto en un procedimiento de decisión.</h2><p class="lede">Saber nombrar un sesgo ayuda. Saber qué hacer después ayuda más.</p><div class="fr-card-grid">${featured}</div><p><a class="button button--dark" href="/es/habilidades/">Ver las habilidades de decisión</a></p></section>`;
  const marker = '<section class="section"><p class="kicker">Evidencia</p>';
  html = html.includes(marker) ? html.replace(marker, `${section}${marker}`) : html.replace("</main>", `${section}</main>`);
  await writeFile(path, html);
}
async function patchSpanishNavigation(root) {
  for (const path of await htmlFiles(root)) {
    let html = await readFile(path, "utf8");
    if (!html.includes('href="/es/habilidades/"')) {
      html = html.replace(/(<a href="\/es\/tecnicas\/"[^>]*>[^<]+<\/a>)(<\/nav>)/, '$1<a href="/es/habilidades/">Habilidades</a>$2');
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
async function writeSpanishSkillData(skills) {
  await mkdir(join(OUT, "data"), { recursive: true });
  await mkdir(join(OUT, "es", "data"), { recursive: true });
  await writeFile(join(OUT, "data", "skills-es.json"), `${JSON.stringify(localizedSkillsDoc, null, 2)}\n`);
  const publicData = {
    schemaVersion: release.schemaVersion,
    releaseVersion: release.releaseVersion,
    locale: "es",
    canonicalLocale: "en",
    reviewedAt: localizedSkillsDoc.reviewedAt || TODAY,
    skills
  };
  await writeFile(join(OUT, "es", "data", "skills.json"), `${JSON.stringify(publicData, null, 2)}\n`);
  const manifestPath = join(OUT, "es", "data", "index.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.coverage = { ...(manifest.coverage || {}), skills: skills.length, canonicalDecisionSkills: canonicalSkills.length };
  manifest.datasets = { ...(manifest.datasets || {}), skills: `${SITE}/es/data/skills.json`, canonicalSkills: `${SITE}/data/skills.json` };
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
