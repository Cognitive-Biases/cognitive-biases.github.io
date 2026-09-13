import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const UPDATED_AT = "2026-09-13";

const guideNames = (await readdir("data/de")).filter((name) => /^decision-guides(?:-[a-z0-9-]+)?\.json$/i.test(name)).sort();
if (!guideNames.length) throw new Error("German decision-guide data is missing.");
const guideDocs = await Promise.all(guideNames.map(async (name) => JSON.parse(await readFile(join("data/de", name), "utf8"))));
for (const [index, doc] of guideDocs.entries()) {
  if (doc.locale !== "de" || doc.state !== "reviewed") throw new Error(`${guideNames[index]} must be locale=de and state=reviewed before publication.`);
}
const guides = guideDocs.flatMap((doc) => doc.guides || []);
const guideBySlug = new Map();
for (const guide of guides) {
  if (!guide.slug || guideBySlug.has(guide.slug)) throw new Error(`Duplicate or missing German decision-guide slug: ${guide.slug || "(empty)"}`);
  guideBySlug.set(guide.slug, guide);
}

const baseBiasDoc = JSON.parse(await readFile("data/de/biases.json", "utf8"));
const expansionNames = (await readdir("data/de")).filter((name) => /^biases-reviewed-expansion-\d+\.json$/i.test(name)).sort();
const expansionDocs = await Promise.all(expansionNames.map(async (name) => JSON.parse(await readFile(join("data/de", name), "utf8"))));
const biases = [...(baseBiasDoc.entries || []), ...expansionDocs.flatMap((doc) => doc.entries || [])];
const biasBySlug = new Map(biases.map((entry) => [entry.slug, entry]));
const techniquesDoc = JSON.parse(await readFile("data/de/techniques.json", "utf8"));
const techniques = techniquesDoc.techniques || [];
const techniqueBySlug = new Map(techniques.map((entry) => [entry.slug, entry]));

const nonEmpty = (value) => String(value || "").trim().length > 0;
for (const guide of guides) {
  for (const field of ["title", "category", "summary", "situation", "whyItHelps", "boundary"]) {
    if (!nonEmpty(guide[field])) throw new Error(`${guide.slug}: ${field} is required.`);
  }
  if (!Array.isArray(guide.checklist) || guide.checklist.length < 4 || !guide.checklist.every(nonEmpty)) throw new Error(`${guide.slug}: at least four checklist steps are required.`);
  for (const slug of guide.biasSlugs || []) if (!biasBySlug.has(slug)) throw new Error(`${guide.slug}: missing reviewed German bias ${slug}.`);
  for (const slug of guide.techniqueSlugs || []) if (!techniqueBySlug.has(slug)) throw new Error(`${guide.slug}: missing German technique ${slug}.`);
}

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);
const jsonForHtml = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

function header() {
  return `<header class="site-header"><a class="brand" href="/de/"><picture><source srcset="/assets/brand.webp" type="image/webp"><img src="/assets/biases_icon.png" width="48" height="48" alt=""></picture><span>Cognitive<br>Biases</span></a><nav aria-label="Hauptnavigation"><a href="/de/biases/">Verzerrungen</a><a href="/de/techniques/">Denkwerkzeuge</a><a href="/de/entscheidungen/" aria-current="page">Situationen</a><a href="/contexts/" lang="en">English</a></nav></header>`;
}

function footer() {
  return `<footer class="site-footer"><div><a class="brand brand--footer" href="/de/"><picture><source srcset="/assets/brand.webp" type="image/webp"><img src="/assets/biases_icon.png" width="40" height="40" alt=""></picture><span>Cognitive Biases</span></a><p>Kognitive Verzerrungen erkennen, Aussagen prüfen und bessere Entscheidungen vorbereiten.</p></div><div class="footer-links"><a href="/de/biases/">Verzerrungen</a><a href="/de/techniques/">Denkwerkzeuge</a><a href="/de/entscheidungen/">Situationen</a><a href="/about/editorial/" lang="en">Wie wir Inhalte prüfen — English</a><a href="/methodology/" lang="en">Methodik — English</a></div><p class="fine-print">Bildungsangebot. Kein Ersatz für medizinische, rechtliche, finanzielle oder psychologische Beratung.</p></footer>`;
}

function breadcrumbs(items) {
  return `<nav class="breadcrumbs internal-breadcrumbs" aria-label="Brotkrümelnavigation">${items.map((item, index) => {
    const separator = index ? '<span aria-hidden="true">/</span>' : "";
    return item.href ? `${separator}<a href="${item.href}">${escapeHtml(item.label)}</a>` : `${separator}<span aria-current="page">${escapeHtml(item.label)}</span>`;
  }).join("")}</nav>`;
}

function page({ title, description, path, body, schema, filter = false }) {
  const canonical = `${SITE}${path}`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${canonical}"><link rel="alternate" hreflang="de" href="${canonical}"><link rel="icon" href="/favicon.png"><meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}"><meta property="og:locale" content="de_DE"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/de.css"><script type="application/ld+json">${jsonForHtml(schema)}</script></head><body><a class="skip" href="#main">Zum Inhalt springen</a>${header()}<main id="main">${body}</main>${footer()}${filter ? '<script src="/de-interface.js" defer></script>' : ""}</body></html>`;
}

async function writePage(relativePath, html) {
  const target = join(OUT, relativePath, "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}

function checklist(items) {
  return `<ol class="decision-checklist">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`;
}

const generatedPaths = [];
for (const guide of guides) {
  const path = `/de/entscheidungen/${guide.slug}/`;
  generatedPaths.push(path);
  const biasCards = (guide.biasSlugs || []).map((slug) => {
    const bias = biasBySlug.get(slug);
    return `<article class="practice-set-card"><p class="kicker">Bias-Linse</p><h3><a href="/de/biases/${slug}/">${escapeHtml(bias.title)}</a></h3><p>${escapeHtml(bias.summary)}</p></article>`;
  }).join("");
  const techniqueCards = (guide.techniqueSlugs || []).map((slug) => {
    const technique = techniqueBySlug.get(slug);
    return `<article class="practice-set-card"><p class="kicker">Denkwerkzeug</p><h3><a href="/de/techniques/${slug}/">${escapeHtml(technique.title)}</a></h3><p>${escapeHtml(technique.purpose)}</p></article>`;
  }).join("");
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${SITE}${path}#webpage`,
        url: `${SITE}${path}`,
        name: guide.title,
        description: guide.summary,
        inLanguage: "de",
        dateModified: UPDATED_AT,
        about: (guide.biasSlugs || []).map((slug) => ({ "@id": `${SITE}/de/biases/${slug}/#term` }))
      },
      {
        "@type": "HowTo",
        "@id": `${SITE}${path}#howto`,
        name: guide.title,
        description: guide.summary,
        inLanguage: "de",
        step: guide.checklist.map((text, index) => ({ "@type": "HowToStep", position: index + 1, text }))
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Cognitive Biases", item: `${SITE}/de/` },
          { "@type": "ListItem", position: 2, name: "Entscheidungssituationen", item: `${SITE}/de/entscheidungen/` },
          { "@type": "ListItem", position: 3, name: guide.title, item: `${SITE}${path}` }
        ]
      }
    ]
  };
  const body = `${breadcrumbs([{ label: "Start", href: "/de/" }, { label: "Situationen", href: "/de/entscheidungen/" }, { label: guide.title }])}<section class="page-hero"><p class="eyebrow">${escapeHtml(guide.category)} · Entscheidungssituation</p><h1>${escapeHtml(guide.title)}</h1><p class="lede">${escapeHtml(guide.summary)}</p></section><section class="section"><p class="kicker">Die Situation</p><h2>Was hier leicht untergeht</h2><p>${escapeHtml(guide.situation)}</p></section><section class="section section--ink"><p class="kicker">Prüfe das</p><h2>Mach den nächsten Schritt beobachtbarer</h2>${checklist(guide.checklist)}</section><section class="section"><p class="kicker">Warum es helfen kann</p><h2>Was die Prüfung sichtbar macht</h2><p>${escapeHtml(guide.whyItHelps)}</p><h3>Grenzen</h3><p>${escapeHtml(guide.boundary)}</p></section>${biasCards ? `<section class="section"><p class="kicker">Bias-Linsen</p><h2>Verwandte Muster</h2><div class="practice-set-grid">${biasCards}</div></section>` : ""}${techniqueCards ? `<section class="section"><p class="kicker">Denkwerkzeuge</p><h2>Vertiefe die Prüfung</h2><div class="practice-set-grid">${techniqueCards}</div></section>` : ""}<section class="section"><p class="kicker">Evidenzgrenze</p><p>Diese Seite kombiniert bereits geprüfte Inhalte des Projekts. Eine passende Bias-Linse ist eine Frage an den Entscheidungsprozess, keine Diagnose einer Person und kein Beweis für die Ursache einer einzelnen Entscheidung.</p><p><a href="/evidence/" lang="en">Evidence Reviews — English →</a></p></section>`;
  await writePage(`de/entscheidungen/${guide.slug}`, page({
    title: `${guide.title} | Cognitive Biases`,
    description: guide.summary,
    path,
    body,
    schema
  }));
}

const cards = guides.map((guide) => {
  const search = [guide.title, guide.category, guide.summary, guide.situation, ...(guide.searchTerms || [])].join(" ");
  return `<article class="practice-set-card" data-de-filter-item data-search="${escapeHtml(search)}"><p class="kicker">${escapeHtml(guide.category)}</p><h2><a href="/de/entscheidungen/${guide.slug}/">${escapeHtml(guide.title)}</a></h2><p>${escapeHtml(guide.summary)}</p><p><a href="/de/entscheidungen/${guide.slug}/">Situation prüfen →</a></p></article>`;
}).join("");
const indexPath = "/de/entscheidungen/";
generatedPaths.push(indexPath);
await writePage("de/entscheidungen", page({
  title: "Entscheidungssituationen: vom Problem zum Check | Cognitive Biases",
  description: "Praktische deutsche Entscheidungshilfen für KI-Antworten, Projekte, Teams, Schätzungen, Käufe und Verhandlungen.",
  path: indexPath,
  filter: true,
  schema: { "@context": "https://schema.org", "@type": "CollectionPage", name: "Entscheidungssituationen", url: `${SITE}${indexPath}`, inLanguage: "de", numberOfItems: guides.length },
  body: `${breadcrumbs([{ label: "Start", href: "/de/" }, { label: "Situationen" }])}<section class="page-hero"><p class="eyebrow">Problem zuerst</p><h1>Du musst den Bias nicht kennen, um besser zu prüfen.</h1><p class="lede">Starte mit der Situation: eine überzeugende KI-Antwort, ein schwaches Projekt, ein schneller Teamkonsens, ein festes Zieldatum, ein Kauf oder eine Verhandlung.</p></section><section class="section"><div class="de-filter" data-de-filter><label for="de-decision-search"><strong>Situation suchen</strong></label><input id="de-decision-search" type="search" inputmode="search" autocomplete="off" placeholder="z. B. KI, Projekt, Team, Termin, Kauf, Verhandlung" data-de-filter-input><p class="fine-print" data-de-filter-count>Insgesamt: ${guides.length}</p><div class="practice-set-grid" data-de-filter-list>${cards}</div><p class="fine-print" data-de-filter-empty hidden>Keine passende Situation gefunden. Probiere ein allgemeineres Wort oder öffne die Verzerrungen und Denkwerkzeuge.</p></div></section>`
}));

async function walkHtml(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walkHtml(path));
    else if (entry.isFile() && entry.name === "index.html") files.push(path);
  }
  return files;
}

for (const file of await walkHtml(join(OUT, "de"))) {
  let html = await readFile(file, "utf8");
  let dirty = false;
  if (!html.includes('href="/de/entscheidungen/"')) {
    const navPattern = /(<a href="\/de\/techniques\/"[^>]*>Denkwerkzeuge<\/a>)/;
    if (navPattern.test(html)) {
      html = html.replace(navPattern, `$1<a href="/de/entscheidungen/">Situationen</a>`);
      dirty = true;
    }
    const footerPattern = /(<a href="\/de\/techniques\/">Denkwerkzeuge<\/a>)/;
    if (footerPattern.test(html)) {
      html = html.replace(footerPattern, `$1<a href="/de/entscheidungen/">Situationen</a>`);
      dirty = true;
    }
  }
  if (dirty) await writeFile(file, html);
}

const homeFile = join(OUT, "de", "index.html");
let home = await readFile(homeFile, "utf8");
if (!home.includes("Mit einer Situation starten")) {
  const block = `<section class="section"><p class="kicker">Problem zuerst</p><h2>Mit einer Situation starten</h2><p class="lede">Du musst nicht zuerst den richtigen Fachbegriff erraten. Öffne eine konkrete Entscheidungssituation und arbeite dich von dort zu Bias-Linsen und Denkwerkzeugen vor.</p><p><a class="button" href="/de/entscheidungen/">Situationen öffnen</a></p></section>`;
  home = home.replace("</main>", `${block}</main>`);
  await writeFile(homeFile, home);
}

const guidesByBias = new Map();
const guidesByTechnique = new Map();
for (const guide of guides) {
  for (const slug of guide.biasSlugs || []) {
    if (!guidesByBias.has(slug)) guidesByBias.set(slug, []);
    guidesByBias.get(slug).push(guide);
  }
  for (const slug of guide.techniqueSlugs || []) {
    if (!guidesByTechnique.has(slug)) guidesByTechnique.set(slug, []);
    guidesByTechnique.get(slug).push(guide);
  }
}

async function injectRelated(file, title, related) {
  try { await access(file); } catch { return; }
  let html = await readFile(file, "utf8");
  if (html.includes(title)) return;
  const links = related.map((guide) => `<li><a href="/de/entscheidungen/${guide.slug}/">${escapeHtml(guide.title)}</a></li>`).join("");
  html = html.replace("</main>", `<section class="section"><p class="kicker">Anwendung</p><h2>${title}</h2><ul>${links}</ul></section></main>`);
  await writeFile(file, html);
}
for (const [slug, related] of guidesByBias) await injectRelated(join(OUT, "de", "biases", slug, "index.html"), "Passende Entscheidungssituationen", related);
for (const [slug, related] of guidesByTechnique) await injectRelated(join(OUT, "de", "techniques", slug, "index.html"), "Wo dieses Werkzeug praktisch passt", related);

await mkdir(join(OUT, "data", "de"), { recursive: true });
await writeFile(join(OUT, "data", "de", "decision-guides.json"), JSON.stringify({
  version: 1,
  locale: "de",
  state: "reviewed",
  updatedAt: UPDATED_AT,
  guides
}, null, 2) + "\n");

const sitemapPath = join(OUT, "sitemap.xml");
try {
  let sitemap = await readFile(sitemapPath, "utf8");
  for (const path of generatedPaths) {
    const url = `${SITE}${path}`;
    if (!sitemap.includes(`<loc>${url}</loc>`)) sitemap = sitemap.replace("</urlset>", `  <url><loc>${url}</loc></url>\n</urlset>`);
  }
  await writeFile(sitemapPath, sitemap);
} catch {
  console.warn("sitemap.xml not available while generating German decision guides.");
}

console.log(`German decision guides: ${guides.length} reviewed situation pages plus collection, backlinks and public data.`);
