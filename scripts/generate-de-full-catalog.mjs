import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const TODAY = "2026-09-13";

const canonical = JSON.parse(await readFile("data/biases.json", "utf8"));
const canonicalPublished = canonical.filter((entry) => entry.published === true && entry.status !== "merged-duplicate");
const canonicalBySlug = new Map(canonicalPublished.map((entry) => [entry.slug, entry]));

const deNames = (await readdir("data/de"))
  .filter((name) => name === "biases.json" || /^biases-reviewed-expansion-\d+\.json$/i.test(name) || /^biases-catalog-\d+\.json$/i.test(name))
  .sort();
const deDocs = await Promise.all(deNames.map(async (name) => ({ name, doc: JSON.parse(await readFile(join("data/de", name), "utf8")) })));
const entries = deDocs.flatMap(({ name, doc }) => (doc.entries || []).map((entry) => ({ ...entry, _sourceFile: name, _sourceState: doc.state || "unknown" })));
const deBySlug = new Map(entries.map((entry) => [entry.slug, entry]));

const evidenceClasses = JSON.parse(await readFile("data/evidence-classes.json", "utf8"));
const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name)).sort();
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const reviewBySlug = new Map(evidenceDocs.flatMap((doc) => doc.reviews || []).map((review) => [review.slug, review]));

const expected = canonicalPublished.map((entry) => entry.slug);
const missing = expected.filter((slug) => !deBySlug.has(slug));
if (missing.length) throw new Error(`German full catalog is incomplete: ${missing.length} missing: ${missing.join(", ")}`);

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[character]);
const jsonForHtml = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
const normalize = (value = "") => String(value).replace(/\s+/g, " ").trim();
const publicEntries = [];
const generatedPaths = [];

function isReviewed(entry) {
  return Boolean(reviewBySlug.get(entry.slug) && evidenceClasses.bySlug?.[entry.slug]);
}

function header(current = "biases", englishPath = "/explore/") {
  const nav = [
    ["/de/biases/", "Verzerrungen", "biases"],
    ["/de/techniques/", "Denkwerkzeuge", "techniques"]
  ].map(([href,label,key]) => `<a href="${href}"${current === key ? ' aria-current="page"' : ""}>${label}</a>`).join("");
  return `<header class="site-header"><a class="brand" href="/de/"><picture><source srcset="/assets/brand.webp" type="image/webp"><img src="/assets/biases_icon.png" width="48" height="48" alt=""></picture><span>Cognitive<br>Biases</span></a><nav aria-label="Hauptnavigation">${nav}<a href="${escapeHtml(englishPath)}" lang="en" hreflang="en">English</a></nav></header>`;
}

function footer() {
  return `<footer class="site-footer"><div><a class="brand brand--footer" href="/de/"><picture><source srcset="/assets/brand.webp" type="image/webp"><img src="/assets/biases_icon.png" width="40" height="40" alt=""></picture><span>Cognitive Biases</span></a><p>Kognitive Verzerrungen erkennen, Aussagen prüfen und bessere Entscheidungen vorbereiten.</p></div><div class="footer-links"><a href="/de/biases/">Verzerrungen</a><a href="/de/techniques/">Denkwerkzeuge</a><a href="/about/editorial/" lang="en">Redaktion & Evidenz — English</a><a href="/methodology/" lang="en">Methodik — English</a></div><p class="fine-print">Bildungsangebot. Kein Ersatz für medizinische, rechtliche, finanzielle oder psychologische Beratung.</p></footer>`;
}

function breadcrumbs(title) {
  return `<nav class="breadcrumbs internal-breadcrumbs" aria-label="Brotkrümelnavigation"><a href="/de/">Start</a><span aria-hidden="true">/</span><a href="/de/biases/">Verzerrungen</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(title)}</span></nav>`;
}

function page({ title, description, dePath, enPath, body, schema, current = "biases" }) {
  const canonicalUrl = `${SITE}${dePath}`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${canonicalUrl}"><link rel="alternate" hreflang="de" href="${canonicalUrl}"><link rel="alternate" hreflang="en" href="${SITE}${enPath}"><link rel="alternate" hreflang="x-default" href="${SITE}${enPath}"><link rel="icon" href="/favicon.png"><meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"><meta property="og:type" content="article"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonicalUrl}"><meta property="og:locale" content="de_DE"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/de.css"><script type="application/ld+json">${jsonForHtml(schema)}</script></head><body><a class="skip" href="#main">Zum Inhalt springen</a>${header(current, enPath)}<main id="main">${body}</main>${footer()}</body></html>`;
}

async function writePage(relativePath, html) {
  const target = join(OUT, relativePath, "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}

async function addGermanAlternate(enPath, dePath) {
  const target = join(OUT, enPath.replace(/^\//, ""), "index.html");
  try { await access(target); } catch { return false; }
  let html = await readFile(target, "utf8");
  const alt = `<link rel="alternate" hreflang="de" href="${SITE}${dePath}">`;
  if (!html.includes(alt) && html.includes("</head>")) {
    html = html.replace("</head>", `${alt}</head>`);
    await writeFile(target, html);
  }
  return true;
}

for (const canonicalEntry of canonicalPublished) {
  const de = deBySlug.get(canonicalEntry.slug);
  const reviewed = isReviewed(de);
  const review = reviewBySlug.get(de.slug);
  const evidenceClass = evidenceClasses.bySlug?.[de.slug] || null;
  const dePath = `/de/biases/${de.slug}/`;
  const enPath = `/biases/${de.slug}/`;
  const aliases = [...new Set([...(de.aliases || []), canonicalEntry.title])].filter(Boolean);
  const searchTerms = [...new Set([...(de.searchTerms || []), canonicalEntry.title, ...(de.aliases || [])])].filter(Boolean);
  const title = de.title;
  const summary = normalize(de.summary);
  const trap = normalize(de.trap);
  const actions = Array.isArray(de.actions) ? de.actions.map(normalize).filter(Boolean) : [];
  if (!title || !summary || !trap || actions.length < 3) throw new Error(`${de.slug}: incomplete German editorial localization.`);
  if (!(await addGermanAlternate(enPath, dePath))) throw new Error(`${de.slug}: canonical English page is missing.`);

  const statusLabel = reviewed ? "Evidence-reviewed" : "Redaktionell lokalisiert";
  const evidenceBlock = reviewed
    ? `<section class="section"><p class="kicker">Evidenzstatus</p><h2>Separater Evidence Review vorhanden</h2><p>Für dieses Konzept führt das Projekt einen eigenen wissenschaftlichen Review mit kontrollierter Evidenzklasse <strong>${escapeHtml(evidenceClass)}</strong>. Die deutsche Erklärung bleibt bewusst innerhalb dieser Grenze.</p>${review?.qualification ? `<p class="fine-print">Für Quellen, Methodik und die vollständige Forschungsqualifikation nutze den kanonischen Review.</p>` : ""}<p><a href="${enPath}#evidence" lang="en">Vollständiger Evidence Review — English →</a></p></section>`
    : `<section class="section"><p class="kicker">Evidenzgrenze</p><h2>Redaktionelle Lokalisierung, kein separater Evidence Review</h2><p>Diese Seite lokalisiert einen veröffentlichten Eintrag des kanonischen Cognitive-Biases-Katalogs. Für dieses Konzept führt das Projekt derzeit keinen eigenen kontrollierten Evidence Review. Die Seite erklärt den bestehenden Katalogeintrag, erhöht aber seinen wissenschaftlichen Status nicht.</p><p><a href="${enPath}" lang="en">Kanonischen Eintrag auf Englisch öffnen →</a></p></section>`;

  const body = `${breadcrumbs(title)}<section class="page-hero"><p class="eyebrow">${statusLabel} · ${escapeHtml(canonicalEntry.typeOfBias || "Cognitive Bias")}</p><h1>${escapeHtml(title)}</h1><p class="lede">${escapeHtml(summary)}</p><p class="fine-print"><span lang="en">Canonical name: ${escapeHtml(canonicalEntry.title)}</span>${de.aliases?.length ? ` · Deutsche/übliche Varianten: ${escapeHtml(de.aliases.join(" · "))}` : ""}</p></section><section class="section"><p class="kicker">Was passiert?</p><h2>Woran du das Muster erkennen kannst</h2><p>${escapeHtml(trap)}</p></section><section class="section section--ink"><p class="kicker">Probier das</p><h2>Drei konkrete Gegenprüfungen</h2><ul>${actions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul><p class="fine-print">Diese Schritte sind Prüffragen, keine Garantie gegen einen Bias und keine Diagnose einer Person.</p></section>${evidenceBlock}`;
  const schema = {
    "@context":"https://schema.org",
    "@graph":[
      {"@type":"DefinedTerm","@id":`${SITE}${dePath}#term`,identifier:de.slug,url:`${SITE}${dePath}`,name:title,alternateName:aliases,description:summary,inDefinedTermSet:`${SITE}/de/biases/`,sameAs:`${SITE}${enPath}`},
      {"@type":"BreadcrumbList",itemListElement:[
        {"@type":"ListItem",position:1,name:"Cognitive Biases",item:`${SITE}/de/`},
        {"@type":"ListItem",position:2,name:"Kognitive Verzerrungen",item:`${SITE}/de/biases/`},
        {"@type":"ListItem",position:3,name:title,item:`${SITE}${dePath}`}
      ]}
    ]
  };
  await writePage(`de/biases/${de.slug}`, page({ title:`${title}: Erklärung & Gegenprüfung | Cognitive Biases`, description:summary.slice(0,205), dePath, enPath, body, schema }));
  generatedPaths.push(dePath);
  publicEntries.push({
    slug:de.slug,
    title,
    englishTitle:canonicalEntry.title,
    aliases:de.aliases || [],
    searchTerms,
    summary,
    trap,
    actions,
    localizationState: reviewed ? "evidence-reviewed" : "editorial-localization",
    evidenceClass,
    canonicalStatus:canonicalEntry.status || null,
    canonicalCategory:canonicalEntry.typeOfBias || null,
    canonicalUrl:`${SITE}${enPath}`,
    updatedAt:TODAY
  });
}

const cards = publicEntries.map((entry) => `<article class="practice-set-card" data-de-filter-item data-search="${escapeHtml([entry.title,entry.englishTitle,...entry.aliases,...entry.searchTerms].join(" "))}"><p class="kicker">${entry.localizationState === "evidence-reviewed" ? "Evidence-reviewed" : "Redaktionell lokalisiert"}</p><h2><a href="/de/biases/${entry.slug}/">${escapeHtml(entry.title)}</a></h2><p>${escapeHtml(entry.summary)}</p><p class="fine-print" lang="en">${escapeHtml(entry.englishTitle)}</p></article>`).join("");
const reviewedCount = publicEntries.filter((entry) => entry.localizationState === "evidence-reviewed").length;
const editorialCount = publicEntries.length - reviewedCount;
const indexSchema = {"@context":"https://schema.org","@type":"CollectionPage",name:"Kognitive Verzerrungen auf Deutsch",description:`${publicEntries.length} veröffentlichte kanonische Konzepte auf Deutsch.`,inLanguage:"de",mainEntity:{"@type":"ItemList",numberOfItems:publicEntries.length,itemListElement:publicEntries.map((entry,index)=>({"@type":"ListItem",position:index+1,name:entry.title,url:`${SITE}/de/biases/${entry.slug}/`}))}};
const indexBody = `<nav class="breadcrumbs internal-breadcrumbs" aria-label="Brotkrümelnavigation"><a href="/de/">Start</a><span aria-hidden="true">/</span><span aria-current="page">Verzerrungen</span></nav><section class="page-hero"><p class="eyebrow">Vollständiger deutscher Katalog</p><h1>Alle veröffentlichten Bias-Konzepte auf Deutsch.</h1><p class="lede">${publicEntries.length} kanonische Einträge, einheitliche Slugs und klare Qualitätsgrenzen. ${reviewedCount} Einträge haben einen eigenen kontrollierten Evidence Review; ${editorialCount} weitere sind hochwertige redaktionelle Lokalisierungen des bestehenden Katalogs.</p><p class="fine-print">„Redaktionell lokalisiert“ bedeutet: vollständig auf Deutsch erklärt, aber nicht automatisch wissenschaftlich aufgewertet. Wo ein eigener Evidence Review existiert, ist das sichtbar markiert.</p></section><section class="section"><div class="de-filter" data-de-filter><label for="de-bias-search"><strong>Verzerrung suchen</strong></label><input id="de-bias-search" type="search" inputmode="search" autocomplete="off" placeholder="z. B. Bestätigungsfehler, Halo-Effekt, confirmation bias" data-de-filter-input><p class="fine-print" data-de-filter-count>Insgesamt: ${publicEntries.length}</p><div class="practice-set-grid" data-de-filter-list>${cards}</div><p class="fine-print" data-de-filter-empty hidden>Keine passende Verzerrung gefunden.</p></div></section>`;
const indexHtml = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>Alle kognitiven Verzerrungen auf Deutsch | Cognitive Biases</title><meta name="description" content="Vollständiger deutscher Katalog aller veröffentlichten Cognitive-Biases-Einträge mit klaren Evidence-Grenzen und praktischen Gegenprüfungen."><link rel="canonical" href="${SITE}/de/biases/"><link rel="alternate" hreflang="de" href="${SITE}/de/biases/"><link rel="icon" href="/favicon.png"><meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="Alle kognitiven Verzerrungen auf Deutsch"><meta property="og:description" content="${publicEntries.length} veröffentlichte kanonische Konzepte auf Deutsch."><meta property="og:url" content="${SITE}/de/biases/"><meta property="og:locale" content="de_DE"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/de.css"><script type="application/ld+json">${jsonForHtml(indexSchema)}</script></head><body><a class="skip" href="#main">Zum Inhalt springen</a>${header("biases","/explore/")}<main id="main">${indexBody}</main>${footer()}<script src="/de-interface.js" defer></script></body></html>`;
await writePage("de/biases", indexHtml);
generatedPaths.push("/de/biases/");

await mkdir(join(OUT,"data","de"),{recursive:true});
await writeFile(join(OUT,"data","de","biases.json"),JSON.stringify({version:2,locale:"de",state:"full-catalog-localization",updatedAt:TODAY,canonicalLocale:"en",canonicalPublishedCount:canonicalPublished.length,reviewedCount,editorialLocalizationCount:editorialCount,entries:publicEntries},null,2)+"\n");

const sitemapPath = join(OUT,"sitemap.xml");
let sitemap = await readFile(sitemapPath,"utf8");
for (const path of generatedPaths) {
  const url = `${SITE}${path}`;
  if (!sitemap.includes(`<loc>${url}</loc>`)) sitemap = sitemap.replace("</urlset>",`  <url><loc>${url}</loc></url>\n</urlset>`);
}
await writeFile(sitemapPath,sitemap);

console.log(`Generated complete German bias catalog: ${publicEntries.length}/${canonicalPublished.length} canonical published concepts (${reviewedCount} evidence-reviewed, ${editorialCount} editorial localizations).`);
