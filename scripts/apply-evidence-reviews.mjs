import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const evidence = JSON.parse(await readFile("data/evidence-reviews.json", "utf8"));
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
const duplicateDispositions = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicateDispositions.groups || []).flatMap((group) => group.duplicateIds || []));

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

for (const review of evidence.reviews || []) {
  const bias = bySlug.get(review.slug);
  if (!bias) throw new Error(`${review.slug}: evidence review does not match a published bias.`);
  if (duplicateIds.has(bias.id)) throw new Error(`${review.slug}: evidence review must target the canonical record, not a duplicate alias.`);
  if (!review.evidenceStatus || !review.qualification || !review.mechanism || !review.practical) {
    throw new Error(`${review.slug}: evidence review is missing required editorial fields.`);
  }
  if (!Array.isArray(review.sources) || review.sources.length < 2) {
    throw new Error(`${review.slug}: evidence review requires at least two reviewed sources.`);
  }

  const pagePath = join(OUT, "biases", review.slug, "index.html");
  let html = await readFile(pagePath, "utf8");
  const sources = review.sources.map((source) => `<li><a href="${escapeHtml(source.url)}" rel="external noreferrer">${escapeHtml(source.title)}</a> <span>${escapeHtml(source.type)} · ${source.year}${source.doi ? ` · DOI ${escapeHtml(source.doi)}` : ""}</span></li>`).join("");
  const section = `<section class="evidence-review" id="evidence"><div class="evidence-review__head"><p class="kicker">Evidence review</p><span class="evidence-status">${escapeHtml(review.evidenceStatus)}</span></div><h2>What the evidence supports</h2><p class="evidence-qualification">${escapeHtml(review.qualification)}</p><h3>How researchers describe the pattern</h3><p>${escapeHtml(review.mechanism)}</p><h3>Practical interpretation</h3><p>${escapeHtml(review.practical)}</p><h3>Reviewed sources</h3><ol class="evidence-sources">${sources}</ol><p class="evidence-reviewed">Editorial review: ${escapeHtml(review.reviewedAt)}. Evidence status describes this entry, not every study ever published on the topic.</p></section>`;
  if (!html.includes('class="evidence-review"')) {
    const marker = '<section class="related">';
    if (!html.includes(marker)) throw new Error(`${review.slug}: related-section insertion point was not found.`);
    html = html.replace(marker, `${section}${marker}`);
  }

  const pageUrl = `${SITE}/biases/${review.slug}/`;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${pageUrl}#evidence-review`,
    headline: `${bias.title} — evidence review`,
    dateModified: review.reviewedAt,
    mainEntityOfPage: pageUrl,
    about: { "@id": `${pageUrl}#term` },
    citation: review.sources.map((source) => source.url),
    publisher: { "@type": "Organization", "@id": `${SITE}/#organization`, name: "Cognitive Biases" },
  };
  if (!html.includes(`${pageUrl}#evidence-review`)) {
    html = html.replace("</head>", `<script type="application/ld+json">${JSON.stringify(articleSchema)}</script></head>`);
  }
  await writeFile(pagePath, html);
}

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".evidence-review{")) {
  styles += `\n.evidence-review{margin-top:3.5rem;padding:1.5rem;border:var(--line);background:#fff;box-shadow:8px 8px 0 var(--cyan)}.evidence-review__head{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}.evidence-review .kicker{margin:0}.evidence-review h2{margin-top:1rem}.evidence-review h3{font:1.05rem Archivo Black,sans-serif;letter-spacing:-.035em;margin:1.8rem 0 .5rem}.evidence-status{display:inline-block;border:2px solid var(--ink);background:var(--yellow);padding:.28rem .55rem;font-size:.78rem;font-weight:900;text-transform:uppercase}.evidence-qualification{font-size:1.08rem;font-weight:800}.evidence-sources{display:grid;gap:.7rem;padding-left:1.3rem}.evidence-sources li{padding-left:.25rem}.evidence-sources a{font-weight:900}.evidence-sources span{display:block;font-size:.82rem;color:#5a6475}.evidence-reviewed{margin-top:1.5rem;padding-top:1rem;border-top:2px solid var(--ink);font-size:.82rem;color:#5a6475}\n`;
  await writeFile(stylesPath, styles);
}

console.log(`Applied ${evidence.reviews.length} evidence-reviewed pilot entries.`);
