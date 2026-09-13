import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const TODAY = "2026-09-13";
const canonical = JSON.parse(await readFile("data/biases.json", "utf8"));
const canonicalPublished = canonical.filter((entry) => entry.published === true && entry.status !== "merged-duplicate");
const canonicalBySlug = new Map(canonicalPublished.map((entry) => [entry.slug, entry]));
const packNames = (await readdir("data/de")).filter((name) => /^biases-catalog-\d+\.json$/i.test(name)).sort();
const packs = await Promise.all(packNames.map(async (name) => JSON.parse(await readFile(join("data/de", name), "utf8"))));
const catalogEntries = packs.flatMap((doc) => doc.entries || []);
const catalogBySlug = new Map(catalogEntries.map((entry) => [entry.slug, entry]));
const existingPublic = JSON.parse(await readFile(join(OUT, "data", "de", "biases.json"), "utf8"));
const reviewedEntries = existingPublic.entries || [];
const reviewedSlugs = new Set(reviewedEntries.map((entry) => entry.slug));

const missingSource = canonicalPublished.filter((entry) => !reviewedSlugs.has(entry.slug) && !catalogBySlug.has(entry.slug));
if (missingSource.length) throw new Error(`German catalog source incomplete: ${missingSource.length} canonical slugs missing.`);

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const jsonForHtml = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
const normalize = (value = "") => String(value).replace(/\s+/g, " ").trim();

function header(enPath = "/explore/") {
  return `<header class="site-header"><a class="brand" href="/de/"><picture><source srcset="/assets/brand.webp" type="image/webp"><img src="/assets/biases_icon.png" width="48" height="48" alt=""></picture><span>Cognitive<br>Biases</span></a><nav aria-label="Hauptnavigation"><a href="/de/biases/" aria-current="page">Verzerrungen</a><a href="/de/techniques/">Denkwerkzeuge</a><a href="${escapeHtml(enPath)}" lang="en" hreflang="en">English</a></nav></header>`;
}
function footer() {
  return `<footer class="site-footer"><div><a class="brand brand--footer" href="/de/"><picture><source srcset="/assets/brand.webp" type="image/webp"><img src="/assets/biases_icon.png" width="40" height="40" alt=""></picture><span>Cognitive Biases</span></a><p>Kognitive Verzerrungen erkennen, Aussagen prüfen und bessere Entscheidungen vorbereiten.</p></div><div class="footer-links"><a href="/de/biases/">Verzerrungen</a><a href="/de/techniques/">Denkwerkzeuge</a><a href="/about/editorial/" lang="en">Redaktion & Evidenz — English</a><a href="/methodology/" lang="en">Methodik — English</a></div><p class="fine-print">Bildungsangebot. Kein Ersatz für medizinische, rechtliche, finanzielle oder psychologische Beratung.</p></footer>`;
}
async function writePage(relativePath, html) {
  const target = join(OUT, relativePath, "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}
async function addGermanAlternate(enPath, dePath) {
  const target = join(OUT, enPath.replace(/^\//, ""), "index.html");
  await access(target);
  let html = await readFile(target, "utf8");
  const alt = `<link rel="alternate" hreflang="de" href="${SITE}${dePath}">`;
  if (!html.includes(alt)) {
    if (!html.includes("</head>")) throw new Error(`${enPath}: missing head.`);
    html = html.replace("</head>", `${alt}</head>`);
    await writeFile(target, html);
  }
}

const editorialPublic = [];
for (const canonicalEntry of canonicalPublished) {
  if (reviewedSlugs.has(canonicalEntry.slug)) continue;
  const de = catalogBySlug.get(canonicalEntry.slug);
  if (!de) throw new Error(`${canonicalEntry.slug}: missing German editorial entry.`);
  const title = normalize(de.title);
  const summary = normalize(de.summary);
  const trap = normalize(de.trap);
  const actions = Array.isArray(de.actions) ? de.actions.map(normalize).filter(Boolean) : [];
  if (!title || !summary || !trap || actions.length < 3) throw new Error(`${de.slug}: incomplete German localization.`);
  const enPath = `/biases/${de.slug}/`;
  const dePath = `/de/biases/${de.slug}/`;
  await addGermanAlternate(enPath, dePath);
  const aliases = [...new Set([...(de.aliases || []), canonicalEntry.title])].filter(Boolean);
  const schema = {"@context":"https://schema.org","@graph":[{"@type":"DefinedTerm","@id":`${SITE}${dePath}#term`,identifier:de.slug,url:`${SITE}${dePath}`,name:title,alternateName:aliases,description:summary,inDefinedTermSet:`${SITE}/de/biases/`,sameAs:`${SITE}${enPath}`},{"@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Cognitive Biases",item:`${SITE}/de/`},{"@type":"ListItem",position:2,name:"Kognitive Verzerrungen",item:`${SITE}/de/biases/`},{"@type":"ListItem",position:3,name:title,item:`${SITE}${dePath}`}]}]};
  const body = `<nav class="breadcrumbs internal-breadcrumbs" aria-label="Brotkrümelnavigation"><a href="/de/">Start</a><span aria-hidden="true">/</span><a href="/de/biases/">Verzerrungen</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(title)}</span></nav><section class="page-hero"><p class="eyebrow">Redaktionell lokalisiert · ${escapeHtml(canonicalEntry.typeOfBias || "Cognitive Bias")}</p><h1>${escapeHtml(title)}</h1><p class="lede">${escapeHtml(summary)}</p><p class="fine-print"><span lang="en">Canonical name: ${escapeHtml(canonicalEntry.title)}</span>${de.aliases?.length ? ` · Varianten: ${escapeHtml(de.aliases.join(" · "))}` : ""}</p></section><section class="section"><p class="kicker">Was passiert?</p><h2>Woran du das Muster erkennen kannst</h2><p>${escapeHtml(trap)}</p></section><section class="section section--ink"><p class="kicker">Probier das</p><h2>Drei konkrete Gegenprüfungen</h2><ul>${actions.map((item)=>`<li>${escapeHtml(item)}</li>`).join("")}</ul><p class="fine-print">Prüffragen, keine Diagnose und keine Garantie gegen einen Bias.</p></section><section class="section"><p class="kicker">Evidenzgrenze</p><h2>Vollständig auf Deutsch, wissenschaftlicher Status unverändert</h2><p>Diese Seite lokalisiert einen veröffentlichten Eintrag des kanonischen Katalogs. Für diesen Eintrag gehört im deutschen Reviewed-Layer derzeit kein eigener vollständiger Evidence Review zur Seite. Die Lokalisierung erhöht den wissenschaftlichen Status des ursprünglichen Eintrags nicht.</p><p><a href="${enPath}" lang="en">Kanonischen Eintrag auf Englisch öffnen →</a></p></section>`;
  const description = summary.length > 205 ? `${summary.slice(0,202).replace(/\s+\S*$/, "")}…` : summary;
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${escapeHtml(title)}: Erklärung & Gegenprüfung | Cognitive Biases</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${SITE}${dePath}"><link rel="alternate" hreflang="de" href="${SITE}${dePath}"><link rel="alternate" hreflang="en" href="${SITE}${enPath}"><link rel="alternate" hreflang="x-default" href="${SITE}${enPath}"><link rel="icon" href="/favicon.png"><meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"><meta property="og:type" content="article"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${SITE}${dePath}"><meta property="og:locale" content="de_DE"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/de.css"><script type="application/ld+json">${jsonForHtml(schema)}</script></head><body><a class="skip" href="#main">Zum Inhalt springen</a>${header(enPath)}<main id="main">${body}</main>${footer()}</body></html>`;
  await writePage(`de/biases/${de.slug}`, html);
  editorialPublic.push({slug:de.slug,title,englishTitle:canonicalEntry.title,aliases:de.aliases || [],searchTerms:[...(de.searchTerms || []),canonicalEntry.title],summary,trap,actions,localizationState:"editorial-localization",evidenceClass:null,canonicalStatus:canonicalEntry.status || null,canonicalCategory:canonicalEntry.typeOfBias || null,canonicalUrl:`${SITE}${enPath}`,updatedAt:TODAY});
}

const normalizedReviewed = reviewedEntries.filter((entry) => canonicalBySlug.has(entry.slug)).map((entry) => ({...entry,localizationState:"evidence-reviewed",canonicalStatus:canonicalBySlug.get(entry.slug)?.status || null,canonicalCategory:canonicalBySlug.get(entry.slug)?.typeOfBias || null,canonicalUrl:`${SITE}/biases/${entry.slug}/`}));
const allEntries = [...normalizedReviewed, ...editorialPublic].sort((a,b) => a.title.localeCompare(b.title,"de"));
if (allEntries.length !== canonicalPublished.length) throw new Error(`Public German catalog mismatch: ${allEntries.length}/${canonicalPublished.length}.`);

const cards = allEntries.map((entry)=>`<article class="practice-set-card" data-de-filter-item data-search="${escapeHtml([entry.title,entry.englishTitle,...(entry.aliases||[]),...(entry.searchTerms||[])].join(" "))}"><p class="kicker">${entry.localizationState === "evidence-reviewed" ? "Evidence-reviewed" : "Redaktionell lokalisiert"}</p><h2><a href="/de/biases/${entry.slug}/">${escapeHtml(entry.title)}</a></h2><p>${escapeHtml(entry.summary)}</p><p class="fine-print" lang="en">${escapeHtml(entry.englishTitle)}</p></article>`).join("");
const reviewedCount = normalizedReviewed.length;
const editorialCount = editorialPublic.length;
const indexSchema = {"@context":"https://schema.org","@type":"CollectionPage",name:"Alle kognitiven Verzerrungen auf Deutsch",description:`${allEntries.length} veröffentlichte kanonische Konzepte auf Deutsch.`,inLanguage:"de",mainEntity:{"@type":"ItemList",numberOfItems:allEntries.length,itemListElement:allEntries.map((entry,index)=>({"@type":"ListItem",position:index+1,name:entry.title,url:`${SITE}/de/biases/${entry.slug}/`}))}};
const indexBody = `<nav class="breadcrumbs internal-breadcrumbs" aria-label="Brotkrümelnavigation"><a href="/de/">Start</a><span aria-hidden="true">/</span><span aria-current="page">Verzerrungen</span></nav><section class="page-hero"><p class="eyebrow">Vollständiger deutscher Katalog</p><h1>Alle veröffentlichten Bias-Konzepte auf Deutsch.</h1><p class="lede">${allEntries.length} kanonische Einträge, einheitliche Slugs und klare Qualitätsgrenzen. ${reviewedCount} Seiten gehören zum deutschen Evidence-Reviewed-Layer; ${editorialCount} weitere sind hochwertige redaktionelle Lokalisierungen des bestehenden Katalogs.</p><p class="fine-print">Vollständige Lokalisierung bedeutet nicht, dass jeder historische Katalogeintrag denselben Forschungsstatus hat. Genau diese Grenze bleibt auf jeder Seite sichtbar.</p></section><section class="section"><div class="de-filter" data-de-filter><label for="de-bias-search"><strong>Verzerrung suchen</strong></label><input id="de-bias-search" type="search" inputmode="search" autocomplete="off" placeholder="z. B. Halo-Effekt, Basisratenfehler, confirmation bias" data-de-filter-input><p class="fine-print" data-de-filter-count>Insgesamt: ${allEntries.length}</p><div class="practice-set-grid" data-de-filter-list>${cards}</div><p class="fine-print" data-de-filter-empty hidden>Keine passende Verzerrung gefunden.</p></div></section>`;
const indexHtml = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>Alle kognitiven Verzerrungen auf Deutsch | Cognitive Biases</title><meta name="description" content="Vollständiger deutscher Katalog aller veröffentlichten Cognitive-Biases-Einträge mit Qualitätsgrenzen und praktischen Gegenprüfungen."><link rel="canonical" href="${SITE}/de/biases/"><link rel="alternate" hreflang="de" href="${SITE}/de/biases/"><link rel="icon" href="/favicon.png"><meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="Alle kognitiven Verzerrungen auf Deutsch"><meta property="og:description" content="${allEntries.length} veröffentlichte kanonische Konzepte auf Deutsch."><meta property="og:url" content="${SITE}/de/biases/"><meta property="og:locale" content="de_DE"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/de.css"><script type="application/ld+json">${jsonForHtml(indexSchema)}</script></head><body><a class="skip" href="#main">Zum Inhalt springen</a>${header("/explore/")}<main id="main">${indexBody}</main>${footer()}<script src="/de-interface.js" defer></script></body></html>`;
await writePage("de/biases",indexHtml);
await writeFile(join(OUT,"data","de","biases.json"),JSON.stringify({version:2,locale:"de",state:"full-catalog-localization",updatedAt:TODAY,canonicalLocale:"en",canonicalPublishedCount:canonicalPublished.length,reviewedCount,editorialLocalizationCount:editorialCount,entries:allEntries},null,2)+"\n");

let sitemap = await readFile(join(OUT,"sitemap.xml"),"utf8");
for (const entry of allEntries) {
  const url = `${SITE}/de/biases/${entry.slug}/`;
  if (!sitemap.includes(`<loc>${url}</loc>`)) sitemap = sitemap.replace("</urlset>",`  <url><loc>${url}</loc></url>\n</urlset>`);
}
await writeFile(join(OUT,"sitemap.xml"),sitemap);
console.log(`Expanded German catalog to ${allEntries.length}/${canonicalPublished.length}: ${reviewedCount} reviewed pages preserved, ${editorialCount} catalog pages added.`);
