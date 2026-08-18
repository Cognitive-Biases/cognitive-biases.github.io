import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const contexts = JSON.parse(await readFile("data/contexts.json", "utf8"));
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
const duplicates = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const evidenceReviews = evidenceDocs.flatMap((document) => document.reviews || []);
const evidenceBySlug = new Map(evidenceReviews.map((review) => [review.slug, review]));
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

const contextsByBias = new Map();
const cards = [];
for (const context of contexts.entries || []) {
  if (!Array.isArray(context.lenses) || context.lenses.length < 3) throw new Error(`${context.slug}: context needs at least three lenses.`);
  const lenses = context.lenses.map((lens) => {
    const bias = bySlug.get(lens.slug);
    const review = evidenceBySlug.get(lens.slug);
    if (!bias || duplicateIds.has(bias.id)) throw new Error(`${context.slug}: ${lens.slug} is not canonical.`);
    if (!review) throw new Error(`${context.slug}: ${lens.slug} is not evidence-reviewed.`);
    if (!contextsByBias.has(lens.slug)) contextsByBias.set(lens.slug, []);
    contextsByBias.get(lens.slug).push(context);
    return { ...lens, bias, review };
  });
  const canonical = `${SITE}/contexts/${context.slug}/`;
  const lensCards = lenses.map(({ question, bias, review }) => `<article class="context-lens"><div class="context-lens__meta"><span>${escapeHtml(review.evidenceStatus)}</span><a href="/biases/${bias.slug}/#evidence">Evidence</a></div><h2><a href="/biases/${bias.slug}/">${escapeHtml(bias.title)}</a></h2><p class="context-question">${escapeHtml(question)}</p><p>${escapeHtml(review.qualification)}</p><div class="context-lens__actions"><a href="/biases/${bias.slug}/#evidence">Read evidence review</a><a href="/tools/decision-audit/?bias=${bias.slug}">Use in Decision Audit →</a></div></article>`).join("");
  const useWhen = context.useWhen.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const workflow = context.workflow.map((item, index) => `<li><span>${index + 1}</span><p>${escapeHtml(item)}</p></li>`).join("");
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", "@id": `${canonical}#page`, url: canonical, name: context.title, description: context.summary },
      { "@type": "ItemList", "@id": `${canonical}#lenses`, numberOfItems: lenses.length, itemListElement: lenses.map(({ bias }, index) => ({ "@type": "ListItem", position: index + 1, name: bias.title, url: `${SITE}/biases/${bias.slug}/` })) },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Contexts", item: `${SITE}/contexts/` },
        { "@type": "ListItem", position: 3, name: context.title, item: canonical }
      ] }
    ]
  };
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${escapeHtml(context.title)} | Cognitive Biases</title><meta name="description" content="${escapeHtml(context.summary)}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="${escapeHtml(context.title)} | Cognitive Biases"><meta property="og:description" content="${escapeHtml(context.summary)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE}/assets/icon2.png"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="/"><img src="/assets/icon2.png" width="48" height="48" alt="Cognitive Biases cat icon"><span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/explore/">Explore</a><a href="/contexts/" aria-current="page">Contexts</a><a href="/compare/">Compare</a><a href="/evidence/">Evidence</a><a href="/tools/decision-audit/">Audit</a><a href="/how-it-works/">How it works</a><a href="/about/">About</a></nav></header><main id="main"><section class="page-hero"><p class="eyebrow">Decision context</p><h1>${escapeHtml(context.title)}</h1><p class="lede">${escapeHtml(context.summary)}</p></section><section class="section context-signals"><p class="kicker">Use this context when</p><h2>Start from the situation, not a label.</h2><ul>${useWhen}</ul></section><section class="section"><p class="kicker">Evidence-reviewed lenses</p><h2>${lenses.length} patterns worth testing, not diagnosing.</h2><div class="context-lens-grid">${lensCards}</div></section><section class="section context-workflow"><p class="kicker">Decision workflow</p><h2>Turn the context into observable questions.</h2><ol>${workflow}</ol><p><a class="button" href="/tools/decision-audit/">Open a blank Decision Audit</a></p></section></main><footer class="site-footer"><div><a class="brand brand--footer" href="/"><img src="/assets/icon2.png" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p>An educational reference for noticing the patterns that shape judgment.</p></div><div class="footer-links"><a href="/explore/">Explore biases</a><a href="/contexts/">Decision contexts</a><a href="/compare/">Compare biases</a><a href="/evidence/">Evidence reviews</a><a href="/tools/decision-audit/">Decision Audit</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/support/">Support</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p><p class="fine-print">Made by <a href="https://metalhatscats.com/">MetalHatsCats</a></p></footer></body></html>`;
  const target = join(OUT, "contexts", context.slug, "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
  cards.push({ context, lenses, canonical });
}

const hubCanonical = `${SITE}/contexts/`;
const hubCards = cards.map(({ context, lenses }) => `<article class="context-card"><p class="kicker">Decision context</p><h2><a href="/contexts/${context.slug}/">${escapeHtml(context.title)}</a></h2><p>${escapeHtml(context.summary)}</p><span>${lenses.length} evidence-reviewed lenses</span><a href="/contexts/${context.slug}/">Open context →</a></article>`).join("");
const hubSchema = { "@context": "https://schema.org", "@graph": [
  { "@type": "CollectionPage", "@id": `${hubCanonical}#page`, url: hubCanonical, name: "Decision contexts | Cognitive Biases", description: "Evidence-reviewed cognitive-bias lenses organized around real decision situations." },
  { "@type": "ItemList", "@id": `${hubCanonical}#contexts`, numberOfItems: cards.length, itemListElement: cards.map(({ context }, index) => ({ "@type": "ListItem", position: index + 1, name: context.title, url: `${SITE}/contexts/${context.slug}/` })) }
] };
const hub = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>Decision contexts | Cognitive Biases</title><meta name="description" content="Start with a real decision context and explore evidence-reviewed cognitive-bias lenses, questions, and Decision Audit prompts."><link rel="canonical" href="${hubCanonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="Decision contexts | Cognitive Biases"><meta property="og:description" content="Evidence-reviewed cognitive-bias lenses organized around real decisions."><meta property="og:url" content="${hubCanonical}"><meta property="og:image" content="${SITE}/assets/icon2.png"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(hubSchema)}</script></head><body><a class="skip" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="/"><img src="/assets/icon2.png" width="48" height="48" alt="Cognitive Biases cat icon"><span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/explore/">Explore</a><a href="/contexts/" aria-current="page">Contexts</a><a href="/compare/">Compare</a><a href="/evidence/">Evidence</a><a href="/tools/decision-audit/">Audit</a><a href="/how-it-works/">How it works</a><a href="/about/">About</a></nav></header><main id="main"><section class="page-hero"><p class="eyebrow">Context library</p><h1>Start with the decision you actually have.</h1><p class="lede">Bias names are useful after you know them. Context pages start earlier: from a project review, a forecast, or another concrete decision situation, then offer evidence-reviewed lenses to test.</p></section><section class="section"><p class="kicker">Available contexts</p><h2>${cards.length} intentionally curated starting points.</h2><div class="context-grid">${hubCards}</div></section></main><footer class="site-footer"><div><a class="brand brand--footer" href="/"><img src="/assets/icon2.png" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p>An educational reference for noticing the patterns that shape judgment.</p></div><div class="footer-links"><a href="/explore/">Explore biases</a><a href="/contexts/">Decision contexts</a><a href="/compare/">Compare biases</a><a href="/evidence/">Evidence reviews</a><a href="/tools/decision-audit/">Decision Audit</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/support/">Support</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p><p class="fine-print">Made by <a href="https://metalhatscats.com/">MetalHatsCats</a></p></footer></body></html>`;
const hubTarget = join(OUT, "contexts", "index.html");
await mkdir(dirname(hubTarget), { recursive: true });
await writeFile(hubTarget, hub);

for (const [slug, linkedContexts] of contextsByBias.entries()) {
  const pagePath = join(OUT, "biases", slug, "index.html");
  let html = await readFile(pagePath, "utf8");
  if (!html.includes('class="context-teaser"')) {
    const links = linkedContexts.map((context) => `<a href="/contexts/${context.slug}/">${escapeHtml(context.title)}</a>`).join("");
    const teaser = `<aside class="context-teaser"><span>Decision contexts</span><div>${links}</div></aside>`;
    const marker = '<section class="related">';
    if (!html.includes(marker)) throw new Error(`${slug}: cannot insert context teaser.`);
    html = html.replace(marker, `${teaser}${marker}`);
    await writeFile(pagePath, html);
  }
}

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".context-grid{")) {
  styles += `\n.context-grid,.context-lens-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-left:var(--line);border-top:var(--line);margin-top:1.5rem}.context-card,.context-lens{display:flex;flex-direction:column;gap:.7rem;padding:1.2rem;border-right:var(--line);border-bottom:var(--line);background:#fff}.context-card{min-height:250px}.context-card h2,.context-lens h2{font:1.2rem/1.08 Archivo Black,sans-serif;letter-spacing:-.04em;margin:0}.context-card h2 a,.context-lens h2 a{text-decoration:none}.context-card>span{font-size:.8rem;font-weight:900;color:#5a6475}.context-card>a{margin-top:auto;font-weight:900}.context-signals ul{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem;padding:0;list-style:none}.context-signals li{padding:.9rem;border:2px solid var(--ink);background:#fff}.context-lens__meta,.context-lens__actions{display:flex;justify-content:space-between;align-items:center;gap:.6rem;flex-wrap:wrap;font-size:.78rem;font-weight:900}.context-lens__meta span{border:2px solid var(--ink);background:var(--yellow);padding:.25rem .45rem;text-transform:uppercase}.context-question{font-weight:900;font-size:1.02rem}.context-lens__actions{margin-top:auto;padding-top:.7rem;border-top:2px solid var(--ink)}.context-workflow ol{list-style:none;padding:0;display:grid;gap:.7rem;max-width:900px}.context-workflow li{display:grid;grid-template-columns:38px 1fr;gap:.7rem;padding:.9rem;border:2px solid var(--ink);background:#fff}.context-workflow li span{display:grid;place-items:center;width:32px;height:32px;background:var(--cyan);border:2px solid var(--ink);font-weight:900}.context-workflow li p{margin:.15rem 0}.context-teaser{display:flex;align-items:center;gap:.8rem;flex-wrap:wrap;margin:1.5rem 0;padding:.8rem 1rem;border:2px solid var(--ink);background:var(--paper)}.context-teaser>span{font-size:.75rem;font-weight:900;text-transform:uppercase}.context-teaser>div{display:flex;gap:.5rem;flex-wrap:wrap}.context-teaser a{font-weight:900}@media(max-width:760px){.context-grid,.context-lens-grid,.context-signals ul{grid-template-columns:1fr}}\n`;
  await writeFile(stylesPath, styles);
}

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
for (const url of [hubCanonical, ...cards.map(({ canonical }) => canonical)]) {
  if (!sitemap.includes(`<loc>${url}</loc>`)) sitemap = sitemap.replace("</urlset>", `  <url><loc>${url}</loc></url>\n</urlset>`);
}
await writeFile(sitemapPath, sitemap);

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}
for (const file of await htmlFiles(OUT)) {
  let html = await readFile(file, "utf8");
  const before = html;
  html = html.replace(/<nav aria-label="Primary">([\s\S]*?)<\/nav>/, (nav) => {
    if (nav.includes('href="/contexts/"')) return nav;
    return nav.replace(/(<a href="\/explore\/"[^>]*>Explore<\/a>)/, '$1<a href="/contexts/">Contexts</a>');
  });
  if (html !== before) await writeFile(file, html);
}

console.log(`Generated ${cards.length} curated decision contexts with ${contextsByBias.size} reciprocal evidence-reviewed bias links.`);
