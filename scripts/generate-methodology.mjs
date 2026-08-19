import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
const evidenceFiles = (await readdir("data"))
  .filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name))
  .sort();
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const reviews = evidenceDocs.flatMap((document) => document.reviews || []);
const classesConfig = JSON.parse(await readFile("data/evidence-classes.json", "utf8"));
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

const byClass = new Map(Object.keys(classesConfig.classes || {}).map((slug) => [slug, []]));
for (const review of reviews) {
  const classSlug = classesConfig.bySlug?.[review.slug];
  if (!classesConfig.classes?.[classSlug]) throw new Error(`${review.slug}: methodology cannot resolve controlled evidence class.`);
  if (!bySlug.has(review.slug)) throw new Error(`${review.slug}: methodology review target is not published.`);
  byClass.get(classSlug).push(review);
}

const auditEligible = reviews.filter((review) => review.auditEligible !== false).length;
const evidenceOnly = reviews.length - auditEligible;
const classSections = Object.entries(classesConfig.classes || {}).map(([slug, meta]) => {
  const classReviews = (byClass.get(slug) || []).sort((a, b) => a.slug.localeCompare(b.slug));
  const examples = classReviews.slice(0, 4).map((review) => `<li><a href="/biases/${review.slug}/#evidence">${escapeHtml(bySlug.get(review.slug)?.title || review.slug)}</a></li>`).join("");
  return `<article class="method-class" id="${slug}"><div class="method-class__head"><span class="evidence-class" data-evidence-class="${slug}">${escapeHtml(meta.label)}</span><strong>${classReviews.length} reviewed entr${classReviews.length === 1 ? "y" : "ies"}</strong></div><p>${escapeHtml(meta.description)}</p>${examples ? `<h3>Current examples</h3><ul>${examples}</ul>` : ""}</article>`;
}).join("");

const canonical = `${SITE}/methodology/`;
const schema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${canonical}#page`,
  url: canonical,
  name: "Evidence methodology | Cognitive Biases",
  description: "How Cognitive Biases assigns editorial evidence classes, selects sources, records boundary conditions, and separates evidence review from Decision Audit eligibility.",
  isPartOf: { "@id": `${SITE}/#website` },
  dateModified: "2026-08-18",
};

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>Evidence methodology | Cognitive Biases</title><meta name="description" content="How Cognitive Biases assigns non-numeric evidence classes, selects sources, records boundary conditions, and separates evidence review from Decision Audit eligibility."><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="article"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="Evidence methodology | Cognitive Biases"><meta property="og:description" content="A transparent editorial method for evidence classes, descriptive status, sources, boundary conditions, and review eligibility."><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE}/assets/icon2.png"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="/"><img src="/assets/icon2.png" width="48" height="48" alt="Cognitive Biases cat icon"><span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/explore/">Explore</a><a href="/contexts/">Contexts</a><a href="/compare/">Compare</a><a href="/evidence/">Evidence</a><a href="/tools/decision-audit/">Audit</a><a href="/how-it-works/">How it works</a><a href="/about/">About</a></nav></header><main id="main"><section class="page-hero"><p class="eyebrow">Evidence methodology</p><h1>Useful uncertainty beats a fake score.</h1><p class="lede">Cognitive Biases uses a small controlled evidence class to make the broad research situation scannable, then keeps the entry-specific evidence status, boundary conditions, mechanisms, sources, and review date visible. The class is editorial metadata, not a probability that a bias is “true.”</p><div class="method-metrics"><div><strong>${reviews.length}</strong><span>evidence-reviewed entries</span></div><div><strong>${auditEligible}</strong><span>Decision Audit lenses</span></div><div><strong>${evidenceOnly}</strong><span>reviewed, evidence-only</span></div><div><strong>${Object.keys(classesConfig.classes).length}</strong><span>controlled classes</span></div></div></section><section class="section"><p class="kicker">Evidence classes</p><h2>Broad class first. Specific qualification always stays visible.</h2><div class="method-class-grid">${classSections}</div></section><section class="section method-rules"><p class="kicker">Editorial rules</p><h2>What a review means here.</h2><div class="feature-list"><article><strong>Start with the named claim</strong><p>We review the claim actually made by the page, including whether the label is standardized, domain-specific, broader than the evidence, or a project label.</p></article><article><strong>Prefer primary and high-quality synthesis</strong><p>Where practical, reviews use foundational or representative primary studies plus systematic reviews, meta-analyses, replications, methodological critiques, or standards that materially change interpretation.</p></article><article><strong>Show disagreement that changes the answer</strong><p>Contested findings should include serious alternative explanations or critiques instead of citing only the original memorable study.</p></article><article><strong>Do not count citations as votes</strong><p>Two sources do not make a claim weaker than five, and five citations do not make it established. Source count is for traceability, not scoring.</p></article><article><strong>Keep scope explicit</strong><p>A result from information-security budgeting, Bayesian diagnostic tasks, HRI, or another narrow domain is not promoted into a universal cognitive law without evidence.</p></article><article><strong>Date the editorial review</strong><p>A review date records when the evidence summary was last checked. It is not the publication date of the underlying construct, and future research can require reclassification.</p></article></div></section><section class="section method-separation"><p class="kicker">Separate decisions</p><h2>Evidence review is not the same as Audit eligibility.</h2><p class="lede">An entry can be well worth reviewing and still be a poor self-audit lens. `Systematic Bias`, for example, is a measurement/statistical concept rather than one psychological mechanism, so it appears in Evidence but is excluded from the Decision Audit selector. Audit eligibility is therefore explicit metadata, not inferred from evidence class.</p><div class="method-callout"><strong>${auditEligible} of ${reviews.length}</strong><p>reviewed entries currently act as Decision Audit lenses; ${evidenceOnly} reviewed entr${evidenceOnly === 1 ? "y is" : "ies are"} evidence-only.</p></div></section><section class="section method-limits"><p class="kicker">What this is not</p><h2>No numeric truth score. No blanket “science-backed” badge.</h2><ul><li>These editorial reviews are not automatically formal systematic reviews or meta-analyses.</li><li>The listed sources are selected for traceability and interpretation; they are not guaranteed to be an exhaustive bibliography.</li><li>An `Established` class does not mean every proposed mechanism, population, intervention, or popular example is established.</li><li>A `Mixed`, `Contested`, or `Domain-specific` class does not mean the topic is useless; it tells you what kind of caution matters.</li><li>The site is educational and does not provide medical, legal, financial, or mental-health advice.</li></ul><p><a class="button" href="/evidence/">Browse the evidence reviews</a></p></section></main><footer class="site-footer"><div><a class="brand brand--footer" href="/"><img src="/assets/icon2.png" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p>An educational reference for noticing the patterns that shape judgment.</p></div><div class="footer-links"><a href="/evidence/">Evidence reviews</a><a href="/methodology/">Evidence methodology</a><a href="/tools/decision-audit/">Decision Audit</a><a href="/contexts/">Decision contexts</a><a href="/explore/">Explore library</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/support/">Support</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p><p class="fine-print">Made by <a href="https://metalhatscats.com/">MetalHatsCats</a></p></footer></body></html>`;

const target = join(OUT, "methodology", "index.html");
await mkdir(dirname(target), { recursive: true });
await writeFile(target, html);

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".method-class-grid{")) {
  styles += `\n.method-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin-top:1.5rem;border:var(--line);background:#fff}.method-metrics div{padding:1rem;border-right:2px solid var(--ink)}.method-metrics div:last-child{border-right:0}.method-metrics strong{display:block;font:1.6rem Archivo Black,sans-serif}.method-metrics span{font-size:.76rem;font-weight:900;text-transform:uppercase;color:#5a6475}.method-class-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-left:var(--line);border-top:var(--line);margin-top:1.4rem}.method-class{padding:1.15rem;border-right:var(--line);border-bottom:var(--line);background:#fff}.method-class__head{display:flex;align-items:center;justify-content:space-between;gap:.8rem;flex-wrap:wrap}.method-class h3{font:1rem Archivo Black,sans-serif;margin:1.1rem 0 .4rem}.method-class ul{padding-left:1.2rem;display:grid;gap:.35rem}.method-class li a{font-weight:800}.method-callout{display:flex;align-items:center;gap:1rem;margin-top:1.2rem;padding:1rem;border:var(--line);background:var(--yellow)}.method-callout strong{font:1.6rem Archivo Black,sans-serif;white-space:nowrap}.method-callout p{margin:0}.method-limits ul{max-width:900px;display:grid;gap:.65rem}@media(max-width:760px){.method-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.method-metrics div:nth-child(2){border-right:0}.method-metrics div:nth-child(-n+2){border-bottom:2px solid var(--ink)}.method-class-grid{grid-template-columns:1fr}.method-callout{align-items:flex-start;flex-direction:column}}\n`;
  await writeFile(stylesPath, styles);
}

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
if (!sitemap.includes(`<loc>${canonical}</loc>`)) {
  sitemap = sitemap.replace("</urlset>", `  <url><loc>${canonical}</loc></url>\n</urlset>`);
  await writeFile(sitemapPath, sitemap);
}

console.log(`Generated evidence methodology: ${reviews.length} reviewed entries, ${auditEligible} Audit lenses, ${evidenceOnly} evidence-only, ${Object.keys(classesConfig.classes).length} controlled classes.`);
