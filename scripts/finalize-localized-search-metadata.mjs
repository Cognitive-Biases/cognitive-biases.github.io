import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const MAX_META = 155;
const LOCALES = {
  fr: { intl: "fr-FR", stopwords: ["de","du","des","le","la","les","un","une","et","ou","avec","pour","par","sur","en","dans","sans","sous","à","au","aux"] },
  es: { intl: "es-ES", stopwords: ["de","del","el","la","los","las","un","una","y","o","con","para","por","sobre","en","sin","a","al"] },
  "pt-br": { intl: "pt-BR", stopwords: ["de","da","do","das","dos","um","uma","e","ou","com","para","por","sobre","em","sem","a","ao"] },
  it: { intl: "it-IT", stopwords: ["di","del","della","dei","degli","delle","un","una","e","o","con","per","da","su","in","senza","a","al"] },
  de: { intl: "de-DE", stopwords: ["der","die","das","des","den","dem","ein","eine","und","oder","mit","für","von","zu","im","in","auf","über"] },
  ru: { intl: "ru-RU", stopwords: ["и","или","с","со","для","по","на","в","во","из","от","до","о","об","без","под","над","при"] }
};

let filesChecked = 0;
let descriptionsChanged = 0;
let russianCopyChanged = 0;

for (const [locale, config] of Object.entries(LOCALES)) {
  const root = join(OUT, locale);
  let files = [];
  try {
    files = await walkHtml(root);
  } catch {
    continue;
  }

  const stopwords = new Set(config.stopwords);
  for (const file of files) {
    filesChecked += 1;
    let html = await readFile(file, "utf8");
    let dirty = false;

    if (locale === "ru" && html.includes("Это способ задать более хороший вопрос к реальному решению")) {
      html = html.replaceAll(
        "Это способ задать более хороший вопрос к реальному решению",
        "Это способ точнее сформулировать вопрос о реальном решении"
      );
      russianCopyChanged += 1;
      dirty = true;
    }

    const metaTag = findMetaTag(html, "name", "description");
    const current = metaTag ? getAttribute(metaTag, "content") : "";
    if (current && endsWithStopword(current, stopwords, config.intl)) {
      const source = bestSchemaDescription(html, current) || decodeHtml(current);
      const improved = smartShorten(source, stopwords, config.intl, MAX_META);
      if (improved && improved !== decodeHtml(current)) {
        html = replaceMetaContent(html, "name", "description", improved);
        html = replaceMetaContent(html, "property", "og:description", improved);
        descriptionsChanged += 1;
        dirty = true;
      }
    }

    if (dirty) await writeFile(file, html);
  }
}

console.log(`Localized search metadata finalized: ${filesChecked} HTML files checked, ${descriptionsChanged} descriptions repaired, ${russianCopyChanged} Russian copy repair(s).`);

async function walkHtml(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walkHtml(path));
    else if (entry.isFile() && entry.name === "index.html") files.push(path);
  }
  return files;
}

function findMetaTag(html, key, value) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  return tags.find((tag) => getAttribute(tag, key)?.toLowerCase() === value.toLowerCase()) || null;
}

function getAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2] || "";
}

function replaceMetaContent(html, key, value, content) {
  const tag = findMetaTag(html, key, value);
  if (!tag) return html;
  const next = /\bcontent\s*=\s*(["'])(.*?)\1/i.test(tag)
    ? tag.replace(/\bcontent\s*=\s*(["'])(.*?)\1/i, `content="${escapeAttribute(content)}"`)
    : tag.replace(/\s*\/?\>$/, ` content="${escapeAttribute(content)}">`);
  return html.replace(tag, next);
}

function bestSchemaDescription(html, current) {
  const currentPlain = normalizeForCompare(decodeHtml(current));
  const scripts = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const candidates = [];
  for (const match of scripts) {
    try {
      collectDescriptions(JSON.parse(match[1]), candidates);
    } catch {
      // A malformed JSON-LD block is handled by the canonical structured-data checks.
    }
  }
  const prefix = currentPlain.slice(0, Math.min(48, currentPlain.length));
  return candidates
    .filter((value) => normalizeForCompare(value).startsWith(prefix) && value.length > decodeHtml(current).length)
    .sort((a, b) => b.length - a.length)[0] || "";
}

function collectDescriptions(value, output) {
  if (!value || typeof value !== "object") return;
  if (typeof value.description === "string") output.push(value.description.replace(/\s+/g, " ").trim());
  if (Array.isArray(value)) {
    for (const item of value) collectDescriptions(item, output);
    return;
  }
  for (const child of Object.values(value)) collectDescriptions(child, output);
}

function smartShorten(value, stopwords, intl, max) {
  const clean = decodeHtml(String(value || "")).replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= max && !endsWithStopword(clean, stopwords, intl)) return clean;

  let clipped = clean.length > max
    ? clean.slice(0, max - 1).replace(/\s+\S*$/, "")
    : clean.replace(/[.…!?]+$/u, "");
  clipped = clipped.replace(/[\s,;:–—-]+$/u, "").trim();
  while (endsWithStopword(clipped, stopwords, intl)) {
    clipped = clipped.replace(/\s+[\p{L}’'-]+$/u, "").replace(/[\s,;:–—-]+$/u, "").trim();
  }
  if (!clipped) return clean.slice(0, max);
  return `${clipped}…`;
}

function endsWithStopword(value, stopwords, intl) {
  const plain = decodeHtml(String(value || "")).replace(/[.…!?]+$/u, "").trim();
  const terminal = plain.match(/([\p{L}’'-]+)$/u)?.[1]?.toLocaleLowerCase(intl);
  return Boolean(terminal && stopwords.has(terminal));
}

function normalizeForCompare(value) {
  return decodeHtml(String(value || ""))
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
