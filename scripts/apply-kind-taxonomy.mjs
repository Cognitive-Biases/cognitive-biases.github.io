import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const kindsConfig = JSON.parse(await readFile("data/kinds-v2.json", "utf8"));
const duplicateDispositions = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicateDispositions.groups || []).flatMap((group) => group.duplicateIds || []));
const canonicalBiases = biases.filter((bias) => !duplicateIds.has(bias.id));
const overrides = kindsConfig.recordKindOverrides || {};

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);
const canonicalName = (bias) => String(bias.canonicalName || bias.title || "").split(/\s+[–—]\s+|\s+-\s+/)[0].trim();
const normalizeText = (value = "") => String(value).normalize("NFKD").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const inferredKind = (bias) => {
  const explicit = overrides[String(bias.id)];
  if (explicit) return explicit;
  const normalized = normalizeText(canonicalName(bias));
  if (/\bheuristic\b/.test(normalized)) return "heuristic";
  if (/\bfallacy\b/.test(normalized)) return "fallacy";
  if (/\bprinciple\b|\blaw\b/.test(normalized)) return "principle";
  if (/\beffect\b/.test(normalized)) return "effect";
  if (/\bbias\b/.test(normalized)) return "bias";
  if (/\billusion\b|\bsyndrome\b|\bphenomenon\b|\bparadox\b/.test(normalized)) return "phenomenon";
  return null;
};

for (const [id, kind] of Object.entries(overrides)) {
  const bias = biases.find((item) => String(item.id) === id);
  if (!bias) throw new Error(`Kind override ${id} points to a non-published record.`);
  if (duplicateIds.has(bias.id)) throw new Error(`${bias.slug}: kind override must target a canonical record.`);
  if (!kindsConfig.kinds[kind]) throw new Error(`${bias.slug}: unknown kind ${kind}.`);
}

const groups = new Map(Object.keys(kindsConfig.kinds).map((kind) => [kind, []]));
for (const bias of canonicalBiases) {
  const kind = inferredKind(bias);
  if (!kind) continue;
  if (!kindsConfig.kinds[kind]) throw new Error(`${bias.slug}: resolved unknown kind ${kind}.`);
  groups.get(kind).push(bias);
}
const resolvedCount = [...groups.values()].reduce((total, records) => total + records.length, 0);

for (const bias of biases) {
  const kind = inferredKind(bias);
  if (!kind) continue;
  const meta = kindsConfig.kinds[kind];
  const path = join(OUT, "biases", bias.slug, "index.html");
  let html = await readFile(path, "utf8");
  if (!html.includes('class="kind-chip"')) {
    const marker = '<p class="eyebrow">';
    if (!html.includes(marker)) throw new Error(`${bias.slug}: kind chip insertion point missing.`);
    const chip = `<a class="kind-chip" data-kind="${kind}" href="/kinds/#${kind}" title="${escapeHtml(meta.description)}">${escapeHtml(meta.label)}</a><span class="kind-sep" aria-hidden="true"> · </span>`;
    html = html.replace(marker, `${marker}${chip}`);
    await writeFile(path, html);
  }
}

const cards = Object.entries(kindsConfig.kinds).map(([kind, meta]) => {
  const records = groups.get(kind) || [];
  const examples = records.slice(0, 5).map((bias) => `<li><a href="/biases/${bias.slug}/">${escapeHtml(bias.title)}</a></li>`).join("");
  return `<article class="kind-card" id="${kind}"><div class="kind-card__head"><span class="kind-chip" data-kind="${kind}">${escapeHtml(meta.label)}</span><strong>${records.length} canonical entries</strong></div><p>${escapeHtml(meta.description)}</p>${examples ? `<h2>Examples</h2><ul>${examples}</ul>` : `<p class="fine-print">No reviewed or name-explicit entries currently resolve to this kind.</p>`}</article>`;
}).join("");

const canonical = `${SITE}/kinds/`;
const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": `${canonical}#page`,
      url: canonical,
      name: "Entry types | Cognitive Biases",
      description: "The controlled entry-type vocabulary used by Cognitive Biases to distinguish biases, effects, heuristics, fallacies, phenomena, and principles.",
      isPartOf: { "@id": `${SITE}/#website` },
    },
    {
      "@type": "ItemList",
      "@id": `${canonical}#kinds`,
      numberOfItems: Object.keys(kindsConfig.kinds).length,
      itemListElement: Object.entries(kindsConfig.kinds).map(([kind, meta], index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: meta.label,
        url: `${canonical}#${kind}`,
      })),
    },
  ],
};
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>Entry types | Cognitive Biases</title><meta name="description" content="Understand the difference between biases, effects, heuristics, fallacies, phenomena, and principles in the Cognitive Biases knowledge base."><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="Entry types | Cognitive Biases"><meta property="og:description" content="A controlled vocabulary for the different kinds of entries in the Cognitive Biases knowledge base."><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE}/assets/icon2.png"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="/"><img src="/assets/icon2.png" width="48" height="48" alt="Cognitive Biases cat icon"><span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/explore/">Explore</a><a href="/contexts/">Contexts</a><a href="/compare/">Compare</a><a href="/evidence/">Evidence</a><a href="/tools/decision-audit/">Audit</a><a href="/how-it-works/">How it works</a><a href="/about/">About</a></nav></header><main id="main"><section class="page-hero"><p class="eyebrow">Taxonomy v2</p><h1>Not every entry is the same kind of thing.</h1><p class="lede">“Cognitive Biases” is the umbrella project name. The corpus also contains effects, heuristics, fallacies, phenomena, and principles. This vocabulary makes those differences explicit without pretending an unreviewed label is scientifically settled.</p></section><section class="section"><p class="kicker">Current coverage</p><h2>${resolvedCount} of ${canonicalBiases.length} canonical entries have a conservative kind assignment.</h2><p class="lede">Assignments come from explicit words in the canonical name or a small reviewed override list. The remaining ${canonicalBiases.length - resolvedCount} entries stay unassigned until their type is clear enough to defend.</p><div class="kind-grid">${cards}</div></section></main><footer class="site-footer"><div><a class="brand brand--footer" href="/"><img src="/assets/icon2.png" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p>An educational reference for noticing the patterns that shape judgment.</p></div><div class="footer-links"><a href="/explore/">Explore biases</a><a href="/kinds/">Entry types</a><a href="/contexts/">Decision contexts</a><a href="/evidence/">Evidence reviews</a><a href="/tools/decision-audit/">Decision Audit</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/support/">Support</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p><p class="fine-print">Made by <a href="https://metalhatscats.com/">MetalHatsCats</a></p></footer></body></html>`;
const target = join(OUT, "kinds", "index.html");
await mkdir(dirname(target), { recursive: true });
await writeFile(target, page);

const explorePath = join(OUT, "explore", "index.html");
let explore = await readFile(explorePath, "utf8");
if (!explore.includes('class="kind-summary"')) {
  const block = `<aside class="kind-summary"><div><p class="kicker">Entry types</p><strong>${resolvedCount} / ${canonicalBiases.length} canonical entries now distinguish bias, effect, heuristic, fallacy, phenomenon, or principle.</strong></div><a href="/kinds/">How entry types work <span aria-hidden="true">→</span></a></aside>`;
  const marker = '<div class="filter" role="search">';
  if (!explore.includes(marker)) throw new Error("Explore kind-summary insertion point missing.");
  explore = explore.replace(marker, `${block}${marker}`);
  await writeFile(explorePath, explore);
}

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".kind-chip{")) {
  styles += `\n.kind-chip{display:inline-block;padding:.18rem .42rem;border:2px solid var(--ink);background:var(--yellow);color:var(--ink);font-size:.7rem;font-weight:900;line-height:1.2;text-transform:uppercase;text-decoration:none;vertical-align:middle}.kind-chip:hover{text-decoration:underline}.kind-sep{margin:0 .08rem}.kind-summary{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin:1.25rem 0;padding:1rem;border:var(--line);background:#fff;box-shadow:5px 5px 0 var(--cyan)}.kind-summary .kicker{margin:0 0 .25rem}.kind-summary strong{max-width:760px}.kind-summary>a{font-weight:900}.kind-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-left:var(--line);border-top:var(--line);margin-top:1.5rem}.kind-card{padding:1.2rem;border-right:var(--line);border-bottom:var(--line);background:#fff}.kind-card__head{display:flex;align-items:center;justify-content:space-between;gap:.8rem;flex-wrap:wrap}.kind-card__head>strong{font-size:.82rem}.kind-card h2{font:1rem Archivo Black,sans-serif;margin:1.2rem 0 .45rem}.kind-card ul{padding-left:1.2rem;display:grid;gap:.4rem}.kind-card li a{font-weight:800}@media(max-width:760px){.kind-grid{grid-template-columns:1fr}}\n`;
  await writeFile(stylesPath, styles);
}

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
if (!sitemap.includes(`<loc>${canonical}</loc>`)) {
  sitemap = sitemap.replace("</urlset>", `  <url><loc>${canonical}</loc></url>\n</urlset>`);
  await writeFile(sitemapPath, sitemap);
}

console.log(`Kind taxonomy applied: ${resolvedCount}/${canonicalBiases.length} canonical entries resolved across ${Object.keys(kindsConfig.kinds).length} controlled kinds; ${canonicalBiases.length - resolvedCount} remain intentionally unassigned.`);
