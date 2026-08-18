import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const TITLE_WARNING_LIMIT = 90;
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const duplicates = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const canonicalBiases = biases.filter((bias) => !duplicateIds.has(bias.id));

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

let shortened = 0;
for (const bias of canonicalBiases) {
  const path = join(OUT, "biases", bias.slug, "index.html");
  let html = await readFile(path, "utf8");
  const current = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  if (!current || current.length <= TITLE_WARNING_LIMIT) continue;

  const shortTitle = `${conceptName(bias.title)} | Cognitive Biases`;
  if (shortTitle.length >= current.length) continue;
  const escaped = escapeAttr(shortTitle);
  html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${escaped}</title>`);
  html = html.replace(/(<meta\b[^>]*property=["']og:title["'][^>]*content=["'])[^"']*(["'][^>]*>)/i, `$1${escaped}$2`);
  html = html.replace(/(<meta\b[^>]*content=["'])[^"']*(["'][^>]*property=["']og:title["'][^>]*>)/i, `$1${escaped}$2`);
  html = html.replace(/(<meta\b[^>]*name=["']twitter:title["'][^>]*content=["'])[^"']*(["'][^>]*>)/i, `$1${escaped}$2`);
  html = html.replace(/(<meta\b[^>]*content=["'])[^"']*(["'][^>]*name=["']twitter:title["'][^>]*>)/i, `$1${escaped}$2`);
  await writeFile(path, html);
  shortened += 1;
}

console.log(`Search metadata hygiene shortened ${shortened} canonical bias titles while leaving visible H1 copy unchanged.`);
