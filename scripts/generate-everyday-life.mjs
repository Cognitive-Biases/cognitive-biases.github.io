import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const DATA_OUT = join(OUT, "data");

const guideData = JSON.parse(await readFile("data/everyday-guides.json", "utf8"));
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const contexts = JSON.parse(await readFile("data/contexts.json", "utf8"));
const duplicates = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
const contextBySlug = new Map((contexts.entries || []).map((context) => [context.slug, context]));
const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const evidenceReviews = evidenceDocs.flatMap((document) => document.reviews || []);
const evidenceBySlug = new Map(evidenceReviews.map((review) => [review.slug, review]));

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character]);
const titleOf = (bias) => String(bias?.title || bias?.name || bias?.slug || "Untitled concept").split(/\s+[–—]\s+/)[0].trim();

function brand(size, alt) {
  return `<picture class="brand-picture"><source type="image/webp" srcset="/assets/brand.webp"><img src="/assets/biases_icon.png" width="${size}" height="${size}" alt="${escapeHtml(alt)}"></picture>`;
}

function header() {
  return `<header class="site-header"><a class="brand" href="/">${brand(48, "Cognitive Biases icon")}<span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/explore/">Explore</a><a href="/everyday/" aria-current="page">Everyday life</a><a href="/contexts/">Decision guides</a><a href="/practice/">Practice</a><a href="/research/">Research</a><a class="nav-cta" href="/data/">Data</a></nav></header>`;
}

function footer() {
  return `<footer class="site-footer"><div><a class="brand brand--footer" href="/">${brand(40, "")}<span>Cognitive Biases</span></a><p>A public guide to cognitive biases, evidence and better decisions.</p></div><div class="footer-links"><a href="/everyday/">Everyday life</a><a href="/practice/">Practice Lab</a><a href="/contexts/">Decision guides</a><a href="/methodology/">Methodology</a><a href="/quality/">Quality status</a><a href="/data/">Data</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p></footer>`;
}

function schemaForGuide(guide, bias) {
  const canonical = `${SITE}/everyday/${guide.slug}/`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${canonical}#article`,
        url: canonical,
        headline: guide.title,
        description: guide.summary,
        dateModified: guideData.updatedAt,
        inLanguage: "en",
        publisher: {
          "@type": "Organization",
          name: "Cognitive Biases",
          url: SITE
        },
        about: {
          "@type": "DefinedTerm",
          name: titleOf(bias),
          url: `${SITE}/biases/${bias.slug}/`
        },
        isPartOf: {
          "@type": "CollectionPage",
          name: "Cognitive Biases in Everyday Life",
          url: `${SITE}/everyday/`
        }
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Everyday life", item: `${SITE}/everyday/` },
          { "@type": "ListItem", position: 3, name: guide.title, item: canonical }
        ]
      }
    ]
  };
}

function pageForGuide(guide, bias, review, context, relatedGuides) {
  const canonical = `${SITE}/everyday/${guide.slug}/`;
  const biasName = titleOf(bias);
  const contextLink = context
    ? `<p><a href="/contexts/${context.slug}/">Use the ${escapeHtml(context.title)} decision guide →</a></p>`
    : "";
  const related = relatedGuides.map((item) => `<li><a href="/everyday/${item.slug}/">${escapeHtml(item.title)}</a></li>`).join("");
  const schema = schemaForGuide(guide, bias);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${escapeHtml(guide.title)} | Cognitive Biases</title><meta name="description" content="${escapeHtml(guide.summary)}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="article"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="${escapeHtml(guide.title)}"><meta property="og:description" content="${escapeHtml(guide.summary)}"><meta property="og:url" content="${canonical}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escapeHtml(guide.title)}"><meta name="twitter:description" content="${escapeHtml(guide.summary)}"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip" href="#main">Skip to content</a>${header()}<main id="main"><article class="everyday-article"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/everyday/">Everyday life</a> / ${escapeHtml(guide.category)}</nav><p class="eyebrow">${escapeHtml(guide.category)} · 2 minute read</p><h1>${escapeHtml(guide.title)}</h1><p class="everyday-lede">${escapeHtml(guide.summary)}</p><section class="everyday-situation"><p class="kicker">A normal situation</p><p>${escapeHtml(guide.situation)}</p></section><section><h2>What is happening?</h2><p>${escapeHtml(guide.explanation)}</p><p>${escapeHtml(guide.whyItMatters)}</p></section><section class="everyday-lens"><p class="kicker">The useful lens</p><h2><a href="/biases/${bias.slug}/">${escapeHtml(biasName)}</a></h2><p>This does not prove that one bias caused the decision. It is a useful lens for asking a better question and checking the evidence.</p><p class="evidence-note"><strong>Evidence note:</strong> ${escapeHtml(review.qualification || review.evidenceStatus || "See the evidence review for the current assessment.")}</p><p><a href="/biases/${bias.slug}/#evidence">Read the evidence review →</a></p></section><aside class="everyday-try"><p class="kicker">Try this next time</p><p>${escapeHtml(guide.tryThis)}</p><strong>${escapeHtml(guide.takeaway)}</strong></aside>${contextLink}<section class="everyday-related"><p class="kicker">Keep exploring</p><h2>Related everyday guides</h2><ul>${related}</ul><p><a href="/everyday/">Browse all everyday guides →</a></p></section></article></main>${footer()}</body></html>`;
}

const guides = [];
for (const guide of guideData.entries || []) {
  const bias = bySlug.get(guide.biasSlug);
  if (!bias) throw new Error(`${guide.slug}: unknown bias ${guide.biasSlug}`);
  if (duplicateIds.has(bias.id)) throw new Error(`${guide.slug}: ${guide.biasSlug} is not canonical`);
  const review = evidenceBySlug.get(guide.biasSlug);
  if (!review) throw new Error(`${guide.slug}: ${guide.biasSlug} is not evidence-reviewed`);
  const context = guide.contextSlug ? contextBySlug.get(guide.contextSlug) : null;
  if (guide.contextSlug && !context) throw new Error(`${guide.slug}: unknown context ${guide.contextSlug}`);
  guides.push({ ...guide, bias, review, context });
}

for (const guide of guides) {
  const sameCategory = guides.filter((candidate) => candidate.slug !== guide.slug && candidate.category === guide.category);
  const otherCategories = guides.filter((candidate) => candidate.slug !== guide.slug && candidate.category !== guide.category);
  const relatedGuides = [...sameCategory, ...otherCategories].slice(0, 3);
  const target = join(OUT, "everyday", guide.slug, "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, pageForGuide(guide, guide.bias, guide.review, guide.context, relatedGuides));
}

const categoryOrder = ["Money & Shopping", "Work & Career", "News & Internet", "AI & Decisions", "Everyday Decisions"];
const categoryHeading = {
  "Money & Shopping": "Cognitive biases in money and shopping",
  "Work & Career": "Cognitive biases at work",
  "News & Internet": "Cognitive biases in news and online information",
  "AI & Decisions": "Cognitive biases when using AI",
  "Everyday Decisions": "Cognitive biases in everyday decisions"
};
const categorySections = categoryOrder.map((category) => {
  const entries = guides.filter((guide) => guide.category === category);
  if (!entries.length) return "";
  const cards = entries.map((guide) => `<article class="everyday-card"><p class="kicker">${escapeHtml(category)}</p><h3><a href="/everyday/${guide.slug}/">${escapeHtml(guide.title)}</a></h3><p>${escapeHtml(guide.summary)}</p><p><a href="/everyday/${guide.slug}/">Read the guide →</a></p></article>`).join("");
  return `<section class="section everyday-category"><h2>${escapeHtml(categoryHeading[category])}</h2><div class="everyday-grid">${cards}</div></section>`;
}).join("");

const hubCanonical = `${SITE}/everyday/`;
const hubSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": `${hubCanonical}#page`,
      url: hubCanonical,
      name: "Cognitive Biases in Everyday Life",
      description: "Short practical guides to cognitive biases in work, shopping, news, AI and everyday decisions.",
      inLanguage: "en"
    },
    {
      "@type": "ItemList",
      numberOfItems: guides.length,
      itemListElement: guides.map((guide, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: guide.title,
        url: `${SITE}/everyday/${guide.slug}/`
      }))
    }
  ]
};
const hubHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>Cognitive Biases in Everyday Life | Practical Examples</title><meta name="description" content="Easy, practical guides to cognitive biases in work, shopping, news, AI and everyday decisions, with evidence links and questions you can use."><link rel="canonical" href="${hubCanonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="Cognitive Biases in Everyday Life"><meta property="og:description" content="Short practical guides for noticing thinking patterns in real decisions."><meta property="og:url" content="${hubCanonical}"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(hubSchema)}</script></head><body><a class="skip" href="#main">Skip to content</a>${header()}<main id="main"><section class="page-hero everyday-hub-hero"><p class="eyebrow">Everyday life</p><h1>Why do we make these decisions?</h1><p class="lede">Cognitive biases are easier to understand when they start with a normal situation, not a textbook definition. These short guides connect work, shopping, news, AI and daily choices to evidence-reviewed decision lenses.</p></section><section class="section"><p class="kicker">Start with the situation</p><h2>Useful psychology without the lecture.</h2><p class="lede">Each guide begins with something familiar, explains what may be shaping the decision, and ends with one question you can use. The goal is not to diagnose people. It is to make better checking easier.</p></section>${categorySections}<section class="section section--ink"><p class="kicker">Go deeper</p><h2>From a simple example to the evidence.</h2><p class="lede">Every guide links back to the canonical bias page and its current evidence review. When a full decision guide exists, you can also move from one bias to a wider workflow.</p><p><a class="button" href="/evidence/">Explore evidence reviews</a></p></section></main>${footer()}</body></html>`;
await mkdir(join(OUT, "everyday"), { recursive: true });
await writeFile(join(OUT, "everyday", "index.html"), hubHtml);

const publicPayload = {
  version: guideData.version,
  updatedAt: guideData.updatedAt,
  description: guideData.description,
  canonicalUrl: `${SITE}/everyday/`,
  guides: guides.map((guide) => ({
    slug: guide.slug,
    title: guide.title,
    category: guide.category,
    summary: guide.summary,
    situation: guide.situation,
    explanation: guide.explanation,
    whyItMatters: guide.whyItMatters,
    tryThis: guide.tryThis,
    takeaway: guide.takeaway,
    canonicalUrl: `${SITE}/everyday/${guide.slug}/`,
    bias: {
      slug: guide.bias.slug,
      title: titleOf(guide.bias),
      canonicalUrl: `${SITE}/biases/${guide.bias.slug}/`,
      evidenceUrl: `${SITE}/biases/${guide.bias.slug}/#evidence`,
      evidenceStatus: guide.review.evidenceStatus,
      qualification: guide.review.qualification
    },
    context: guide.context ? {
      slug: guide.context.slug,
      title: guide.context.title,
      canonicalUrl: `${SITE}/contexts/${guide.context.slug}/`
    } : null
  }))
};
await mkdir(DATA_OUT, { recursive: true });
await writeFile(join(DATA_OUT, "everyday-guides.json"), `${JSON.stringify(publicPayload, null, 2)}\n`);

const byBias = new Map();
for (const guide of guides) {
  const rows = byBias.get(guide.biasSlug) || [];
  rows.push(guide);
  byBias.set(guide.biasSlug, rows);
}
for (const [biasSlug, rows] of byBias) {
  const biasPath = join(OUT, "biases", biasSlug, "index.html");
  let html = await readFile(biasPath, "utf8");
  if (!html.includes('class="everyday-teaser"')) {
    const links = rows.map((guide) => `<li><a href="/everyday/${guide.slug}/">${escapeHtml(guide.title)}</a></li>`).join("");
    const teaser = `<aside class="everyday-teaser"><span>Everyday life</span><strong>See this idea in a normal decision</strong><ul>${links}</ul></aside>`;
    const marker = '<section class="related">';
    html = html.includes(marker) ? html.replace(marker, `${teaser}${marker}`) : html.replace("</main>", `${teaser}</main>`);
    await writeFile(biasPath, html);
  }
}

const homepagePath = join(OUT, "index.html");
let homepage = await readFile(homepagePath, "utf8");
if (!homepage.includes('class="everyday-home"')) {
  const featuredCategories = ["Money & Shopping", "Work & Career", "News & Internet", "AI & Decisions"];
  const featured = featuredCategories.map((category) => guides.find((guide) => guide.category === category)).filter(Boolean).map((guide) => `<article><p class="kicker">${escapeHtml(guide.category)}</p><h3><a href="/everyday/${guide.slug}/">${escapeHtml(guide.title)}</a></h3><p>${escapeHtml(guide.summary)}</p></article>`).join("");
  const section = `<section class="section everyday-home"><p class="kicker">Cognitive biases in everyday life</p><h2>Start with a question you have actually had.</h2><p class="lede">Why do bad projects survive? Why does repeated news feel true? Why can an AI estimate pull your own estimate toward it? Read the situation first, then follow the evidence.</p><div class="everyday-home-grid">${featured}</div><p><a class="button" href="/everyday/">Explore everyday guides</a></p></section>`;
  homepage = homepage.replace("</main>", `${section}</main>`);
  await writeFile(homepagePath, homepage);
}

async function walkHtml(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walkHtml(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}
let navUpdated = 0;
for (const path of await walkHtml(OUT)) {
  let html = await readFile(path, "utf8");
  const primaryNav = html.match(/<nav aria-label="Primary">([\s\S]*?)<\/nav>/i);
  if (!primaryNav || primaryNav[1].includes('href="/everyday/"')) continue;
  html = html.replace('<nav aria-label="Primary">', '<nav aria-label="Primary"><a href="/everyday/">Everyday life</a>');
  await writeFile(path, html);
  navUpdated += 1;
}

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
for (const path of ["/everyday/", ...guides.map((guide) => `/everyday/${guide.slug}/`)]) {
  const url = `${SITE}${path}`;
  if (sitemap.includes(`<loc>${url}</loc>`)) continue;
  sitemap = sitemap.replace("</urlset>", `<url><loc>${url}</loc><lastmod>${guideData.updatedAt}</lastmod></url></urlset>`);
}
await writeFile(sitemapPath, sitemap);

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".everyday-grid{")) {
  styles += `
.everyday-grid,.everyday-home-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-left:var(--line);border-top:var(--line);margin-top:2rem}
.everyday-card,.everyday-home-grid article{padding:1.4rem;border-right:var(--line);border-bottom:var(--line);background:#fff}
.everyday-card h3,.everyday-home-grid h3{font:1.3rem/1.15 Archivo Black,sans-serif;letter-spacing:-.04em;margin:.45rem 0 .8rem}
.everyday-card h3 a,.everyday-home-grid h3 a{text-decoration:none}
.everyday-card h3 a:hover,.everyday-home-grid h3 a:hover{text-decoration:underline}
.everyday-article{max-width:860px;margin:0 auto;padding:4rem 6vw 6rem}
.everyday-article h1{font:clamp(2.8rem,6vw,5.6rem)/.94 Archivo Black,sans-serif;letter-spacing:-.07em;margin:.7rem 0 1.4rem}
.everyday-article h2{font:1.7rem/1.05 Archivo Black,sans-serif;letter-spacing:-.04em;margin-top:2.7rem}
.everyday-lede{font-size:1.25rem;font-weight:800;max-width:760px}
.everyday-situation,.everyday-lens,.everyday-try{border:var(--line);padding:1.5rem;margin:2.2rem 0;background:#fff}
.everyday-situation{box-shadow:8px 8px 0 var(--yellow)}
.everyday-lens{box-shadow:8px 8px 0 var(--cyan)}
.everyday-try{background:var(--yellow);box-shadow:8px 8px 0 var(--ink)}
.everyday-try strong{display:block;font-size:1.15rem;margin-top:1rem}
.everyday-related{margin-top:3rem;border-top:var(--line);padding-top:1rem}
.everyday-related li{margin:.55rem 0}
.everyday-teaser{border:var(--line);padding:1.2rem;margin:2rem 0;background:#fff}
.everyday-teaser>span{display:block;color:var(--pink);font-weight:900;text-transform:uppercase;font-size:.78rem;letter-spacing:.08em}
.everyday-teaser>strong{display:block;font:1.15rem Archivo Black,sans-serif;margin:.35rem 0}
.everyday-teaser ul{margin:.8rem 0 0;padding-left:1.2rem}
.evidence-note{font-size:.94rem}
@media(max-width:760px){.everyday-grid,.everyday-home-grid{grid-template-columns:1fr}.everyday-article{padding-top:3rem}}
`;
  await writeFile(stylesPath, styles);
}

console.log(`Generated ${guides.length} everyday guides, one hub, ${byBias.size} bias cross-link groups and added Everyday life navigation to ${navUpdated} existing pages.`);
