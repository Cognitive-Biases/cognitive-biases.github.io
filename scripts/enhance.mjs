import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const biases = JSON.parse(await readFile("data/biases.json", "utf8"))
  .filter((bias) => bias.published)
  .sort((a, b) => a.title.localeCompare(b.title));
const taxonomy = JSON.parse(await readFile("data/taxonomy-v2.json", "utf8"));

const categories = [...new Set(biases.map((bias) => bias.typeOfBias))].sort();
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
})[character]);
const escapeXml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
})[character]);
const categorySlug = (value = "") => String(value)
  .normalize("NFKD")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "") || "other";
const shortDescription = (bias) => bias.description.split("\n")[0].replace(/^[^–—]+[–—]\s*/, "").slice(0, 180);
const familyFor = (bias) => taxonomy.directCategoryFamily[bias.typeOfBias] || null;

const familyGroups = new Map();
for (const bias of biases) {
  const family = familyFor(bias);
  if (!family) continue;
  if (!familyGroups.has(family)) familyGroups.set(family, []);
  familyGroups.get(family).push(bias);
}
const publishedFamilies = [...familyGroups.entries()]
  .filter(([, records]) => records.length >= taxonomy.hubMinimumRecords)
  .map(([slug, records]) => ({ slug, records, ...taxonomy.families[slug] }))
  .filter((family) => family.label && family.description)
  .sort((a, b) => b.records.length - a.records.length || a.label.localeCompare(b.label));
const publishedFamilySlugs = new Set(publishedFamilies.map((family) => family.slug));
const reviewedFamilyCount = biases.filter((bias) => familyFor(bias)).length;

async function replaceFile(path, transform) {
  const fullPath = join(OUT, path);
  const source = await readFile(fullPath, "utf8");
  const next = transform(source);
  if (next !== source) await writeFile(fullPath, next);
}
async function emit(path, content) {
  const target = join(OUT, path.replace(/^\//, ""), "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

const familyCard = (family) => `<a class="family-card" href="/families/${family.slug}/"><strong>${escapeHtml(family.label)}</strong><span>${family.records.length} reviewed entries</span><small>${escapeHtml(family.description)}</small></a>`;
const biasCard = (bias) => `<a class="bias-link" href="/biases/${bias.slug}/"><span>${escapeHtml(bias.typeOfBias)}</span><strong>${escapeHtml(bias.title)}</strong><small>${escapeHtml(shortDescription(bias))}</small><b>Read entry <span aria-hidden="true">→</span></b></a>`;
const familyPage = (family) => {
  const path = `/families/${family.slug}/`;
  const canonical = `${SITE}${path}`;
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${canonical}#page`,
        url: canonical,
        name: `${family.label} cognitive biases`,
        description: family.description,
      },
      {
        "@type": "DefinedTermSet",
        "@id": `${canonical}#family`,
        url: canonical,
        name: family.label,
        description: family.description,
        hasDefinedTerm: family.records.map((bias) => ({
          "@type": "DefinedTerm",
          "@id": `${SITE}/biases/${bias.slug}/#term`,
          name: bias.title,
          url: `${SITE}/biases/${bias.slug}/`,
        })),
      },
    ],
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${escapeHtml(family.label)} | Cognitive Biases</title><meta name="description" content="${escapeHtml(family.description)}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="${escapeHtml(family.label)} | Cognitive Biases"><meta property="og:description" content="${escapeHtml(family.description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE}/assets/icon2.png"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="/"><img src="/assets/icon2.png" width="48" height="48" alt="Cognitive Biases cat icon"><span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/explore/">Explore</a><a href="/how-it-works/">How it works</a><a href="/about/">About</a></nav></header><main id="main"><section class="page-hero"><p class="eyebrow">Mechanism family · v2 taxonomy</p><h1>${escapeHtml(family.label)}</h1><p class="lede">${escapeHtml(family.description)}</p></section><section class="section"><p class="kicker">Reviewed mapping</p><h2>${family.records.length} entries currently belong to this family.</h2><p class="lede">Family pages are built only from category mappings that can be assigned without guessing. Ambiguous records stay in the legacy catalogue until they are reviewed.</p><div class="bias-grid">${family.records.map(biasCard).join("")}</div><p><a class="button" href="/explore/">Back to the full library</a></p></section></main><footer class="site-footer"><div><a class="brand brand--footer" href="/"><img src="/assets/icon2.png" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p>An educational reference for noticing the patterns that shape judgment.</p></div><div class="footer-links"><a href="/explore/">Explore biases</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/support/">Support</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p><p class="fine-print">Made by <a href="https://metalhatscats.com/">MetalHatsCats</a></p></footer></body></html>`;
};

await replaceFile("styles.css", (source) => `${source}\n.family-strip{padding:2.2rem 6vw;border-bottom:var(--line);background:#fff}.family-strip__head{display:flex;justify-content:space-between;gap:1rem;align-items:end;flex-wrap:wrap}.family-strip h2{font:clamp(1.7rem,3vw,2.8rem)/1 Archivo Black,sans-serif;letter-spacing:-.05em;margin:.35rem 0}.family-strip p{max-width:720px;margin:.4rem 0}.family-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-left:var(--line);border-top:var(--line);margin-top:1.4rem}.family-card{display:flex;flex-direction:column;gap:.45rem;padding:1rem;border-right:var(--line);border-bottom:var(--line);text-decoration:none;background:var(--paper);min-height:165px}.family-card:hover{background:var(--yellow)}.family-card strong{font:1.05rem/1.05 Archivo Black,sans-serif;letter-spacing:-.035em}.family-card span{font-size:.76rem;font-weight:900;text-transform:uppercase;color:#5a6475}.family-card small{font-size:.88rem;line-height:1.35}.taxonomy-link{font-weight:900}.taxonomy-note{margin:.75rem 0 1.5rem;font-size:.9rem;color:#5a6475}@media(max-width:900px){.family-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.family-grid{grid-template-columns:1fr}}`);

// Give every legacy category a stable, crawlable fragment, add v2 family navigation,
// and keep the old category catalogue available while the migration is incomplete.
await replaceFile("explore/index.html", (source) => {
  let html = source;
  for (const category of categories) {
    const heading = `<section class="category"><h2>${escapeHtml(category)}</h2>`;
    const anchored = `<section class="category" id="${categorySlug(category)}"><h2>${escapeHtml(category)}</h2>`;
    html = html.replace(heading, anchored);
  }

  const definedTermSet = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": `${SITE}/explore/#bias-library`,
    name: "Cognitive Biases library",
    url: `${SITE}/explore/`,
    description: "A browsable educational collection of cognitive biases, effects, heuristics, and related thinking patterns.",
  };
  const script = `<script type="application/ld+json">${JSON.stringify(definedTermSet)}</script>`;
  if (!html.includes(`${SITE}/explore/#bias-library`)) html = html.replace("</head>", `${script}</head>`);

  const familyStrip = `<section class="family-strip" aria-labelledby="family-heading"><div class="family-strip__head"><div><p class="kicker">New taxonomy</p><h2 id="family-heading">Browse by cognitive mechanism</h2></div><p>${reviewedFamilyCount} of ${biases.length} published entries now have a direct v2 family mapping. Ambiguous entries stay unassigned until reviewed.</p></div><div class="family-grid">${publishedFamilies.map(familyCard).join("")}</div></section>`;
  if (!html.includes('id="family-heading"')) html = html.replace('<div class="filter">', `${familyStrip}<div class="filter">`);
  return html;
});

for (const bias of biases) {
  const path = join("biases", bias.slug, "index.html");
  await replaceFile(path, (source) => {
    let html = source.replace(
      `href="/explore/#${encodeURIComponent(bias.typeOfBias)}"`,
      `href="/explore/#${categorySlug(bias.typeOfBias)}"`,
    );
    const familySlug = familyFor(bias);
    if (!familySlug) return html;
    const family = taxonomy.families[familySlug];
    if (!family) return html;
    const oldEyebrow = `<p class="eyebrow">${escapeHtml(bias.typeOfBias)} · Entry`;
    const familyLabel = publishedFamilySlugs.has(familySlug)
      ? `<a class="taxonomy-link" href="/families/${familySlug}/">${escapeHtml(family.label)}</a>`
      : escapeHtml(family.label);
    const newEyebrow = `<p class="eyebrow">${familyLabel} · ${escapeHtml(bias.typeOfBias)} · Entry`;
    return html.replace(oldEyebrow, newEyebrow);
  });
}

for (const family of publishedFamilies) await emit(`/families/${family.slug}/`, familyPage(family));

// Use record-level update dates instead of pretending every page changed on every build.
const staticPaths = ["/", "/explore/", "/how-it-works/", "/about/", "/privacy/", "/terms/", "/support/"];
const sitemapEntries = [
  ...staticPaths.map((path) => ({ path })),
  ...publishedFamilies.map((family) => ({ path: `/families/${family.slug}/` })),
  ...biases.map((bias) => ({
    path: `/biases/${bias.slug}/`,
    lastmod: /^\d{4}-\d{2}-\d{2}/.test(bias.updatedAt || "") ? bias.updatedAt.slice(0, 10) : undefined,
  })),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.map(({ path, lastmod }) => `  <url><loc>${escapeXml(`${SITE}${path}`)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>\n`;
await mkdir(dirname(join(OUT, "sitemap.xml")), { recursive: true });
await writeFile(join(OUT, "sitemap.xml"), sitemap);

console.log(`Enhanced ${biases.length} bias pages, ${categories.length} category anchors, ${publishedFamilies.length} family hubs, structured data, and sitemap metadata.`);
