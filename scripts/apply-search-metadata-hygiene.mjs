import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const TITLE_WARNING_LIMIT = 90;
const DESCRIPTION_WARNING_LIMIT = 240;
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const duplicates = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const canonicalBiases = biases.filter((bias) => !duplicateIds.has(bias.id));
const comparisons = JSON.parse(await readFile("data/comparisons.json", "utf8"));
const researchNotes = JSON.parse(await readFile("data/research-notes.json", "utf8"));

const decode = (value = "") => String(value)
  .replaceAll("&amp;", "&")
  .replaceAll("&quot;", '"')
  .replaceAll("&#39;", "'")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">")
  .trim();
const escapeAttr = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");
const conceptName = (title = "") => String(title).split(/\s+[–—]\s+/)[0].trim();
const firstSentence = (value = "") => String(value).match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || String(value).trim();

function currentDescription(html) {
  const tag = html.match(/<meta\b[^>]*name=["']description["'][^>]*>/i)?.[0] || html.match(/<meta\b[^>]*content=["'][^"']*["'][^>]*name=["']description["'][^>]*>/i)?.[0] || "";
  return decode(tag.match(/\bcontent=["']([^"']*)["']/i)?.[1] || "");
}
function setMetaContent(html, selector, value) {
  const escaped = escapeAttr(value);
  const [attribute, expected] = selector;
  const first = new RegExp(`(<meta\\b[^>]*${attribute}=["']${expected}["'][^>]*content=["'])[^"']*(["'][^>]*>)`, "i");
  const second = new RegExp(`(<meta\\b[^>]*content=["'])[^"']*(["'][^>]*${attribute}=["']${expected}["'][^>]*>)`, "i");
  if (first.test(html)) return html.replace(first, `$1${escaped}$2`);
  if (second.test(html)) return html.replace(second, `$1${escaped}$2`);
  return html;
}
function setDescription(html, value) {
  html = setMetaContent(html, ["name", "description"], value);
  html = setMetaContent(html, ["property", "og:description"], value);
  html = setMetaContent(html, ["name", "twitter:description"], value);
  return html;
}

let shortenedTitles = 0;
for (const bias of canonicalBiases) {
  const path = join(OUT, "biases", bias.slug, "index.html");
  let html = await readFile(path, "utf8");
  const current = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  if (!current || current.length <= TITLE_WARNING_LIMIT) continue;

  const shortTitle = `${conceptName(bias.title)} | Cognitive Biases`;
  if (shortTitle.length >= current.length) continue;
  const escaped = escapeAttr(shortTitle);
  html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${escaped}</title>`);
  html = setMetaContent(html, ["property", "og:title"], shortTitle);
  html = setMetaContent(html, ["name", "twitter:title"], shortTitle);
  await writeFile(path, html);
  shortenedTitles += 1;
}

let shortenedDescriptions = 0;
for (const comparison of comparisons.entries || []) {
  const path = join(OUT, "compare", comparison.slug, "index.html");
  let html = await readFile(path, "utf8");
  const current = currentDescription(html);
  if (!current || current.length <= DESCRIPTION_WARNING_LIMIT) continue;
  const concise = String(comparison.keyDifference || "").trim();
  if (!concise || concise.length >= current.length) continue;
  html = setDescription(html, concise);
  await writeFile(path, html);
  shortenedDescriptions += 1;
}

for (const note of researchNotes.entries || []) {
  const path = join(OUT, "research", note.slug, "index.html");
  let html = await readFile(path, "utf8");
  const current = currentDescription(html);
  if (!current || current.length <= DESCRIPTION_WARNING_LIMIT) continue;
  const concise = firstSentence(note.summary);
  if (!concise || concise.length >= current.length) continue;
  html = setDescription(html, concise);
  await writeFile(path, html);
  shortenedDescriptions += 1;
}

console.log(`Search metadata hygiene shortened ${shortenedTitles} canonical bias titles and ${shortenedDescriptions} long comparison/research descriptions while leaving visible page copy unchanged.`);
