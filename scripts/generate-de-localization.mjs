import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const TODAY = "2026-09-13";

const baseBiasesDoc = JSON.parse(await readFile("data/de/biases.json", "utf8"));
const expansionNames = (await readdir("data/de"))
  .filter((name) => /^biases-reviewed-expansion-\d+\.json$/i.test(name))
  .sort();
const expansionDocs = await Promise.all(expansionNames.map(async (name) => JSON.parse(await readFile(join("data/de", name), "utf8"))));
const techniquesDoc = JSON.parse(await readFile("data/de/techniques.json", "utf8"));
const sourceTechniquesDoc = JSON.parse(await readFile("data/techniques.json", "utf8"));
const evidenceClassesDoc = JSON.parse(await readFile("data/evidence-classes.json", "utf8"));
const evidenceFiles = (await readdir("data"))
  .filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name))
  .sort();
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const reviewBySlug = new Map(evidenceDocs.flatMap((doc) => doc.reviews || []).map((review) => [review.slug, review]));

for (const [name, doc] of [["data/de/biases.json", baseBiasesDoc], ...expansionDocs.map((doc, index) => [`data/de/${expansionNames[index]}`, doc]), ["data/de/techniques.json", techniquesDoc]]) {
  if (doc.locale !== "de" || doc.state !== "reviewed") throw new Error(`${name} must be locale=de and state=reviewed.`);
}

const biases = [...(baseBiasesDoc.entries || []), ...expansionDocs.flatMap((doc) => doc.entries || [])];
const techniques = techniquesDoc.techniques || [];
const biasBySlug = new Map(biases.map((entry) => [entry.slug, entry]));
const sourceTechniqueBySlug = new Map((sourceTechniquesDoc.techniques || []).map((entry) => [entry.slug, entry]));

const evidenceClassLabels = {
  established: "Gut belegt",
  supported: "Durch Forschung gestützt",
  mixed: "Gemischte Evidenz",
  contested: "Umstritten",
  "domain-specific": "Auf einen Bereich begrenzt",
  concept: "Geprüftes Konzept"
};

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);
const jsonForHtml = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
const normalizePath = (value) => value.endsWith("/") ? value : `${value}/`;

function header(current = "", englishPath = "/") {
  const link = (href, label, key) => `<a href="${href}"${current === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<header class="site-header"><a class="brand" href="/de/"><picture><source srcset="/assets/brand.webp" type="image/webp"><img src="/assets/biases_icon.png" width="48" height="48" alt=""></picture><span>Cognitive<br>Biases</span></a><nav aria-label="Hauptnavigation">${link("/de/biases/", "Verzerrungen", "biases")}${link("/de/techniques/", "Denkwerkzeuge", "techniques")}<a href="${escapeHtml(englishPath)}" lang="en" hreflang="en">English</a></nav></header>`;
}

function footer() {
  return `<footer class="site-footer"><div><a class="brand brand--footer" href="/de/"><picture><source srcset="/assets/brand.webp" type="image/webp"><img src="/assets/biases_icon.png" width="40" height="40" alt=""></picture><span>Cognitive Biases</span></a><p>Kognitive Verzerrungen erkennen, Aussagen prüfen und bessere Entscheidungen vorbereiten.</p></div><div class="footer-links"><a href="/de/biases/">Verzerrungen</a><a href="/de/techniques/">Denkwerkzeuge</a><a href="/about/editorial/" lang="en">Wie wir Inhalte prüfen — English</a><a href="/methodology/" lang="en">Methodik — English</a></div><p class="fine-print">Bildungsangebot. Kein Ersatz für medizinische, rechtliche, finanzielle oder psychologische Beratung.</p></footer>`;
}

function alternates(dePath, enPath = null) {
  const self = `<link rel="alternate" hreflang="de" href="${SITE}${dePath}">`;
  if (!enPath) return self;
  return `${self}<link rel="alternate" hreflang="en" href="${SITE}${enPath}"><link rel="alternate" hreflang="x-default" href="${SITE}${enPath}">`;
}

function breadcrumbs(items) {
  return `<nav class="breadcrumbs internal-breadcrumbs" aria-label="Brotkrümelnavigation">${items.map((item, index) => {
    const separator = index ? '<span aria-hidden="true">/</span>' : "";
    return item.href ? `${separator}<a href="${item.href}">${escapeHtml(item.label)}</a>` : `${separator}<span aria-current="page">${escapeHtml(item.label)}</span>`;
  }).join("")}</nav>`;
}

function page({ title, description, dePath, enPath = null, englishPath = enPath || "/", current = "", body, schema }) {
  const canonical = `${SITE}${dePath}`;
  const filterScript = body.includes("data-de-filter") ? '<script src="/de-interface.js" defer></script>' : "";
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${canonical}">${alternates(dePath, enPath)}<link rel="icon" href="/favicon.png"><meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}"><meta property="og:locale" content="de_DE"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/de.css"><script type="application/ld+json">${jsonForHtml(schema)}</script></head><body><a class="skip" href="#main">Zum Inhalt springen</a>${header(current, englishPath)}<main id="main">${body}</main>${footer()}${filterScript}</body></html>`;
}

async function writePage(relativePath, html) {
  const target = join(OUT, relativePath, "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}

async function addEnglishAlternate(enPath, dePath) {
  const target = join(OUT, enPath.replace(/^\//, ""), "index.html");
  try { await access(target); } catch { return false; }
  let html = await readFile(target, "utf8");
  const alternate = `<link rel="alternate" hreflang="de" href="${SITE}${dePath}">`;
  if (!html.includes(alternate)) {
    if (!html.includes("</head>")) throw new Error(`${target}: missing </head> for German hreflang.`);
    html = html.replace("</head>", `${alternate}</head>`);
    await writeFile(target, html);
  }
  return true;
}

function list(items) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function filterWidget({ id, label, placeholder, countLabel, cards, emptyText }) {
  return `<div class="de-filter" data-de-filter><label for="${id}"><strong>${escapeHtml(label)}</strong></label><input id="${id}" type="search" inputmode="search" autocomplete="off" placeholder="${escapeHtml(placeholder)}" data-de-filter-input><p class="fine-print" data-de-filter-count>${escapeHtml(countLabel)}</p><div class="practice-set-grid" data-de-filter-list>${cards}</div><p class="fine-print" data-de-filter-empty hidden>${escapeHtml(emptyText)}</p></div>`;
}

const generatedPaths = [];
const localizedBiases = [];
for (const bias of biases) {
  const enPath = `/biases/${bias.slug}/`;
  const dePath = `/de/biases/${bias.slug}/`;
  if (!(await addEnglishAlternate(enPath, dePath))) {
    console.warn(`Skipping German bias without canonical English page: ${bias.slug}`);
    continue;
  }
  localizedBiases.push(bias);
  generatedPaths.push(dePath);
  const review = reviewBySlug.get(bias.slug);
  const evidenceClass = evidenceClassesDoc.bySlug?.[bias.slug];
  const classLabel = evidenceClassLabels[evidenceClass] || "Redaktionell geprüft";
  const aliases = [bias.englishTitle, ...(bias.aliases || [])].filter(Boolean);
  const relatedTechniques = techniques.filter((technique) => (technique.biases || []).includes(bias.slug));
  const sources = (review?.sources || []).map((source) => `<li><a href="${escapeHtml(source.url)}" rel="external noreferrer" lang="en">${escapeHtml(source.title)}</a>${source.year ? ` <span>· ${escapeHtml(source.year)}</span>` : ""}</li>`).join("");
  const techniqueCards = relatedTechniques.map((technique) => `<article class="practice-set-card"><p class="kicker">Denkwerkzeug</p><h3><a href="/de/techniques/${technique.slug}/">${escapeHtml(technique.title)}</a></h3><p>${escapeHtml(technique.purpose)}</p></article>`).join("");
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "DefinedTerm",
        "@id": `${SITE}${dePath}#term`,
        identifier: bias.slug,
        url: `${SITE}${dePath}`,
        name: bias.title,
        alternateName: aliases,
        description: bias.summary,
        inDefinedTermSet: `${SITE}/de/biases/`,
        sameAs: `${SITE}${enPath}`
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Cognitive Biases", item: `${SITE}/de/` },
          { "@type": "ListItem", position: 2, name: "Kognitive Verzerrungen", item: `${SITE}/de/biases/` },
          { "@type": "ListItem", position: 3, name: bias.title, item: `${SITE}${dePath}` }
        ]
      }
    ]
  };
  const aliasText = [...(bias.aliases || []), bias.englishTitle].filter(Boolean).join(" · ");
  const body = `${breadcrumbs([{ label: "Start", href: "/de/" }, { label: "Verzerrungen", href: "/de/biases/" }, { label: bias.title }])}<section class="page-hero"><p class="eyebrow">Kognitive Verzerrung · ${escapeHtml(classLabel)}</p><h1>${escapeHtml(bias.title)}</h1><p class="lede">${escapeHtml(bias.summary)}</p><p class="fine-print de-aliases">Auch gesucht als: ${escapeHtml(aliasText)}</p></section><section class="section"><p class="kicker">Was passiert?</p><h2>Woran du das Muster erkennen kannst</h2><p>${escapeHtml(bias.trap)}</p></section><section class="section section--ink"><p class="kicker">Probier das</p><h2>Mach den nächsten Schritt prüfbarer</h2>${list(bias.actions)}<p class="fine-print">Das ist kein Diagnosewerkzeug und keine Garantie gegen Denkfehler. Ziel ist ein besser prüfbarer Entscheidungsprozess.</p></section>${techniqueCards ? `<section class="section"><p class="kicker">Denkwerkzeuge</p><h2>Passende praktische Techniken</h2><div class="practice-set-grid">${techniqueCards}</div></section>` : ""}<section class="section"><p class="kicker">Warum es helfen kann</p><h2>Was die Forschung vorsichtig stützt</h2><p>${escapeHtml(bias.evidence)}</p><h3>Grenzen</h3><p>${escapeHtml(bias.boundary)}</p>${sources ? `<h3>Geprüfte Quellen</h3><ol class="evidence-sources">${sources}</ol>` : ""}<p><a href="${enPath}#evidence" lang="en">Vollständiger Evidence Review — English →</a></p></section>`;
  await writePage(`de/biases/${bias.slug}`, page({
    title: `${bias.title}: erkennen und gegenprüfen | Cognitive Biases`,
    description: `${bias.summary} Konkrete Gegenprüfung, Grenzen und Evidence Review.`,
    dePath,
    enPath,
    englishPath: enPath,
    current: "biases",
    body,
    schema
  }));
}

const localizedTechniques = [];
for (const technique of techniques) {
  const enPath = `/techniques/${technique.slug}/`;
  const dePath = `/de/techniques/${technique.slug}/`;
  const hasEnglish = await addEnglishAlternate(enPath, dePath);
  localizedTechniques.push(technique);
  generatedPaths.push(dePath);
  const related = (technique.biases || []).map((slug) => {
    const deBias = biasBySlug.get(slug);
    if (deBias) return `<li><a href="/de/biases/${slug}/">${escapeHtml(deBias.title)}</a></li>`;
    return `<li><a href="/biases/${slug}/" lang="en">${escapeHtml(slug)} — English</a></li>`;
  }).join("");
  const schema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "@id": `${SITE}${dePath}#howto`,
    name: technique.title,
    description: technique.purpose,
    inLanguage: "de",
    step: (technique.steps || []).map((step, index) => ({ "@type": "HowToStep", position: index + 1, text: step }))
  };
  const body = `${breadcrumbs([{ label: "Start", href: "/de/" }, { label: "Denkwerkzeuge", href: "/de/techniques/" }, { label: technique.title }])}<section class="page-hero"><p class="eyebrow">Praktische Technik</p><h1>${escapeHtml(technique.title)}</h1><p class="lede">${escapeHtml(technique.purpose)}</p></section><section class="section"><p class="kicker">Was passiert?</p><h2>Wann dieses Werkzeug sinnvoll ist</h2><p>${escapeHtml(technique.whenToUse)}</p></section><section class="section section--ink"><p class="kicker">Probier das</p><h2>Vier Schritte</h2><ol>${(technique.steps || []).map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol></section><section class="section"><p class="kicker">Warum es helfen kann</p><h2>Mach die Entscheidung sichtbar</h2><p>${escapeHtml(technique.purpose)}</p>${related ? `<h3>Verwandte Verzerrungen</h3><ul>${related}</ul>` : ""}<h3>Grenzen</h3><p>${escapeHtml(technique.limitations)}</p><p class="fine-print">Eine Technik ist kein universelles Gegenmittel. Qualität der Daten, Timing und Kontext bleiben entscheidend.</p>${hasEnglish ? `<p><a href="${enPath}" lang="en">Canonical technique — English →</a></p>` : ""}</section>`;
  await writePage(`de/techniques/${technique.slug}`, page({
    title: `${technique.title} | Denkwerkzeug | Cognitive Biases`,
    description: `${technique.purpose} Anleitung, Einsatzbereich und Grenzen.`,
    dePath,
    enPath: hasEnglish ? enPath : null,
    englishPath: hasEnglish ? enPath : "/techniques/",
    current: "techniques",
    body,
    schema
  }));
}

const biasCards = localizedBiases.map((bias) => {
  const search = [bias.title, bias.englishTitle, ...(bias.aliases || []), ...(bias.searchTerms || [])].join(" ");
  return `<article class="practice-set-card" data-de-filter-item data-search="${escapeHtml(search)}"><p class="kicker">Kognitive Verzerrung</p><h2><a href="/de/biases/${bias.slug}/">${escapeHtml(bias.title)}</a></h2><p>${escapeHtml(bias.summary)}</p><p class="fine-print" lang="en">${escapeHtml(bias.englishTitle)}</p></article>`;
}).join("");
const biasIndexPath = "/de/biases/";
generatedPaths.push(biasIndexPath);
const biasIndexSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Kognitive Verzerrungen",
  description: "Geprüfte deutsche Einstiege in wichtige kognitive Verzerrungen mit praktischen Gegenprüfungen.",
  inLanguage: "de",
  mainEntity: { "@type": "ItemList", itemListElement: localizedBiases.map((bias, index) => ({ "@type": "ListItem", position: index + 1, name: bias.title, url: `${SITE}/de/biases/${bias.slug}/` })) }
};
await writePage("de/biases", page({
  title: "Kognitive Verzerrungen: erkennen, prüfen, handeln | Cognitive Biases",
  description: "Deutsche Bias-Seiten mit etablierten Begriffen, englischen Aliasen, Evidence Boundaries und konkreten Gegenprüfungen.",
  dePath: biasIndexPath,
  englishPath: "/explore/",
  current: "biases",
  schema: biasIndexSchema,
  body: `${breadcrumbs([{ label: "Start", href: "/de/" }, { label: "Verzerrungen" }])}<section class="page-hero"><p class="eyebrow">Deutsche Wissensschicht</p><h1>Kognitive Verzerrungen erkennen. Nicht nur auswendig lernen.</h1><p class="lede">Starte beim Muster, prüfe die Evidenz und nimm eine konkrete Gegenfrage mit in die nächste Entscheidung.</p><p class="fine-print de-language-note">Suche funktioniert auch mit gängigen englischen Begriffen und deutschen Varianten. Unterschiedliche Namen führen zum selben kanonischen Konzept statt zu doppelten Seiten.</p></section><section class="section">${filterWidget({ id: "de-bias-search", label: "Verzerrung suchen", placeholder: "z. B. Bestätigungsfehler, confirmation bias, Sunk Cost", countLabel: `Insgesamt: ${localizedBiases.length}`, cards: biasCards, emptyText: "Keine passende Verzerrung in der geprüften deutschen Auswahl gefunden." })}</section>`
}));

const techniqueCards = localizedTechniques.map((technique) => {
  const source = sourceTechniqueBySlug.get(technique.slug);
  const search = [technique.title, source?.title || "", technique.purpose, technique.whenToUse].join(" ");
  return `<article class="practice-set-card" data-de-filter-item data-search="${escapeHtml(search)}"><p class="kicker">Denkwerkzeug</p><h2><a href="/de/techniques/${technique.slug}/">${escapeHtml(technique.title)}</a></h2><p>${escapeHtml(technique.purpose)}</p>${source?.title ? `<p class="fine-print" lang="en">${escapeHtml(source.title)}</p>` : ""}</article>`;
}).join("");
const techniqueIndexPath = "/de/techniques/";
generatedPaths.push(techniqueIndexPath);
const techniqueIndexSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Denkwerkzeuge für bessere Entscheidungen",
  description: "Kurze, wiederverwendbare Entscheidungstechniken mit Einsatzbereich und Grenzen.",
  inLanguage: "de",
  mainEntity: { "@type": "ItemList", itemListElement: localizedTechniques.map((technique, index) => ({ "@type": "ListItem", position: index + 1, name: technique.title, url: `${SITE}/de/techniques/${technique.slug}/` })) }
};
await writePage("de/techniques", page({
  title: "Denkwerkzeuge für bessere Entscheidungen | Cognitive Biases",
  description: "Praktische deutsche Techniken gegen typische Entscheidungsfehler: Gegenhypothesen, Basisraten, Entscheidungsjournal, Referenzklassen und mehr.",
  dePath: techniqueIndexPath,
  enPath: "/techniques/",
  englishPath: "/techniques/",
  current: "techniques",
  schema: techniqueIndexSchema,
  body: `${breadcrumbs([{ label: "Start", href: "/de/" }, { label: "Denkwerkzeuge" }])}<section class="page-hero"><p class="eyebrow">Praxis statt Etiketten</p><h1>Denkwerkzeuge für bessere Entscheidungen.</h1><p class="lede">Eine Bias-Bezeichnung ist erst dann nützlich, wenn sie deine nächste Prüfung oder Handlung verändert.</p></section><section class="section">${filterWidget({ id: "de-technique-search", label: "Denkwerkzeug suchen", placeholder: "z. B. Basisrate, Gegenhypothese, Entscheidungsjournal", countLabel: `Insgesamt: ${localizedTechniques.length}`, cards: techniqueCards, emptyText: "Kein passendes Denkwerkzeug gefunden." })}</section><section class="section section--ink"><p class="kicker">Wichtig</p><h2>Kein Werkzeug ist ein universelles Gegenmittel.</h2><p>Die Wirkung hängt von Aufgabe, Timing, Datenqualität und Anwendung ab. Ziel ist ein besser prüfbarer Prozess, nicht perfekte Rationalität.</p></section>`
}));
await addEnglishAlternate("/techniques/", "/de/techniques/");

const homePath = "/de/";
generatedPaths.push(homePath);
const homeSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Kognitive Verzerrungen erkennen. Besser entscheiden.",
  url: `${SITE}/de/`,
  inLanguage: "de",
  description: "Praktischer deutscher Einstieg in kognitive Verzerrungen, Evidenz und konkrete Denkwerkzeuge."
};
await writePage("de", page({
  title: "Kognitive Verzerrungen erkennen. Besser entscheiden. | Cognitive Biases",
  description: "Verstehe Denkfehler, prüfe Evidenz und nutze konkrete Denkwerkzeuge für Arbeit, Alltag, Informationen und KI-gestützte Entscheidungen.",
  dePath: homePath,
  englishPath: "/",
  schema: homeSchema,
  body: `<section class="page-hero"><p class="eyebrow">Cognitive Biases auf Deutsch</p><h1>Kognitive Verzerrungen erkennen. Besser entscheiden.</h1><p class="lede">Den Namen eines Denkfehlers zu kennen ist nur der Anfang. Hier lernst du, woran ein Muster erkennbar ist, was die Forschung tatsächlich stützt und welche kleine Gegenprüfung du jetzt ausprobieren kannst.</p><div class="hero-actions"><a class="button" href="/de/biases/">Verzerrung finden</a><a class="button button--secondary" href="/de/techniques/">Denkwerkzeug wählen</a></div></section><section class="section"><p class="kicker">So funktioniert es</p><h2>Erkennen → prüfen → gegensteuern → entscheiden.</h2><div class="practice-set-grid"><article class="practice-set-card"><h3>1. Was passiert?</h3><p>Erkenne das konkrete Muster, ohne Menschen vorschnell ein Etikett zu geben.</p></article><article class="practice-set-card"><h3>2. Was stützt die Evidenz?</h3><p>Trenne robuste Befunde, Grenzen und offene Fragen voneinander.</p></article><article class="practice-set-card"><h3>3. Was kannst du tun?</h3><p>Nutze eine kurze Gegenprüfung, die den nächsten Schritt beobachtbarer macht.</p></article></div></section><section class="section section--ink"><p class="kicker">Ein schneller Start</p><h2>Du kennst das Problem, aber nicht den Bias?</h2><p>Beginne mit einem Denkwerkzeug. Prüfe zum Beispiel eine Gegenhypothese, eine Basisrate oder die zukünftigen Kosten einer Entscheidung. Das ist oft nützlicher, als erst den perfekten Fachbegriff zu suchen.</p><p><a href="/de/techniques/">Zu den Denkwerkzeugen →</a></p></section><section class="section"><p class="kicker">Sprache & Begriffe</p><h2>Deutsch lesbar, international auffindbar.</h2><p>Wir verwenden etablierte deutsche Fachbegriffe, wo sie sinnvoll sind, und behalten den englischen kanonischen Begriff als Alias. So führt <span lang="en">Confirmation Bias</span> zur selben Entität wie Bestätigungsfehler — ohne eine zweite Wissenswelt zu erzeugen.</p></section>`
}));

const aggregatedBiasDoc = {
  version: 1,
  locale: "de",
  state: "reviewed",
  updatedAt: TODAY,
  canonicalLocale: "en",
  entries: localizedBiases
};
await mkdir(join(OUT, "data", "de"), { recursive: true });
await writeFile(join(OUT, "data", "de", "biases.json"), JSON.stringify(aggregatedBiasDoc, null, 2) + "\n");
await writeFile(join(OUT, "data", "de", "techniques.json"), JSON.stringify(techniquesDoc, null, 2) + "\n");

const sitemapPath = join(OUT, "sitemap.xml");
try {
  let sitemap = await readFile(sitemapPath, "utf8");
  for (const path of generatedPaths.map(normalizePath)) {
    const url = `${SITE}${path}`;
    if (!sitemap.includes(`<loc>${url}</loc>`)) {
      sitemap = sitemap.replace("</urlset>", `  <url><loc>${url}</loc></url>\n</urlset>`);
    }
  }
  await writeFile(sitemapPath, sitemap);
} catch {
  console.warn("sitemap.xml not available while generating German localization.");
}

console.log(`Generated German localization: ${localizedBiases.length} bias pages, ${localizedTechniques.length} technique pages, two collections and homepage.`);
