import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
const config = JSON.parse(await readFile("data/relations-v2.json", "utf8"));
const duplicates = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const evidenceFiles = (await readdir("data"))
  .filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name))
  .sort();
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const reviewedSlugs = new Set(evidenceDocs.flatMap((document) => document.reviews || []).map((review) => review.slug));
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

const adjacency = new Map();
const seen = new Set();
for (const relation of config.relations || []) {
  const type = config.relationTypes?.[relation.type];
  if (!type) throw new Error(`${relation.leftSlug} ↔ ${relation.rightSlug}: unknown relation type ${relation.type}.`);
  if (relation.leftSlug === relation.rightSlug) throw new Error(`${relation.leftSlug}: self relation is not allowed.`);
  const left = bySlug.get(relation.leftSlug);
  const right = bySlug.get(relation.rightSlug);
  if (!left || !right) throw new Error(`${relation.leftSlug} ↔ ${relation.rightSlug}: relation target is not published.`);
  if (duplicateIds.has(left.id) || duplicateIds.has(right.id)) throw new Error(`${relation.leftSlug} ↔ ${relation.rightSlug}: relations v2 must target canonical records.`);
  if (!reviewedSlugs.has(left.slug) || !reviewedSlugs.has(right.slug)) throw new Error(`${relation.leftSlug} ↔ ${relation.rightSlug}: both relation targets must be evidence-reviewed.`);
  if (!relation.note || relation.note.length < 80) throw new Error(`${relation.leftSlug} ↔ ${relation.rightSlug}: relation note is too thin.`);
  const pair = [left.slug, right.slug].sort().join("::");
  const key = `${relation.type}::${pair}`;
  if (seen.has(key)) throw new Error(`${relation.leftSlug} ↔ ${relation.rightSlug}: duplicate unordered relation/type pair.`);
  seen.add(key);

  for (const [source, target] of [[left, right], [right, left]]) {
    if (!adjacency.has(source.slug)) adjacency.set(source.slug, []);
    adjacency.get(source.slug).push({ relation, target, type });
  }
}

for (const bias of biases) {
  const path = join(OUT, "biases", bias.slug, "index.html");
  let html = await readFile(path, "utf8");
  if (html.includes('<section class="related">')) {
    html = html.replace('<section class="related">', '<section class="related legacy-related"><p class="legacy-related__label">Original library links</p>');
  }

  const relations = adjacency.get(bias.slug) || [];
  if (relations.length && !html.includes('class="evidence-relations"')) {
    const cards = relations
      .sort((a, b) => a.target.title.localeCompare(b.target.title))
      .map(({ relation, target, type }) => `<article class="relation-card" data-relation-type="${escapeHtml(relation.type)}"><span class="relation-type">${escapeHtml(type.label)}</span><h3><a href="/biases/${target.slug}/#evidence">${escapeHtml(target.title)}</a></h3><p>${escapeHtml(relation.note)}</p><a class="relation-evidence-link" href="/biases/${target.slug}/#evidence">Open reviewed entry <span aria-hidden="true">→</span></a></article>`)
      .join("");
    const section = `<section class="evidence-relations" id="evidence-linked-concepts"><p class="kicker">Evidence-linked concepts</p><h2>Nearby ideas, with the relationship made explicit.</h2><p class="lede">These links are reviewed separately from the original library’s related-entry suggestions. A relation means the concepts overlap or are often confused; it does not mean they are interchangeable.</p><div class="relation-grid">${cards}</div></section>`;
    const marker = '<section class="related legacy-related">';
    if (!html.includes(marker)) throw new Error(`${bias.slug}: legacy related-section marker missing for relations v2 insertion.`);
    html = html.replace(marker, `${section}${marker}`);
  }
  await writeFile(path, html);
}

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".evidence-relations{")) {
  styles += `\n.evidence-relations{margin-top:3rem;padding-top:2rem;border-top:var(--line)}.evidence-relations h2{margin-top:.4rem}.relation-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-left:var(--line);border-top:var(--line);margin-top:1.4rem}.relation-card{display:flex;flex-direction:column;gap:.65rem;padding:1.1rem;border-right:var(--line);border-bottom:var(--line);background:#fff}.relation-card h3{font:1.05rem/1.1 Archivo Black,sans-serif;letter-spacing:-.035em;margin:0}.relation-card h3 a{text-decoration:none}.relation-card h3 a:hover{text-decoration:underline}.relation-card p{margin:.1rem 0}.relation-type{align-self:flex-start;padding:.2rem .45rem;border:2px solid var(--ink);background:var(--cyan);font-size:.72rem;font-weight:900;text-transform:uppercase}.relation-evidence-link{margin-top:auto;font-weight:900}.legacy-related{opacity:.82}.legacy-related__label{display:inline-block;margin:1rem 0 .15rem;padding:.18rem .42rem;border:2px solid var(--ink);background:var(--paper);font-size:.7rem;font-weight:900;text-transform:uppercase;letter-spacing:.04em}@media(max-width:760px){.relation-grid{grid-template-columns:1fr}}\n`;
  await writeFile(stylesPath, styles);
}

console.log(`Relations v2 applied: ${config.relations.length} reviewed edges across ${adjacency.size} canonical evidence-reviewed entry pages; legacy related links relabeled separately.`);
