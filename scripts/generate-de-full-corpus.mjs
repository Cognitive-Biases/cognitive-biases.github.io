import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const TODAY = "2026-09-13";

const canonical = JSON.parse(await readFile("data/biases.json", "utf8"));
const published = canonical.filter((entry) => entry.published !== false && entry.slug);
const publishedSlugs = new Set(published.map((entry) => entry.slug));

const corpusNames = (await readdir("data/de")).filter((name) => /^biases-corpus-\d+\.json$/i.test(name)).sort();
const corpusDocs = await Promise.all(corpusNames.map(async (name) => JSON.parse(await readFile(join("data/de", name), "utf8"))));
const corpusEntries = corpusDocs.flatMap((doc) => doc.entries || []);
const corpusBySlug = new Map(corpusEntries.map((entry) => [entry.slug, entry]));

const reviewedBase = JSON.parse(await readFile("data/de/biases.json", "utf8"));
const reviewedExpansionNames = (await readdir("data/de")).filter((name) => /^biases-reviewed-expansion-\d+\.json$/i.test(name)).sort();
const reviewedExpansionDocs = await Promise.all(reviewedExpansionNames.map(async (name) => JSON.parse(await readFile(join("data/de", name), "utf8"))));
const reviewedEntries = [...(reviewedBase.entries || []), ...reviewedExpansionDocs.flatMap((doc) => doc.entries || [])];
const reviewedBySlug = new Map(reviewedEntries.map((entry) => [entry.slug, entry]));

const evidenceClasses = JSON.parse(await readFile("data/evidence-classes.json", "utf8"));
const evidenceNames = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name)).sort();
const evidenceDocs = await Promise.all(evidenceNames.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const reviewBySlug = new Map(evidenceDocs.flatMap((doc) => doc.reviews || []).map((review) => [review.slug, review]));

const failures = [];
const seen = new Set();
for (const entry of corpusEntries) {
  if (seen.has(entry.slug)) failures.push(`Duplicate German corpus slug: ${entry.slug}`);
  seen.add(entry.slug);
}
for (const slug of publishedSlugs) if (!corpusBySlug.has(slug)) failures.push(`Missing German corpus entry: ${slug}`);
for (const slug of corpusBySlug.keys()) if (!publishedSlugs.has(slug)) failures.push(`German corpus contains non-public slug: ${slug}`);
if (failures.length) throw new Error(`German full-corpus generation blocked:\n${failures.join("\n")}`);

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);
const jsonForHtml = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
const normalizePath = (value) => value.endsWith("/") ? value : `${value}/`;

const evidenceClassLabels = {
  established: "Gut belegt",
  supported: "Durch Forschung gestützt",
  mixed: "Gemischte Evidenz",
  contested: "Umstritten",
  "domain-specific": "Auf einen Bereich begrenzt",
  concept: "Geprüftes Konzept"
};

function header(current = "biases", englishPath = "/") {
  const link = (href, label, key) => `<a href="${href}"${current === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<header class="site-header"><a class="brand" href="/de/"><picture><source srcset="/assets/brand.webp" type="image/webp"><img src="/assets/biases_icon.png" width="48" height="48" alt=""></picture><span>Cognitive<br>Biases</span></a><nav aria-label="Hauptnavigation">${link("/de/biases/", "Verzerrungen", "biases")}${link("/de/techniques/", "Denkwerkzeuge", "techniques")}${link("/de/entscheidungen/", "Situationen", "decisions")}<a href="${escapeHtml(englishPath)}" lang="en" hreflang="en">English</a></nav></header>`;
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

function alternates(dePath, enPath = null) {
  const self = `<link rel="alternate" hreflang="de" href="${SITE}${dePath}">`;
  if (!enPath) return self;
  return `${self}<link rel="alternate" hreflang="en" href="${SITE}${enPath}"><link rel="alternate" hreflang="x-default" href="${SITE}${enPath}">`;
}

function page({ title, description, dePath, enPath = null, body, schema, current = "biases" }) {
  const canonicalUrl = `${SITE}${dePath}`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${canonicalUrl}">${alternates(dePath, enPath)}<link rel="icon" href="/favicon.png"><meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonicalUrl}"><meta property="og:locale" content="de_DE"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/de.css"><script type="application/ld+json">${jsonForHtml(schema)}</script></head><body><a class="skip" href="#main">Zum Inhalt springen</a>${header(current, enPath || "/explore/")}<main id="main">${body}</main>${footer()}${body.includes("data-de-filter") ? '<script src="/de-interface.js" defer></script>' : ""}</body></html>`;
}

async function writePage(relativePath, html) {
  const target = join(OUT, relativePath, "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}

async function addEnglishAlternate(slug) {
  const dePath = `/de/biases/${slug}/`;
  const target = join(OUT, "biases", slug, "index.html");
  try { await access(target); } catch { return false; }
  let html = await readFile(target, "utf8");
  const alternate = `<link rel="alternate" hreflang="de" href="${SITE}${dePath}">`;
  if (!html.includes(alternate)) {
    if (!html.includes("</head>")) throw new Error(`${target}: missing </head>.`);
    html = html.replace("</head>", `${alternate}</head>`);
    await writeFile(target, html);
  }
  return true;
}

const publicEntries = [];
const generatedPaths = [];
let reviewedCount = 0;
let reviewedCanonicalOnlyCount = 0;
let legacyCount = 0;

for (const source of published) {
  const slug = source.slug;
  const corpus = corpusBySlug.get(slug);
  const reviewed = reviewedBySlug.get(slug);
  const review = reviewBySlug.get(slug);
  const evidenceClass = evidenceClasses.bySlug?.[slug] || null;
  const enPath = `/biases/${slug}/`;
  const dePath = `/de/biases/${slug}/`;
  const hasEnglish = await addEnglishAlternate(slug);
  if (!hasEnglish) throw new Error(`Published canonical English page is missing for ${slug}.`);

  if (reviewed) {
    reviewedCount += 1;
    publicEntries.push({
      ...reviewed,
      localizationState: "reviewed-evidence",
      evidenceReviewAvailable: true,
      evidenceClass,
      canonicalUrl: `${SITE}${enPath}`,
      germanUrl: `${SITE}${dePath}`
    });
    continue;
  }

  const hasCanonicalReview = Boolean(review);
  if (hasCanonicalReview) reviewedCanonicalOnlyCount += 1;
  else legacyCount += 1;

  const aliases = [...new Set([...(corpus.aliases || []), corpus.englishTitle].filter(Boolean))];
  const statusLabel = hasCanonicalReview
    ? `Deutsche Lokalisierung · ${evidenceClassLabels[evidenceClass] || "Kanonischer Evidence Review vorhanden"}`
    : "Deutsche Lokalisierung · Noch kein kontrollierter Evidence Review";
  const evidenceCopy = hasCanonicalReview
    ? "Für dieses kanonische Konzept führt das Projekt einen kontrollierten Evidence Review. Diese deutsche Seite lokalisiert Definition und praktische Prüffragen, hebt den wissenschaftlichen Status aber nicht an. Für Beleglage, Quellen und genaue Grenzen nutze den kanonischen Review."
    : "Für diesen kanonischen Eintrag gibt es im Projekt derzeit noch keinen kontrollierten Evidence Review. Die deutsche Seite lokalisiert Begriff, Bedeutung und praktische Prüffragen. Sie bestätigt nicht automatisch Stärke, Allgemeingültigkeit, Ursache oder Wirksamkeit des Effekts.";
  const boundaryCopy = "Nutze den Begriff als Prüflinse, nicht als Diagnose einer Person und nicht als Beweis dafür, dass dieser Mechanismus eine konkrete Entscheidung verursacht hat. Kontext, Messung, Alternativerklärungen und Datenqualität bleiben entscheidend.";

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "DefinedTerm",
        "@id": `${SITE}${dePath}#term`,
        identifier: slug,
        url: `${SITE}${dePath}`,
        name: corpus.title,
        alternateName: aliases,
        description: corpus.summary,
        inDefinedTermSet: `${SITE}/de/biases/`,
        sameAs: `${SITE}${enPath}`
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Cognitive Biases", item: `${SITE}/de/` },
          { "@type": "ListItem", position: 2, name: "Kognitive Verzerrungen", item: `${SITE}/de/biases/` },
          { "@type": "ListItem", position: 3, name: corpus.title, item: `${SITE}${dePath}` }
        ]
      }
    ]
  };

  const aliasLine = aliases.length ? `<p class="fine-print de-aliases">Auch gesucht als: ${aliases.map(escapeHtml).join(" · ")}</p>` : "";
  const actions = `<ul>${corpus.actions.map((action) => `<li>${escapeHtml(action)}</li>`).join("")}</ul>`;
  const body = `${breadcrumbs([{ label: "Start", href: "/de/" }, { label: "Verzerrungen", href: "/de/biases/" }, { label: corpus.title }])}<section class="page-hero"><p class="eyebrow">${escapeHtml(statusLabel)}</p><h1>${escapeHtml(corpus.title)}</h1><p class="lede">${escapeHtml(corpus.summary)}</p>${aliasLine}</section><section class="section"><p class="kicker">Was passiert?</p><h2>Woran du das Muster erkennen kannst</h2><p>${escapeHtml(corpus.trap)}</p></section><section class="section section--ink"><p class="kicker">Probier das</p><h2>Mach die nächste Prüfung konkreter</h2>${actions}<p class="fine-print">Die Prüffragen reduzieren keine Verzerrung garantiert. Sie machen Annahmen, Vergleichsdaten und Alternativerklärungen sichtbarer.</p></section><section class="section"><p class="kicker">Evidenzstatus</p><h2>${hasCanonicalReview ? "Kanonischer Review vorhanden" : "Lokalisierung ohne kontrollierten Review"}</h2><p>${escapeHtml(evidenceCopy)}</p><h3>Grenzen</h3><p>${escapeHtml(boundaryCopy)}</p><p><a href="${enPath}${hasCanonicalReview ? "#evidence" : ""}" lang="en">${hasCanonicalReview ? "Evidence Review — English" : "Canonical entry — English"} →</a></p></section>`;

  await writePage(`de/biases/${slug}`, page({
    title: `${corpus.title}: Bedeutung und praktische Prüfung | Cognitive Biases`,
    description: `${corpus.summary} Deutsche Erklärung, konkrete Prüffragen und transparenter Evidenzstatus.`,
    dePath,
    enPath,
    body,
    schema
  }));
  generatedPaths.push(dePath);
  publicEntries.push({
    ...corpus,
    localizationState: hasCanonicalReview ? "localized-with-canonical-review" : "localized-legacy",
    evidenceReviewAvailable: hasCanonicalReview,
    evidenceClass,
    boundary: boundaryCopy,
    canonicalUrl: `${SITE}${enPath}`,
    germanUrl: `${SITE}${dePath}`
  });
}

const cards = publicEntries.map((entry) => {
  const reviewed = entry.localizationState === "reviewed-evidence";
  const reviewAvailable = entry.evidenceReviewAvailable;
  const status = reviewed ? "Geprüfter deutscher Evidence Layer" : reviewAvailable ? "Deutsche Lokalisierung · Review vorhanden" : "Deutsche Lokalisierung · Review ausstehend";
  const search = [entry.title, entry.englishTitle, ...(entry.aliases || []), ...(entry.searchTerms || []), entry.category || "", entry.summary || ""].join(" ");
  return `<article class="practice-set-card" data-de-filter-item data-search="${escapeHtml(search)}"><p class="kicker">${escapeHtml(status)}</p><h2><a href="/de/biases/${entry.slug}/">${escapeHtml(entry.title)}</a></h2><p>${escapeHtml(entry.summary)}</p><p class="fine-print" lang="en">${escapeHtml(entry.englishTitle || "")}</p></article>`;
}).join("");

const indexPath = "/de/biases/";
const indexSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Kognitive Verzerrungen und verwandte Entscheidungseffekte",
  description: "Vollständige deutsche Darstellung aller veröffentlichten kanonischen Einträge mit transparentem Evidenzstatus.",
  inLanguage: "de",
  mainEntity: {
    "@type": "ItemList",
    numberOfItems: publicEntries.length,
    itemListElement: publicEntries.map((entry, index) => ({ "@type": "ListItem", position: index + 1, name: entry.title, url: `${SITE}/de/biases/${entry.slug}/` }))
  }
};
const indexBody = `${breadcrumbs([{ label: "Start", href: "/de/" }, { label: "Verzerrungen" }])}<section class="page-hero"><p class="eyebrow">Vollständiger deutscher Kanon</p><h1>Alle veröffentlichten Bias-Einträge auf Deutsch.</h1><p class="lede">Die komplette kanonische Bibliothek ist auf Deutsch auffindbar. Der Evidenzstatus bleibt sichtbar: vollständig geprüfte deutsche Reviews werden klar von lokalisierten Legacy-Einträgen getrennt.</p><p class="fine-print">${reviewedCount} Einträge haben einen vollständig geprüften deutschen Evidence Layer. Weitere Einträge sind hochwertig lokalisiert; bei ihnen zeigt die Seite transparent, ob bereits ein kanonischer Review existiert.</p></section><section class="section"><div class="de-filter" data-de-filter><label for="de-bias-search"><strong>Verzerrung oder Effekt suchen</strong></label><input id="de-bias-search" type="search" inputmode="search" autocomplete="off" placeholder="z. B. Bestätigungsfehler, Confirmation Bias, Gedächtnis, Groupthink" data-de-filter-input><p class="fine-print" data-de-filter-count>Insgesamt: ${publicEntries.length}</p><div class="practice-set-grid" data-de-filter-list>${cards}</div><p class="fine-print" data-de-filter-empty hidden>Kein passender Eintrag gefunden.</p></div></section><section class="section section--ink"><p class="kicker">Warum zwei Evidenzstufen?</p><h2>Übersetzt heißt nicht automatisch wissenschaftlich geprüft.</h2><p>Der deutsche Kanon soll vollständig sein, ohne Sicherheit vorzutäuschen. Deshalb bleiben kontrollierte Evidence Reviews und reine Lokalisierung getrennte Zustände. Fehlt ein Review, sagen wir das direkt.</p></section>`;
await writePage("de/biases", page({
  title: "Alle kognitiven Verzerrungen auf Deutsch | Cognitive Biases",
  description: "Vollständige deutsche Bibliothek aller veröffentlichten kanonischen Bias-Einträge mit Suche, englischen Aliasen und transparentem Evidenzstatus.",
  dePath: indexPath,
  body: indexBody,
  schema: indexSchema
}));

const publicDoc = {
  version: 2,
  locale: "de",
  state: "full-canonical-localization",
  updatedAt: TODAY,
  canonicalLocale: "en",
  coverage: {
    publishedCanonical: published.length,
    localized: publicEntries.length,
    reviewedGerman: reviewedCount,
    localizedWithCanonicalReview: reviewedCanonicalOnlyCount,
    localizedLegacy: legacyCount
  },
  entries: publicEntries
};
await mkdir(join(OUT, "data", "de"), { recursive: true });
await writeFile(join(OUT, "data", "de", "biases.json"), JSON.stringify(publicDoc, null, 2) + "\n");

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
for (const source of published) {
  const url = `${SITE}${normalizePath(`/de/biases/${source.slug}/`)}`;
  if (!sitemap.includes(`<loc>${url}</loc>`)) sitemap = sitemap.replace("</urlset>", `  <url><loc>${url}</loc></url>\n</urlset>`);
}
if (!sitemap.includes(`<loc>${SITE}/de/biases/</loc>`)) sitemap = sitemap.replace("</urlset>", `  <url><loc>${SITE}/de/biases/</loc></url>\n</urlset>`);
await writeFile(sitemapPath, sitemap);

console.log(`Generated full German canonical bias layer: ${publicEntries.length}/${published.length} pages (${reviewedCount} reviewed German, ${reviewedCanonicalOnlyCount} localized with canonical review, ${legacyCount} localized legacy).`);
