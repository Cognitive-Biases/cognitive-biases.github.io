import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
const comparisons = JSON.parse(await readFile("data/comparisons.json", "utf8"));
const duplicateDispositions = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicateDispositions.groups || []).flatMap((group) => group.duplicateIds || []));
const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const reviewedSlugs = new Set(evidenceDocs.flatMap((document) => document.reviews || []).map((review) => review.slug));

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

const canonicalBias = (slug) => {
  const bias = bySlug.get(slug);
  if (!bias) throw new Error(`${slug}: comparison target is not a published bias.`);
  if (duplicateIds.has(bias.id)) throw new Error(`${slug}: comparison target must be canonical.`);
  if (!reviewedSlugs.has(slug)) throw new Error(`${slug}: comparison target must have an evidence review first.`);
  return bias;
};

const cards = [];
for (const entry of comparisons.entries || []) {
  const left = canonicalBias(entry.leftSlug);
  const right = canonicalBias(entry.rightSlug);
  if (left.slug === right.slug) throw new Error(`${entry.slug}: comparison requires two different entries.`);
  const path = `/compare/${entry.slug}/`;
  const canonical = `${SITE}${path}`;
  const dimensionRows = entry.dimensions.map((row) => `<tr><th scope="row">${escapeHtml(row.dimension)}</th><td>${escapeHtml(row.left)}</td><td>${escapeHtml(row.right)}</td></tr>`).join("");
  const diagnostic = entry.diagnostic.map((step, index) => `<li><span>${index + 1}</span><p>${escapeHtml(step)}</p></li>`).join("");
  const examples = entry.examples.map((example) => `<article><h3>${escapeHtml(example.title)}</h3><div><p><strong>${escapeHtml(left.title.split(/\s+[–—]\s+/)[0])}</strong>${escapeHtml(example.left)}</p><p><strong>${escapeHtml(right.title.split(/\s+[–—]\s+/)[0])}</strong>${escapeHtml(example.right)}</p></div></article>`).join("");
  const protocol = entry.reviewProtocol.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  const sources = entry.sources.map((source) => `<li><a href="${escapeHtml(source.url)}" rel="external noreferrer">${escapeHtml(source.title)}</a><span>${source.year}${source.doi ? ` · DOI ${escapeHtml(source.doi)}` : ""}</span></li>`).join("");
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${canonical}#article`,
        headline: entry.title,
        description: entry.summary,
        dateModified: entry.reviewedAt,
        mainEntityOfPage: canonical,
        about: [
          { "@type": "DefinedTerm", "@id": `${SITE}/biases/${left.slug}/#term`, name: left.title, url: `${SITE}/biases/${left.slug}/` },
          { "@type": "DefinedTerm", "@id": `${SITE}/biases/${right.slug}/#term`, name: right.title, url: `${SITE}/biases/${right.slug}/` },
        ],
        citation: entry.sources.map((source) => source.url),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Compare", item: `${SITE}/compare/` },
          { "@type": "ListItem", position: 3, name: entry.title, item: canonical },
        ],
      },
    ],
  };
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${escapeHtml(entry.title)} | Cognitive Biases</title><meta name="description" content="${escapeHtml(entry.summary)}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="article"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="${escapeHtml(entry.title)}"><meta property="og:description" content="${escapeHtml(entry.summary)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE}/assets/icon2.png"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="/"><img src="/assets/icon2.png" width="48" height="48" alt="Cognitive Biases cat icon"><span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/explore/">Explore</a><a href="/compare/" aria-current="page">Compare</a><a href="/evidence/">Evidence</a><a href="/how-it-works/">How it works</a><a href="/about/">About</a></nav></header><main id="main"><section class="page-hero compare-hero"><p class="eyebrow">Bias comparison · evidence reviewed</p><h1>${escapeHtml(entry.title)}</h1><p class="lede">${escapeHtml(entry.summary)}</p><div class="compare-pair"><a href="/biases/${left.slug}/#evidence">${escapeHtml(left.title)}</a><span>vs</span><a href="/biases/${right.slug}/#evidence">${escapeHtml(right.title)}</a></div></section><section class="section"><p class="kicker">The shortest distinction</p><h2>${escapeHtml(entry.keyDifference)}</h2><div class="compare-table-wrap"><table class="compare-table"><thead><tr><th>Question</th><th>${escapeHtml(left.title.split(/\s+[–—]\s+/)[0])}</th><th>${escapeHtml(right.title.split(/\s+[–—]\s+/)[0])}</th></tr></thead><tbody>${dimensionRows}</tbody></table></div></section><section class="section compare-diagnostic"><p class="kicker">Decision diagnostic</p><h2>Review the decision without letting the result rewrite the past.</h2><ol>${diagnostic}</ol></section><section class="section"><p class="kicker">Same outcome, different bias</p><h2>Three examples where the distinction matters.</h2><div class="compare-examples">${examples}</div></section><section class="section compare-protocol"><p class="kicker">Retrospective review protocol</p><h2>Separate forecast quality, decision quality, and learning.</h2><ol>${protocol}</ol></section><section class="section"><p class="kicker">Evidence</p><h2>Reviewed sources behind this comparison.</h2><ol class="deep-dive-sources">${sources}</ol><p class="fine-print">Comparison reviewed ${escapeHtml(entry.reviewedAt)}. The individual bias pages contain their full evidence status and boundary conditions.</p></section></main><footer class="site-footer"><div><a class="brand brand--footer" href="/"><img src="/assets/icon2.png" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p>An educational reference for noticing the patterns that shape judgment.</p></div><div class="footer-links"><a href="/explore/">Explore biases</a><a href="/compare/">Compare biases</a><a href="/evidence/">Evidence reviews</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/support/">Support</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p><p class="fine-print">Made by <a href="https://metalhatscats.com/">MetalHatsCats</a></p></footer></body></html>`;
  const target = join(OUT, "compare", entry.slug, "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);

  for (const bias of [left, right]) {
    const biasPath = join(OUT, "biases", bias.slug, "index.html");
    let biasHtml = await readFile(biasPath, "utf8");
    const other = bias.slug === left.slug ? right : left;
    const teaser = `<aside class="comparison-teaser"><span>Often confused</span><strong>Compare with ${escapeHtml(other.title.split(/\s+[–—]\s+/)[0])}</strong><a href="${path}">${escapeHtml(entry.title)} <span aria-hidden="true">→</span></a></aside>`;
    if (!biasHtml.includes(`href="${path}"`)) {
      const marker = '<section class="related">';
      if (!biasHtml.includes(marker)) throw new Error(`${bias.slug}: related-section marker missing for comparison teaser.`);
      biasHtml = biasHtml.replace(marker, `${teaser}${marker}`);
      await writeFile(biasPath, biasHtml);
    }
  }

  cards.push({ entry, left, right, path });
}

const hubCanonical = `${SITE}/compare/`;
const hubSchema = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "CollectionPage", "@id": `${hubCanonical}#page`, url: hubCanonical, name: "Compare cognitive biases", description: "Evidence-reviewed comparisons for cognitive biases and effects that are easy to confuse." },
    { "@type": "ItemList", "@id": `${hubCanonical}#comparisons`, numberOfItems: cards.length, itemListElement: cards.map(({ entry, path }, index) => ({ "@type": "ListItem", position: index + 1, name: entry.title, url: `${SITE}${path}` })) },
  ],
};
const hubCards = cards.map(({ entry, left, right, path }) => `<article class="comparison-card"><p class="kicker">Evidence-reviewed comparison</p><h2><a href="${path}">${escapeHtml(entry.title)}</a></h2><p>${escapeHtml(entry.summary)}</p><div><a href="/biases/${left.slug}/">${escapeHtml(left.title.split(/\s+[–—]\s+/)[0])}</a><span>vs</span><a href="/biases/${right.slug}/">${escapeHtml(right.title.split(/\s+[–—]\s+/)[0])}</a></div><a class="comparison-card__cta" href="${path}">Open comparison <span aria-hidden="true">→</span></a></article>`).join("");
const hubHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>Compare cognitive biases | Cognitive Biases</title><meta name="description" content="Compare cognitive biases and effects that are easy to confuse using evidence-reviewed distinctions and decision diagnostics."><link rel="canonical" href="${hubCanonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="Compare cognitive biases"><meta property="og:description" content="Evidence-reviewed distinctions and decision diagnostics for commonly confused cognitive biases."><meta property="og:url" content="${hubCanonical}"><meta property="og:image" content="${SITE}/assets/icon2.png"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(hubSchema)}</script></head><body><a class="skip" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="/"><img src="/assets/icon2.png" width="48" height="48" alt="Cognitive Biases cat icon"><span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/explore/">Explore</a><a href="/compare/" aria-current="page">Compare</a><a href="/evidence/">Evidence</a><a href="/how-it-works/">How it works</a><a href="/about/">About</a></nav></header><main id="main"><section class="page-hero"><p class="eyebrow">Comparison library</p><h1>Similar label. Different cognitive error.</h1><p class="lede">Comparisons focus on pairs that are easy to confuse in real decisions. Each page starts from evidence-reviewed canonical entries and shows what changes, what to record, and how to tell the patterns apart.</p></section><section class="section"><p class="kicker">Available comparisons</p><h2>${cards.length} evidence-reviewed comparison${cards.length === 1 ? "" : "s"}.</h2><div class="comparison-grid">${hubCards}</div></section></main><footer class="site-footer"><div><a class="brand brand--footer" href="/"><img src="/assets/icon2.png" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p>An educational reference for noticing the patterns that shape judgment.</p></div><div class="footer-links"><a href="/explore/">Explore biases</a><a href="/compare/">Compare biases</a><a href="/evidence/">Evidence reviews</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/support/">Support</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p><p class="fine-print">Made by <a href="https://metalhatscats.com/">MetalHatsCats</a></p></footer></body></html>`;
const hubTarget = join(OUT, "compare", "index.html");
await mkdir(dirname(hubTarget), { recursive: true });
await writeFile(hubTarget, hubHtml);

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".compare-pair{")) {
  styles += `\n.compare-pair{display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;margin-top:1.2rem}.compare-pair a{border:2px solid var(--ink);background:#fff;padding:.5rem .7rem;font-weight:900;text-decoration:none}.compare-pair span{font-weight:900;text-transform:uppercase}.compare-table-wrap{overflow-x:auto;margin-top:1.5rem;border:var(--line)}.compare-table{width:100%;border-collapse:collapse;min-width:720px;background:#fff}.compare-table th,.compare-table td{padding:1rem;text-align:left;vertical-align:top;border-right:2px solid var(--ink);border-bottom:2px solid var(--ink)}.compare-table thead th{background:var(--yellow);font:1rem Archivo Black,sans-serif}.compare-table tbody th{width:20%;font-weight:900;background:var(--paper)}.compare-diagnostic ol{list-style:none;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-left:var(--line);border-top:var(--line)}.compare-diagnostic li{display:grid;grid-template-columns:38px 1fr;gap:.7rem;padding:1rem;border-right:var(--line);border-bottom:var(--line);background:#fff}.compare-diagnostic li>span{display:grid;place-items:center;width:32px;height:32px;background:var(--cyan);border:2px solid var(--ink);font-weight:900}.compare-diagnostic p{margin:.15rem 0}.compare-examples{display:grid;gap:1rem}.compare-examples article{border:var(--line);background:#fff}.compare-examples h3{margin:0;padding:.8rem 1rem;border-bottom:2px solid var(--ink);background:var(--paper);font:1rem Archivo Black,sans-serif}.compare-examples article>div{display:grid;grid-template-columns:1fr 1fr}.compare-examples p{margin:0;padding:1rem}.compare-examples p+ p{border-left:2px solid var(--ink)}.compare-examples strong{display:block;margin-bottom:.4rem}.compare-protocol ol{display:grid;gap:.7rem;max-width:900px}.comparison-teaser{display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;margin:2rem 0;padding:.9rem 1rem;border:var(--line);background:var(--cyan);box-shadow:5px 5px 0 var(--ink)}.comparison-teaser>span{font-size:.75rem;font-weight:900;text-transform:uppercase}.comparison-teaser strong{font-weight:900}.comparison-teaser a{margin-left:auto;font-weight:900}.comparison-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-left:var(--line);border-top:var(--line);margin-top:1.5rem}.comparison-card{display:flex;flex-direction:column;gap:.7rem;padding:1.2rem;border-right:var(--line);border-bottom:var(--line);background:#fff;min-height:300px}.comparison-card h2{font:1.25rem/1.1 Archivo Black,sans-serif;letter-spacing:-.04em;margin:0}.comparison-card h2 a{text-decoration:none}.comparison-card>div{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}.comparison-card>div a{font-weight:900}.comparison-card__cta{margin-top:auto;font-weight:900}@media(max-width:760px){.compare-diagnostic ol,.compare-examples article>div,.comparison-grid{grid-template-columns:1fr}.compare-examples p+ p{border-left:0;border-top:2px solid var(--ink)}.comparison-teaser a{margin-left:0;width:100%}}\n`;
  await writeFile(stylesPath, styles);
}

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
const compareUrls = [hubCanonical, ...cards.map(({ path }) => `${SITE}${path}`)];
for (const url of compareUrls) {
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
    if (nav.includes('href="/compare/"')) return nav;
    return nav.replace(/(<a href="\/explore\/"[^>]*>Explore<\/a>)/, '$1<a href="/compare/">Compare</a>');
  });
  if (html !== before) await writeFile(file, html);
}

console.log(`Generated ${cards.length} evidence-reviewed comparison pages plus /compare/ hub.`);
