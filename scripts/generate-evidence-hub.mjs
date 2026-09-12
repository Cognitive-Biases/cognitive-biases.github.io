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
const classesConfig = JSON.parse(await readFile("data/evidence-classes.json", "utf8"));

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);
const short = (value = "", length = 230) => value.length <= length ? value : `${value.slice(0, length - 1).trimEnd()}…`;
const classCounts = new Map(Object.keys(classesConfig.classes || {}).map((key) => [key, 0]));

const cards = reviews.map((review) => {
  const bias = bySlug.get(review.slug);
  if (!bias || duplicateIds.has(bias.id)) throw new Error(`${review.slug}: evidence hub requires a canonical published bias.`);
  const classSlug = classesConfig.bySlug?.[review.slug];
  const evidenceClass = classesConfig.classes?.[classSlug];
  if (!classSlug || !evidenceClass) throw new Error(`${review.slug}: Evidence hub is missing a controlled evidence class.`);
  classCounts.set(classSlug, (classCounts.get(classSlug) || 0) + 1);
  return `<article class="evidence-card"><div class="evidence-card__meta"><div class="evidence-card__badges"><a class="evidence-class" data-evidence-class="${classSlug}" href="/methodology/#${classSlug}" title="${escapeHtml(evidenceClass.description)}">${escapeHtml(evidenceClass.label)}</a><span class="evidence-status">${escapeHtml(review.evidenceStatus)}</span></div><span>Reviewed ${escapeHtml(review.reviewedAt)}</span></div><h2><a href="/biases/${bias.slug}/#evidence">${escapeHtml(bias.title)}</a></h2><p>${escapeHtml(short(review.qualification))}</p><div class="evidence-card__foot"><span>${review.sources.length} reviewed sources</span><a href="/biases/${bias.slug}/#evidence">Read evidence review <span aria-hidden="true">→</span></a></div></article>`;
}).join("");

const classSummary = Object.entries(classesConfig.classes || {}).map(([slug, meta]) => `<a class="evidence-class-card" href="/methodology/#${slug}"><span class="evidence-class" data-evidence-class="${slug}">${escapeHtml(meta.label)}</span><strong>${classCounts.get(slug) || 0}</strong><p>${escapeHtml(meta.description)}</p></a>`).join("");

const canonical = `${SITE}/evidence/`;
const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": `${canonical}#page`,
      url: canonical,
      name: "Evidence reviews | Cognitive Biases",
      description: "Editorial evidence reviews for selected cognitive-bias entries, including sources, boundary conditions, controlled evidence classes, and descriptive evidence status.",
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

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>Evidence reviews | Cognitive Biases</title><meta name="description" content="See which Cognitive Biases entries have been reviewed against primary studies and high-quality reviews, with controlled evidence classes, descriptive status, sources, and boundary conditions."><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="Evidence reviews | Cognitive Biases"><meta property="og:description" content="Source-grounded reviews, evidence classes, descriptive status, and boundary conditions for selected cognitive-bias entries."><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE}/assets/icon2.png"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="/"><img src="/assets/icon2.png" width="48" height="48" alt="Cognitive Biases cat icon"><span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/explore/">Explore</a><a href="/evidence/" aria-current="page">Evidence</a><a href="/how-it-works/">How it works</a><a href="/about/">About</a></nav></header><main id="main"><section class="page-hero"><p class="eyebrow">Evidence layer</p><h1>Check the claim, not just the label.</h1><p class="lede">${reviews.length} of ${canonicalBiases.length} canonical entries currently include an editorial evidence review. Each review separates the quick definition from what the research actually supports, where the effect has limits, and which sources were checked.</p></section><section class="section evidence-method"><p class="kicker">How this works</p><h2>Evidence class is a reading aid, not a truth score.</h2><div class="feature-list"><article><strong>Traceable</strong><p>Reviewed claims link to primary studies or high-quality reviews instead of relying on an uncited summary.</p></article><article><strong>Qualified</strong><p>Boundary conditions, measurement disputes, and terminology problems stay visible instead of being flattened into a confident definition.</p></article><article><strong>Dated</strong><p>Every review carries an editorial review date so future research can trigger a re-check rather than silently aging in place.</p></article></div><p><a class="button button--secondary" href="/methodology/">Read the evidence methodology</a></p></section><section class="section evidence-class-summary"><p class="kicker">Controlled evidence classes</p><h2>Six broad classes. Entry-specific status stays descriptive.</h2><p class="lede">The class makes the broad evidence situation scannable. It does not replace the descriptive status or boundary conditions on the individual review.</p><div class="evidence-class-grid">${classSummary}</div></section><section class="section"><p class="kicker">Reviewed entries</p><h2>${reviews.length} entries with a source-grounded evidence layer.</h2><div class="evidence-grid">${cards}</div></section></main><footer class="site-footer"><div><a class="brand brand--footer" href="/"><img src="/assets/icon2.png" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p>An educational reference for noticing the patterns that shape judgment.</p></div><div class="footer-links"><a href="/explore/">Explore biases</a><a href="/evidence/">Evidence reviews</a><a href="/methodology/">Evidence methodology</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/support/">Support</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p><p class="fine-print">Made by <a href="https://metalhatscats.com/">MetalHatsCats</a></p></footer></body></html>`;

const target = join(OUT, "evidence", "index.html");
await mkdir(dirname(target), { recursive: true });
await writeFile(target, html);

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".evidence-grid{")) {
  styles += `\n.evidence-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-left:var(--line);border-top:var(--line);margin-top:2rem}.evidence-card{padding:1.35rem;border-right:var(--line);border-bottom:var(--line);background:#fff;display:flex;flex-direction:column;gap:.8rem;min-height:280px}.evidence-card h2{font:1.25rem/1.08 Archivo Black,sans-serif;letter-spacing:-.04em;margin:.2rem 0}.evidence-card h2 a{text-decoration:none}.evidence-card h2 a:hover{text-decoration:underline}.evidence-card__meta,.evidence-card__foot{display:flex;justify-content:space-between;align-items:center;gap:.75rem;flex-wrap:wrap;font-size:.8rem;font-weight:800;color:#5a6475}.evidence-card__foot{margin-top:auto;padding-top:.8rem;border-top:2px solid var(--ink)}.evidence-card__foot a{color:var(--ink);font-weight:900}.evidence-method .feature-list article{border-top-color:var(--cyan)}@media(max-width:760px){.evidence-grid{grid-template-columns:1fr}}\n`;
}
if (!styles.includes(".evidence-class-grid{")) {
  styles += `\n.evidence-card__badges{display:flex;align-items:center;gap:.35rem;flex-wrap:wrap}.evidence-class-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-left:var(--line);border-top:var(--line);margin-top:1.4rem}.evidence-class-card{display:grid;grid-template-columns:1fr auto;gap:.7rem;padding:1rem;border-right:var(--line);border-bottom:var(--line);background:#fff;color:var(--ink);text-decoration:none}.evidence-class-card:hover{background:var(--paper)}.evidence-class-card>strong{font:1.5rem Archivo Black,sans-serif}.evidence-class-card>p{grid-column:1/-1;margin:0;font-size:.9rem}.evidence-class-summary .lede{max-width:900px}@media(max-width:860px){.evidence-class-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.evidence-class-grid{grid-template-columns:1fr}}\n`;
}
await writeFile(stylesPath, styles);

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

console.log(`Generated Evidence hub with ${reviews.length} reviewed entries across ${Object.keys(classesConfig.classes).length} controlled evidence classes.`);
