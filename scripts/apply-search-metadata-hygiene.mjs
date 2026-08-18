import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const TITLE_WARNING_LIMIT = 90;
const DESCRIPTION_WARNING_LIMIT = 240;
const TARGET_DESCRIPTION_LENGTH = 180;
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
const firstSentence = (value = "") => String(value).match(/^.*?[.!?](?=["'’)]?(?:\s|$))/)?.[0]?.trim() || String(value).trim();

function fitText(value, max = TARGET_DESCRIPTION_LENGTH) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max - 1);
  const boundary = slice.lastIndexOf(" ");
  const shortened = (boundary >= Math.floor(max * 0.65) ? slice.slice(0, boundary) : slice).replace(/[,:;\s]+$/, "");
  return `${shortened}.`;
}
function currentTitle(html) {
  return decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
}
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
function setTitle(html, value) {
  const escaped = escapeAttr(value);
  html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${escaped}</title>`);
  html = setMetaContent(html, ["property", "og:title"], value);
  html = setMetaContent(html, ["name", "twitter:title"], value);
  return html;
}
function setDescription(html, value) {
  html = setMetaContent(html, ["name", "description"], value);
  html = setMetaContent(html, ["property", "og:description"], value);
  html = setMetaContent(html, ["name", "twitter:description"], value);
  return html;
}
function researchTitle(note) {
  const plain = String(note.title || "Research | Cognitive Biases").trim();
  if (plain.length <= TITLE_WARNING_LIMIT) return plain;
  const topic = plain.split(":")[0].trim();
  const branded = `${topic} | Cognitive Biases`;
  return branded.length <= TITLE_WARNING_LIMIT ? branded : fitText(topic, 75);
}

let shortenedTitles = 0;
for (const bias of canonicalBiases) {
  const path = join(OUT, "biases", bias.slug, "index.html");
  let html = await readFile(path, "utf8");
  const current = currentTitle(html);
  if (!current || current.length <= TITLE_WARNING_LIMIT) continue;
  const shortTitle = `${conceptName(bias.title)} | Cognitive Biases`;
  if (shortTitle.length >= current.length) continue;
  html = setTitle(html, shortTitle);
  await writeFile(path, html);
  shortenedTitles += 1;
}

let shortenedDescriptions = 0;
for (const comparison of comparisons.entries || []) {
  const path = join(OUT, "compare", comparison.slug, "index.html");
  let html = await readFile(path, "utf8");
  const current = currentDescription(html);
  if (!current || current.length <= DESCRIPTION_WARNING_LIMIT) continue;
  const keyDifference = String(comparison.keyDifference || "").trim();
  const summarySentence = firstSentence(comparison.summary || "");
  const candidate = keyDifference && keyDifference.length <= TARGET_DESCRIPTION_LENGTH ? keyDifference : summarySentence || keyDifference;
  const concise = fitText(candidate);
  if (!concise || concise.length >= current.length) continue;
  html = setDescription(html, concise);
  await writeFile(path, html);
  shortenedDescriptions += 1;
}

let shortenedResearchTitles = 0;
for (const note of researchNotes.entries || []) {
  const path = join(OUT, "research", note.slug, "index.html");
  let html = await readFile(path, "utf8");
  const title = currentTitle(html);
  if (title.length > TITLE_WARNING_LIMIT) {
    const conciseTitle = researchTitle(note);
    if (conciseTitle && conciseTitle.length < title.length) {
      html = setTitle(html, conciseTitle);
      shortenedResearchTitles += 1;
    }
  }
  const current = currentDescription(html);
  if (current && current.length > DESCRIPTION_WARNING_LIMIT) {
    const concise = fitText(firstSentence(note.summary || "") || note.summary || note.title);
    if (concise && concise.length < current.length) {
      html = setDescription(html, concise);
      shortenedDescriptions += 1;
    }
  }
  await writeFile(path, html);
}

for (const comparison of comparisons.entries || []) {
  const html = await readFile(join(OUT, "compare", comparison.slug, "index.html"), "utf8");
  if (currentDescription(html).length > DESCRIPTION_WARNING_LIMIT) throw new Error(`comparison meta description still too long: ${comparison.slug}`);
}
for (const note of researchNotes.entries || []) {
  const html = await readFile(join(OUT, "research", note.slug, "index.html"), "utf8");
  if (currentTitle(html).length > TITLE_WARNING_LIMIT) throw new Error(`research title still too long: ${note.slug}`);
  if (currentDescription(html).length > DESCRIPTION_WARNING_LIMIT) throw new Error(`research meta description still too long: ${note.slug}`);
}

console.log(`Search metadata hygiene shortened ${shortenedTitles} canonical bias titles, ${shortenedResearchTitles} research titles and ${shortenedDescriptions} long descriptions while leaving visible page copy unchanged.`);
