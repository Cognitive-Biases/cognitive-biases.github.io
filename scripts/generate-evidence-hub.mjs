import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
const duplicateDispositions = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicateDispositions.groups || []).flatMap((group) => group.duplicateIds || []));
const canonicalBiases = biases.filter((bias) => !duplicateIds.has(bias.id));
const evidenceFiles = (await readdir("data"))
  .filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name))
  .sort();
const evidenceDocuments = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const reviews = evidenceDocuments.flatMap((document) => document.reviews || [])
  .sort((a, b) => a.slug.localeCompare(b.slug));

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);
const short = (value = "", length = 230) => value.length <= length ? value : `${value.slice(0, length - 1).trimEnd()}…`;

const cards = reviews.map((review) => {
  const bias = bySlug.get(review.slug);
  if (!bias || duplicateIds.has(bias.id)) throw new Error(`${review.slug}: evidence hub requires a canonical published bias.`);
  return `<article class="evidence-card"><div class="evidence-card__meta"><span class="evidence-status">${escapeHtml(review.evidenceStatus)}</span><span>Reviewed ${escapeHtml(review.reviewedAt)}</span></div><h2><a href="/biases/${bias.slug}/#evidence">${escapeHtml(bias.title)}</a></h2><p>${escapeHtml(short(review.qualification))}</p><div class="evidence-card__foot"><span>${review.sources.length} reviewed sources</span><a href="/biases/${bias.slug}/#evidence">Read evidence review <span aria-hidden="true">→</span></a></div></article>`;
}).join("");

const canonical = `${SITE}/evidence/`;
const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": `${canonical}#page`,
      url: canonical,
      name: "Evidence reviews | Cognitive Biases",
      description: "Editorial evidence reviews for selected cognitive-bias entries, including sources, boundary conditions, and evidence status.",
      isPartOf: { "@id": `${SITE}/#website` },
    },
    {
      "@type": "ItemList",
      "@id": `${canonical}#reviews`,
      name: "Reviewed cognitive-bias entries",
      numberOfItems: reviews.length,
      itemListElement: reviews.map((review, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE}/biases/${review.slug}/#evidence`,
        name: bySlug.get(review.slug)?.title || review.slug,
      })),
    },
  ],
};

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>Evidence reviews | Cognitive Biases</title><meta name="description" content="See which Cognitive Biases entries have been reviewed against primary studies and high-quality reviews, with evidence status and boundary conditions."><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="Evidence reviews | Cognitive Biases"><meta property="og:description" content="Source-grounded reviews, evidence status, and boundary conditions for selected cognitive-bias entries."><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE}/assets/icon2.png"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="/"><img src="/assets/icon2.png" width="48" height="48" alt="Cognitive Biases cat icon"><span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/explore/">Explore</a><a href="/evidence/" aria-current="page">Evidence</a><a href="/how-it-works/">How it works</a><a href="/about/">About</a></nav></header><main id="main"><section class="page-hero"><p class="eyebrow">Evidence layer</p><h1>Check the claim, not just the label.</h1><p class="lede">${reviews.length} of ${canonicalBiases.length} canonical entries currently include an editorial evidence review. Each review separates the quick definition from what the research actually supports, where the effect has limits, and which sources were checked.</p></section><section class="section evidence-method"><p class="kicker">How this works</p><h2>Evidence status is a reading aid, not a truth score.</h2><div class="feature-list"><article><strong>Traceable</strong><p>Reviewed claims link to primary studies or high-quality reviews instead of relying on an uncited summary.</p></article><article><strong>Qualified</strong><p>Boundary conditions, measurement disputes, and terminology problems stay visible instead of being flattened into a confident definition.</p></article><article><strong>Dated</strong><p>Every review carries an editorial review date so future research can trigger a re-check rather than silently aging in place.</p></article></div></section><section class="section"><p class="kicker">Reviewed entries</p><h2>${reviews.length} entries with a source-grounded evidence layer.</h2><div class="evidence-grid">${cards}</div></section></main><footer class="site-footer"><div><a class="brand brand--footer" href="/"><img src="/assets/icon2.png" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p>An educational reference for noticing the patterns that shape judgment.</p></div><div class="footer-links"><a href="/explore/">Explore biases</a><a href="/evidence/">Evidence reviews</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/support/">Support</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p><p class="fine-print">Made by <a href="https://metalhatscats.com/">MetalHatsCats</a></p></footer></body></html>`;

const target = join(OUT, "evidence", "index.html");
await mkdir(dirname(target), { recursive: true });
await writeFile(target, html);

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".evidence-grid{")) {
  styles += `\n.evidence-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-left:var(--line);border-top:var(--line);margin-top:2rem}.evidence-card{padding:1.35rem;border-right:var(--line);border-bottom:var(--line);background:#fff;display:flex;flex-direction:column;gap:.8rem;min-height:280px}.evidence-card h2{font:1.25rem/1.08 Archivo Black,sans-serif;letter-spacing:-.04em;margin:.2rem 0}.evidence-card h2 a{text-decoration:none}.evidence-card h2 a:hover{text-decoration:underline}.evidence-card__meta,.evidence-card__foot{display:flex;justify-content:space-between;align-items:center;gap:.75rem;flex-wrap:wrap;font-size:.8rem;font-weight:800;color:#5a6475}.evidence-card__foot{margin-top:auto;padding-top:.8rem;border-top:2px solid var(--ink)}.evidence-card__foot a{color:var(--ink);font-weight:900}.evidence-method .feature-list article{border-top-color:var(--cyan)}@media(max-width:760px){.evidence-grid{grid-template-columns:1fr}}\n`;
  await writeFile(stylesPath, styles);
}

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
if (!sitemap.includes(`<loc>${canonical}</loc>`)) {
  sitemap = sitemap.replace("</urlset>", `  <url><loc>${canonical}</loc></url>\n</urlset>`);
  await writeFile(sitemapPath, sitemap);
}

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
  if (file === target) continue;
  let page = await readFile(file, "utf8");
  if (!page.includes('href="/evidence/"')) {
    page = page.replace('<a href="/how-it-works/">How it works</a>', '<a href="/evidence/">Evidence</a><a href="/how-it-works/">How it works</a>');
    await writeFile(file, page);
  }
}

console.log(`Generated Evidence hub with ${reviews.length} reviewed entries from ${evidenceFiles.length} curated evidence files.`);
