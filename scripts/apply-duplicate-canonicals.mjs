import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const dispositions = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const byId = new Map(biases.map((bias) => [bias.id, bias]));
const aliases = [];

for (const group of dispositions.groups || []) {
  const primary = byId.get(group.primaryId);
  if (!primary) throw new Error(`${group.concept}: primary id ${group.primaryId} is not a published record.`);
  const duplicateIds = new Set(group.duplicateIds || []);
  for (const separateId of group.separateIds || []) {
    if (duplicateIds.has(separateId)) throw new Error(`${group.concept}: id ${separateId} cannot be duplicate and separate.`);
    if (!byId.has(separateId)) throw new Error(`${group.concept}: separate id ${separateId} is not a published record.`);
  }
  for (const duplicateId of duplicateIds) {
    const duplicate = byId.get(duplicateId);
    if (!duplicate) throw new Error(`${group.concept}: duplicate id ${duplicateId} is not a published record.`);
    if (duplicate.id === primary.id) throw new Error(`${group.concept}: primary cannot duplicate itself.`);
    aliases.push({ concept: group.concept, primary, duplicate });
  }
}

for (const { concept, primary, duplicate } of aliases) {
  const path = join(OUT, "biases", duplicate.slug, "index.html");
  let html = await readFile(path, "utf8");
  const selfUrl = `${SITE}/biases/${duplicate.slug}/`;
  const primaryUrl = `${SITE}/biases/${primary.slug}/`;
  html = html.replace(`<link rel="canonical" href="${selfUrl}">`, `<link rel="canonical" href="${primaryUrl}">`);
  html = html.replace(`<meta property="og:url" content="${selfUrl}">`, `<meta property="og:url" content="${primaryUrl}">`);
  const notice = `<aside class="consolidation-note"><strong>Consolidated entry.</strong> This URL is kept for existing links. The reviewed canonical entry is <a href="/biases/${primary.slug}/">${primary.title}</a>.</aside>`;
  if (!html.includes('class="consolidation-note"')) html = html.replace("</h1>", `</h1>${notice}`);
  await writeFile(path, html);
  console.log(`Canonicalized duplicate #${duplicate.id} ${concept} -> #${primary.id}.`);
}

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".consolidation-note{")) {
  styles += "\n.consolidation-note{margin:-.4rem 0 2rem;padding:1rem 1.1rem;border:var(--line);background:var(--yellow);box-shadow:5px 5px 0 var(--ink)}.consolidation-note strong{font-weight:900}.consolidation-note a{font-weight:900}\n";
  await writeFile(stylesPath, styles);
}

const sitemapPath = join(OUT, "sitemap.xml");
const sitemap = await readFile(sitemapPath, "utf8");
const duplicateUrls = new Set(aliases.map(({ duplicate }) => `${SITE}/biases/${duplicate.slug}/`));
const filtered = sitemap
  .split("\n")
  .filter((line) => ![...duplicateUrls].some((url) => line.includes(`<loc>${url}</loc>`)))
  .join("\n");
await writeFile(sitemapPath, filtered);

console.log(`Duplicate canonicalization applied: ${aliases.length} alias pages retained, ${aliases.length} duplicate sitemap URLs removed.`);
