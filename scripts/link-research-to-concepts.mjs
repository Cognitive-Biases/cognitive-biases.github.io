import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const notes = JSON.parse(await readFile("data/research-notes.json", "utf8"));
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((entry) => entry.published);
const duplicates = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const evidence = JSON.parse(await readFile(join(OUT, "data", "evidence.json"), "utf8"));
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const canonical = new Map(biases.filter((entry) => !duplicateIds.has(entry.id)).map((entry) => [entry.slug, entry]));
const reviewed = new Set((evidence.reviews || []).map((entry) => entry.slug));
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

const notesByConcept = new Map();
for (const note of notes.entries || []) {
  for (const slug of note.related || []) {
    if (!canonical.has(slug)) throw new Error(`${note.slug}: related research concept ${slug} is not canonical.`);
    if (!reviewed.has(slug)) throw new Error(`${note.slug}: related research concept ${slug} is not evidence-reviewed.`);
    if (!notesByConcept.has(slug)) notesByConcept.set(slug, []);
    notesByConcept.get(slug).push(note);
  }
}

let linkedConcepts = 0;
let links = 0;
let fallbackInsertions = 0;
for (const [slug, relatedNotes] of notesByConcept) {
  const file = join(OUT, "biases", slug, "index.html");
  let html = await readFile(file, "utf8");
  if (html.includes('class="research-teaser"')) throw new Error(`${slug}: research teaser already exists before research-link pass.`);
  const noteLinks = relatedNotes.map((note) => `<a href="/research/${note.slug}/">${escapeHtml(note.title)}</a>`).join("");
  const teaser = `<aside class="research-teaser"><span>Research notes</span><div>${noteLinks}</div></aside>`;
  const relatedMarker = '<section class="related">';
  if (html.includes(relatedMarker)) {
    html = html.replace(relatedMarker, `${teaser}${relatedMarker}`);
  } else if (html.includes("</main>")) {
    html = html.replace("</main>", `${teaser}</main>`);
    fallbackInsertions += 1;
  } else {
    throw new Error(`${slug}: neither related section nor main closing tag is available for visible research discovery.`);
  }

  let schemaUpdated = false;
  html = html.replace(/<script type="application\/ld\+json" data-seo-schema="defined-term">([\s\S]*?)<\/script>/, (match, payload) => {
    const schema = JSON.parse(payload);
    const graph = schema?.["@graph"];
    if (!Array.isArray(graph)) throw new Error(`${slug}: DefinedTerm schema graph is missing.`);
    const term = graph.find((node) => node?.["@type"] === "DefinedTerm" && node?.["@id"] === `${SITE}/biases/${slug}/#term`);
    if (!term) throw new Error(`${slug}: DefinedTerm entity is missing from marked schema.`);
    term.subjectOf = relatedNotes.map((note) => ({ "@id": `${SITE}/research/${note.slug}/#article` }));
    schemaUpdated = true;
    return `<script type="application/ld+json" data-seo-schema="defined-term">${JSON.stringify(schema)}</script>`;
  });
  if (!schemaUpdated) throw new Error(`${slug}: marked DefinedTerm schema was not found.`);
  await writeFile(file, html);
  linkedConcepts += 1;
  links += relatedNotes.length;
}

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".research-teaser{")) {
  styles += `\n.research-teaser{display:flex;align-items:flex-start;gap:.8rem;flex-wrap:wrap;margin:1.5rem 0;padding:.9rem 1rem;border:2px solid var(--ink);background:#fff}.research-teaser>span{font-size:.75rem;font-weight:900;text-transform:uppercase;background:var(--pink);border:2px solid var(--ink);padding:.25rem .4rem}.research-teaser>div{display:grid;gap:.35rem;flex:1;min-width:240px}.research-teaser a{font-weight:900}\n`;
  await writeFile(stylesPath, styles);
}

console.log(`Research discovery linked ${links} note-to-concept relationships across ${linkedConcepts} evidence-reviewed concepts; ${fallbackInsertions} page(s) used the no-related fallback.`);
