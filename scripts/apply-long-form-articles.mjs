import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const longFormFiles = (await readdir("data/long-form"))
  .filter((name) => /^[a-z0-9-]+\.json$/i.test(name))
  .sort();
const articlesDoc = {
  entries: await Promise.all(longFormFiles.map(async (name) => {
    const entry = JSON.parse(await readFile(join("data/long-form", name), "utf8"));
    if (entry.slug !== name.replace(/\.json$/, "")) throw new Error(`${name}: file name must match the canonical slug ${entry.slug}.`);
    return entry;
  })),
};
const everydayDoc = JSON.parse(await readFile("data/everyday-guides.json", "utf8"));
const siteIdentity = JSON.parse(await readFile("config/site-identity.json", "utf8"));
const duplicateDispositions = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicateDispositions.groups || []).flatMap((group) => group.duplicateIds || []));
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));

const evidenceFiles = (await readdir("data"))
  .filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name))
  .sort();
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const reviewBySlug = new Map(evidenceDocs.flatMap((doc) => doc.reviews || []).map((review) => [review.slug, review]));
const everydayByBias = new Map();
for (const guide of everydayDoc.entries || []) {
  if (!everydayByBias.has(guide.biasSlug)) everydayByBias.set(guide.biasSlug, []);
  everydayByBias.get(guide.biasSlug).push(guide);
}

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);
const slugify = (value = "") => String(value)
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 80);
const wordsIn = (value = "") => (String(value).match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || []).length;

for (const entry of articlesDoc.entries || []) {
  const bias = bySlug.get(entry.slug);
  if (!bias) throw new Error(`${entry.slug}: long-form article does not match a published bias.`);
  if (duplicateIds.has(bias.id)) throw new Error(`${entry.slug}: long-form article must target a canonical record.`);
  const review = reviewBySlug.get(entry.slug);
  if (!review) throw new Error(`${entry.slug}: long-form article requires an evidence review.`);

  const pagePath = join(OUT, "biases", entry.slug, "index.html");
  let html = await readFile(pagePath, "utf8");
  if (!html.includes('class="evidence-review"')) throw new Error(`${entry.slug}: evidence review must be rendered before long-form article.`);

  const sectionIds = entry.sections.map((section, index) => `${slugify(section.heading) || `section-${index + 1}`}-${index + 1}`);
  const toc = entry.sections
    .map((section, index) => `<li><a href="#${sectionIds[index]}">${escapeHtml(section.heading)}</a></li>`)
    .join("");
  const articleSections = entry.sections.map((section, index) => {
    const paragraphs = section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
    return `<section class="long-form-article__section" aria-labelledby="${sectionIds[index]}"><h3 id="${sectionIds[index]}">${escapeHtml(section.heading)}</h3>${paragraphs}</section>`;
  }).join("");
  const checklist = entry.checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const relatedGuides = (everydayByBias.get(entry.slug) || []).map((guide) => `<a class="long-form-guide-card" href="/everyday/${escapeHtml(guide.slug)}/"><strong>${escapeHtml(guide.title)}</strong><span>${escapeHtml(guide.summary)}</span><b>${escapeHtml(guide.takeaway)}</b></a>`).join("");
  const relatedGuidesSection = relatedGuides
    ? `<section class="long-form-article__related"><h3>Practice this in a real situation</h3><div class="long-form-guide-grid">${relatedGuides}</div></section>`
    : "";

  const wordCount = wordsIn([entry.lede, ...entry.sections.flatMap((section) => section.paragraphs), ...entry.checklist, entry.boundaryNote].join(" "));
  const readingMinutes = Math.max(3, Math.ceil(wordCount / 220));
  const articleSection = `<section class="long-form-article" id="long-form"><div class="long-form-article__head"><div><p class="kicker">Long-form guide</p><h2>${escapeHtml(entry.headline)}</h2></div><p class="long-form-article__meta">${wordCount.toLocaleString("en-US")} words · about ${readingMinutes} min</p></div><p class="long-form-article__lede">${escapeHtml(entry.lede)}</p><nav class="long-form-article__toc" aria-label="On this guide"><strong>On this guide</strong><ol>${toc}</ol></nav>${articleSections}<section class="long-form-article__check"><h3>Decision checklist</h3><ul>${checklist}</ul></section><aside class="long-form-article__boundary"><strong>Evidence boundary</strong><p>${escapeHtml(entry.boundaryNote)}</p></aside>${relatedGuidesSection}<p class="long-form-article__migration">Restored from the earlier MetalHatsCats long-form layer and rewritten for the current evidence-first model. The evidence review and reviewed sources below remain the source of truth for scientific claims.</p></section>`;

  if (!html.includes('class="long-form-article"')) {
    html = html.replace('<section class="evidence-review"', `${articleSection}<section class="evidence-review"`);
  }

  const pageUrl = `${SITE}/biases/${entry.slug}/`;
  const publisher = {
    "@type": "Organization",
    name: siteIdentity.publisher?.name || "MetalHatsCats",
    url: siteIdentity.publisher?.url || "https://metalhatscats.com/",
  };
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${pageUrl}#long-form-article`,
    headline: entry.headline,
    description: entry.lede,
    url: `${pageUrl}#long-form`,
    mainEntityOfPage: pageUrl,
    about: { "@id": `${pageUrl}#term` },
    dateModified: entry.reviewedAt,
    wordCount,
    timeRequired: `PT${readingMinutes}M`,
    author: publisher,
    publisher,
    citation: review.sources.map((source) => source.url),
    isBasedOn: entry.legacySourceUrl,
  };
  if (!html.includes(`${pageUrl}#long-form-article`)) {
    html = html.replace("</head>", `<script type="application/ld+json">${JSON.stringify(articleSchema)}</script></head>`);
  }
  await writeFile(pagePath, html);
}

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".long-form-article{")) {
  styles += `\n.long-form-article{margin-top:3.5rem;padding:clamp(1.25rem,3vw,2rem);border:var(--line);background:#fff;box-shadow:8px 8px 0 var(--yellow)}.long-form-article__head{display:flex;align-items:flex-start;justify-content:space-between;gap:1.5rem;flex-wrap:wrap}.long-form-article__head .kicker{margin:0 0 .55rem}.long-form-article__head h2{margin:0;max-width:760px}.long-form-article__meta{margin:.25rem 0 0;font-size:.82rem;font-weight:900;color:#5a6475;white-space:nowrap}.long-form-article__lede{font-size:1.16rem;font-weight:800;max-width:900px;margin:1.4rem 0}.long-form-article__toc{display:block;margin:1.5rem 0 2rem;padding:1rem 1.1rem;border:2px solid var(--ink);background:var(--paper)}.long-form-article__toc strong{font:1rem Archivo Black,sans-serif;letter-spacing:-.03em}.long-form-article__toc ol{margin:.7rem 0 0;padding-left:1.35rem;columns:2;column-gap:2rem}.long-form-article__toc li{break-inside:avoid;margin:.35rem 0}.long-form-article__toc a{font-weight:800}.long-form-article__section{scroll-margin-top:1.5rem}.long-form-article__section h3,.long-form-article__check h3,.long-form-article__related h3{font:1.2rem Archivo Black,sans-serif;letter-spacing:-.04em;margin:2.2rem 0 .75rem}.long-form-article__section p{margin:.85rem 0}.long-form-article__check{margin-top:2.2rem;padding:1.1rem 1.2rem;border:var(--line);background:var(--ink);color:#fff}.long-form-article__check h3{margin:.1rem 0 .8rem}.long-form-article__check ul{margin:0;padding-left:1.25rem;display:grid;gap:.45rem}.long-form-article__boundary{margin-top:1.2rem;padding:1rem 1.1rem;border-left:7px solid var(--cyan);background:#f4fbff}.long-form-article__boundary strong{font:1rem Archivo Black,sans-serif}.long-form-article__boundary p{margin:.45rem 0 0}.long-form-article__related{margin-top:2rem}.long-form-guide-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem}.long-form-guide-card{display:flex;flex-direction:column;gap:.45rem;padding:1rem;border:2px solid var(--ink);text-decoration:none;background:var(--paper)}.long-form-guide-card:hover{background:var(--cyan)}.long-form-guide-card strong{font:1rem Archivo Black,sans-serif;letter-spacing:-.03em}.long-form-guide-card span{font-size:.92rem}.long-form-guide-card b{margin-top:auto;font-size:.88rem}.long-form-article__migration{margin-top:2rem;padding-top:1rem;border-top:2px solid var(--ink);font-size:.82rem;color:#5a6475}@media(max-width:760px){.long-form-article__toc ol{columns:1}.long-form-guide-grid{grid-template-columns:1fr}.long-form-article__meta{white-space:normal}}\n`;
  await writeFile(stylesPath, styles);
}

console.log(`Applied ${articlesDoc.entries.length} evidence-grounded long-form articles.`);
