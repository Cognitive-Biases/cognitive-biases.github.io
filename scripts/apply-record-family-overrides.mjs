import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const biases = JSON.parse(await readFile("data/biases.json", "utf8"))
  .filter((bias) => bias.published)
  .sort((a, b) => a.title.localeCompare(b.title));
const duplicateDispositions = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicateDispositions.groups || []).flatMap((group) => group.duplicateIds || []));
const canonicalBiases = biases.filter((bias) => !duplicateIds.has(bias.id));
const taxonomy = JSON.parse(await readFile("data/taxonomy-v2.json", "utf8"));
const overrides = taxonomy.recordFamilyOverrides || {};
const familyFor = (bias) => overrides[String(bias.id)] || taxonomy.directCategoryFamily[bias.typeOfBias] || null;
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);
const escapeXml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
})[character]);
const shortDescription = (bias) => bias.description.split("\n")[0].replace(/^[^–—]+[–—]\s*/, "").slice(0, 180);

const groups = new Map();
for (const bias of canonicalBiases) {
  const family = familyFor(bias);
  if (!family) continue;
  if (!taxonomy.families[family]) throw new Error(`${bias.slug}: family ${family} has no definition.`);
  if (!groups.has(family)) groups.set(family, []);
  groups.get(family).push(bias);
}
const families = [...groups.entries()]
  .filter(([, records]) => records.length >= taxonomy.hubMinimumRecords)
  .map(([slug, records]) => ({ slug, records, ...taxonomy.families[slug] }))
  .sort((a, b) => b.records.length - a.records.length || a.label.localeCompare(b.label));
const publishedFamilySlugs = new Set(families.map((family) => family.slug));
const mappedCount = canonicalBiases.filter((bias) => familyFor(bias)).length;

const familyCard = (family) => `<a class="family-card" href="/families/${family.slug}/"><strong>${escapeHtml(family.label)}</strong><span>${family.records.length} reviewed entries</span><small>${escapeHtml(family.description)}</small></a>`;
const biasCard = (bias) => `<a class="bias-link" href="/biases/${bias.slug}/"><span>${escapeHtml(bias.typeOfBias)}</span><strong>${escapeHtml(bias.title)}</strong><small>${escapeHtml(shortDescription(bias))}</small><b>Read entry <span aria-hidden="true">→</span></b></a>`;

async function emit(path, content) {
  const target = join(OUT, path.replace(/^\//, ""), "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

const familyPage = (family) => {
  const canonical = `${SITE}/families/${family.slug}/`;
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", "@id": `${canonical}#page`, url: canonical, name: `${family.label} cognitive biases`, description: family.description },
      { "@type": "DefinedTermSet", "@id": `${canonical}#family`, url: canonical, name: family.label, description: family.description,
        hasDefinedTerm: family.records.map((bias) => ({ "@type": "DefinedTerm", "@id": `${SITE}/biases/${bias.slug}/#term`, name: bias.title, url: `${SITE}/biases/${bias.slug}/` })) },
    ],
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${escapeHtml(family.label)} | Cognitive Biases</title><meta name="description" content="${escapeHtml(family.description)}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="${escapeHtml(family.label)} | Cognitive Biases"><meta property="og:description" content="${escapeHtml(family.description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE}/assets/icon2.png"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="/"><img src="/assets/icon2.png" width="48" height="48" alt="Cognitive Biases cat icon"><span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/explore/">Explore</a><a href="/how-it-works/">How it works</a><a href="/about/">About</a></nav></header><main id="main"><section class="page-hero"><p class="eyebrow">Mechanism family · v2 taxonomy</p><h1>${escapeHtml(family.label)}</h1><p class="lede">${escapeHtml(family.description)}</p></section><section class="section"><p class="kicker">Reviewed mapping</p><h2>${family.records.length} canonical entries currently belong to this family.</h2><p class="lede">This hub combines direct category mappings with record-level reviews. Duplicate aliases and ambiguous entries stay outside the family discovery layer.</p><div class="bias-grid">${family.records.map(biasCard).join("")}</div><p><a class="button" href="/explore/">Back to the full library</a></p></section></main><footer class="site-footer"><div><a class="brand brand--footer" href="/"><img src="/assets/icon2.png" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p>An educational reference for noticing the patterns that shape judgment.</p></div><div class="footer-links"><a href="/explore/">Explore biases</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/support/">Support</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p><p class="fine-print">Made by <a href="https://metalhatscats.com/">MetalHatsCats</a></p></footer></body></html>`;
};

for (const family of families) await emit(`/families/${family.slug}/`, familyPage(family));

for (const bias of biases.filter((item) => overrides[String(item.id)])) {
  const path = join(OUT, "biases", bias.slug, "index.html");
  let html = await readFile(path, "utf8");
  const familySlug = familyFor(bias);
  const family = taxonomy.families[familySlug];
  const oldEyebrow = `<p class="eyebrow">${escapeHtml(bias.typeOfBias)} · Entry`;
  const familyLabel = publishedFamilySlugs.has(familySlug)
    ? `<a class="taxonomy-link" href="/families/${familySlug}/">${escapeHtml(family.label)}</a>`
    : escapeHtml(family.label);
  if (html.includes(oldEyebrow)) html = html.replace(oldEyebrow, `<p class="eyebrow">${familyLabel} · ${escapeHtml(bias.typeOfBias)} · Entry`);
  await writeFile(path, html);
}

const explorePath = join(OUT, "explore", "index.html");
let explore = await readFile(explorePath, "utf8");
const strip = `<section class="family-strip" aria-labelledby="family-heading"><div class="family-strip__head"><div><p class="kicker">New taxonomy</p><h2 id="family-heading">Browse by cognitive mechanism</h2></div><p>${mappedCount} of ${canonicalBiases.length} canonical entries now have a reviewed v2 family mapping. Ambiguous entries stay unassigned until reviewed.</p></div><div class="family-grid">${families.map(familyCard).join("")}</div></section>`;
explore = explore.replace(/<section class="family-strip"[\s\S]*?<\/section>/, "");
const marker = '<div class="filter" role="search">';
if (!explore.includes(marker)) throw new Error("Explore family navigation marker was not found.");
explore = explore.replace(marker, `${strip}${marker}`);
await writeFile(explorePath, explore);

const staticPaths = ["/", "/explore/", "/how-it-works/", "/about/", "/privacy/", "/terms/", "/support/"];
const sitemapEntries = [
  ...staticPaths.map((path) => ({ path })),
  ...families.map((family) => ({ path: `/families/${family.slug}/` })),
  ...biases.map((bias) => ({ path: `/biases/${bias.slug}/`, lastmod: /^\d{4}-\d{2}-\d{2}/.test(bias.updatedAt || "") ? bias.updatedAt.slice(0, 10) : undefined })),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.map(({ path, lastmod }) => `  <url><loc>${escapeXml(`${SITE}${path}`)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>\n`;
await writeFile(join(OUT, "sitemap.xml"), sitemap);

console.log(`Applied ${Object.keys(overrides).length} record-level family overrides: ${mappedCount}/${canonicalBiases.length} canonical entries mapped across ${families.length} family hubs.`);
