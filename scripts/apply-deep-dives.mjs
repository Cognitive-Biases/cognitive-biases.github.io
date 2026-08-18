import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
const deepDives = JSON.parse(await readFile("data/deep-dives.json", "utf8"));
const duplicateDispositions = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicateDispositions.groups || []).flatMap((group) => group.duplicateIds || []));

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

for (const entry of deepDives.entries || []) {
  const bias = bySlug.get(entry.slug);
  if (!bias) throw new Error(`${entry.slug}: deep dive does not match a published bias.`);
  if (duplicateIds.has(bias.id)) throw new Error(`${entry.slug}: deep dive must target a canonical record.`);

  const pagePath = join(OUT, "biases", entry.slug, "index.html");
  let html = await readFile(pagePath, "utf8");
  if (!html.includes('class="evidence-review"')) throw new Error(`${entry.slug}: deep dive requires an evidence-reviewed page first.`);

  const diagnostic = entry.diagnostic.map((item) => `<article><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.text)}</p></article>`).join("");
  const distinctions = entry.distinctions.map((item) => `<article><strong>${escapeHtml(item.term)}</strong><p>${escapeHtml(item.text)}</p></article>`).join("");
  const playbook = entry.playbook.map((item, index) => `<li><span>${index + 1}</span><div><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.text)}</p></div></li>`).join("");
  const checklist = entry.systemChecklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const sources = entry.sources.map((source) => `<li><a href="${escapeHtml(source.url)}" rel="external noreferrer">${escapeHtml(source.title)}</a><span>${source.year}${source.doi ? ` · DOI ${escapeHtml(source.doi)}` : ""}</span></li>`).join("");
  const section = `<section class="deep-dive" id="deep-dive"><p class="kicker">Decision diagnostic</p><h2>${escapeHtml(entry.title)}</h2><p class="deep-dive__lede">${escapeHtml(entry.summary)}</p><h3>Test the pattern before naming it</h3><div class="diagnostic-grid">${diagnostic}</div><h3>Do not confuse it with</h3><div class="distinction-grid">${distinctions}</div><h3>A correction playbook</h3><ol class="decision-playbook">${playbook}</ol><div class="system-check"><div><p class="kicker">System design</p><h3>Track enough data to distinguish the outcomes.</h3><p>For important corrections, a small decision log is more useful than arguing over the label after the fact.</p></div><ul>${checklist}</ul></div><h3>Additional sources used for this deep dive</h3><ol class="deep-dive-sources">${sources}</ol><p class="deep-dive-reviewed">Deep dive reviewed ${escapeHtml(entry.reviewedAt)}. It extends the evidence section above; it does not replace the cited evidence status.</p></section>`;
  const marker = '<section class="related">';
  if (!html.includes(marker)) throw new Error(`${entry.slug}: related-section insertion point was not found.`);
  if (!html.includes('class="deep-dive"')) html = html.replace(marker, `${section}${marker}`);

  const pageUrl = `${SITE}/biases/${entry.slug}/`;
  const learningSchema = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    "@id": `${pageUrl}#deep-dive-resource`,
    name: entry.title,
    url: `${pageUrl}#deep-dive`,
    about: { "@id": `${pageUrl}#term` },
    dateModified: entry.reviewedAt,
    educationalUse: ["decision support", "critical thinking"],
    citation: entry.sources.map((source) => source.url),
  };
  if (!html.includes(`${pageUrl}#deep-dive-resource`)) html = html.replace("</head>", `<script type="application/ld+json">${JSON.stringify(learningSchema)}</script></head>`);
  await writeFile(pagePath, html);
}

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".deep-dive{")) {
  styles += `\n.deep-dive{margin-top:3.5rem;padding:clamp(1.2rem,3vw,2rem);border:var(--line);background:var(--paper);box-shadow:8px 8px 0 var(--pink)}.deep-dive>h2{max-width:900px}.deep-dive>h3{font:1.15rem Archivo Black,sans-serif;letter-spacing:-.035em;margin:2.2rem 0 .8rem}.deep-dive__lede{font-size:1.12rem;font-weight:800;max-width:900px}.diagnostic-grid,.distinction-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-left:var(--line);border-top:var(--line)}.diagnostic-grid article,.distinction-grid article{padding:1rem;border-right:var(--line);border-bottom:var(--line);background:#fff}.diagnostic-grid strong,.distinction-grid strong{font:1rem Archivo Black,sans-serif;letter-spacing:-.03em}.diagnostic-grid p,.distinction-grid p{margin:.55rem 0 0}.decision-playbook{list-style:none;padding:0;margin:0;display:grid;gap:.75rem}.decision-playbook li{display:grid;grid-template-columns:42px 1fr;gap:.8rem;align-items:start;padding:.9rem;border:2px solid var(--ink);background:#fff}.decision-playbook li>span{display:grid;place-items:center;width:34px;height:34px;border:2px solid var(--ink);background:var(--yellow);font-weight:900}.decision-playbook strong{font-weight:900}.decision-playbook p{margin:.35rem 0 0}.system-check{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:1.2rem;margin-top:2.2rem;padding:1.2rem;border:var(--line);background:var(--ink);color:#fff}.system-check h3{margin:.4rem 0 .6rem;font:1.15rem Archivo Black,sans-serif;letter-spacing:-.035em}.system-check ul{margin:0;padding-left:1.2rem;display:grid;gap:.45rem}.deep-dive-sources{display:grid;gap:.7rem;padding-left:1.3rem}.deep-dive-sources a{font-weight:900}.deep-dive-sources span{display:block;font-size:.82rem;color:#5a6475}.deep-dive-reviewed{margin-top:1.5rem;padding-top:1rem;border-top:2px solid var(--ink);font-size:.82rem;color:#5a6475}@media(max-width:760px){.diagnostic-grid,.distinction-grid,.system-check{grid-template-columns:1fr}}\n`;
  await writeFile(stylesPath, styles);
}

console.log(`Applied ${deepDives.entries.length} source-grounded deep-dive decision diagnostics.`);
