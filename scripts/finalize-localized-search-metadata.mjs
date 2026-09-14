import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const SITE = "https://cognitive-biases.github.io";
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
let duplicateRepairs = 0;
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
    const current = metaTag ? decodeHtml(getAttribute(metaTag, "content")) : "";
    if (current) {
      let improved = current;
      if (current.length > MAX_META || endsWithStopword(current, stopwords, config.intl)) {
        improved = smartShorten(current, stopwords, config.intl, MAX_META);
      }
      if (improved && improved !== current) {
        html = replaceMetaContent(html, "name", "description", improved);
        html = replaceMetaContent(html, "property", "og:description", improved);
        descriptionsChanged += 1;
        dirty = true;
      }
    }

    if (dirty) await writeFile(file, html);
  }
}

await repairFinalCanonicalDuplicates();
console.log(`Localized search metadata finalized: ${filesChecked} HTML files checked, ${descriptionsChanged} descriptions repaired, ${duplicateRepairs} collision repair(s), ${russianCopyChanged} Russian copy repair(s).`);

async function repairFinalCanonicalDuplicates() {
  const files = await walkAnyHtml(OUT);
  const nonLocalized = [];
  const localized = [];
  for (const file of files) {
    const locale = localeForFile(file);
    (locale ? localized : nonLocalized).push({ file, locale });
  }

  const owners = new Map();
  for (const { file } of nonLocalized) {
    const html = await readFile(file, "utf8");
    if (!isIndexableSelfCanonical(html, file)) continue;
    const description = metaDescription(html);
    if (description) owners.set(searchQualityKey(description), file);
  }

  for (const { file, locale } of localized) {
    let html = await readFile(file, "utf8");
    if (!isIndexableSelfCanonical(html, file)) continue;
    const description = metaDescription(html);
    if (!description) continue;
    let key = searchQualityKey(description);
    if (!owners.has(key)) {
      owners.set(key, file);
      continue;
    }

    const config = LOCALES[locale];
    const stopwords = new Set(config.stopwords);
    const labels = [pageLabel(html), pageTitle(html)].filter(Boolean);
    let improved = description;
    for (const label of labels) {
      improved = makePageSpecific(description, label, stopwords, config.intl, MAX_META);
      key = searchQualityKey(improved);
      if (!owners.has(key)) break;
    }
    if (owners.has(key)) {
      throw new Error(`Unable to keep final canonical meta description unique for ${file}; collides with ${owners.get(key)}.`);
    }

    html = replaceMetaContent(html, "name", "description", improved);
    html = replaceMetaContent(html, "property", "og:description", improved);
    await writeFile(file, html);
    owners.set(key, file);
    descriptionsChanged += 1;
    duplicateRepairs += 1;
  }
}

async function walkHtml(dir) {
  const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walkHtml(path));
    else if (entry.isFile() && entry.name === "index.html") files.push(path);
  }
  return files;
}

async function walkAnyHtml(dir) {
  const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walkAnyHtml(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

function localeForFile(file) {
  const rel = relative(OUT, file).replaceAll("\\", "/");
  const first = rel.split("/")[0].toLowerCase();
  return LOCALES[first] ? first : "";
}

function publicPath(file) {
  const rel = relative(OUT, file).replaceAll("\\", "/");
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return `/${rel.slice(0, -"index.html".length)}`;
  return `/${rel}`;
}

function isIndexableSelfCanonical(html, file) {
  const robots = findMetaTag(html, "name", "robots");
  if (robots && decodeHtml(getAttribute(robots, "content")).toLowerCase().includes("noindex")) return false;
  const canonicalTag = findLinkTag(html, "canonical");
  const canonical = canonicalTag ? normalizeUrl(getAttribute(canonicalTag, "href")) : "";
  const own = normalizeUrl(`${SITE}${publicPath(file)}`);
  return Boolean(canonical && canonical === own);
}

function findMetaTag(html, key, value) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  return tags.find((tag) => getAttribute(tag, key)?.toLowerCase() === value.toLowerCase()) || null;
}

function findLinkTag(html, relValue) {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  return tags.find((tag) => getAttribute(tag, "rel")?.toLowerCase() === relValue.toLowerCase()) || null;
}

function getAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2] || "";
}

function metaDescription(html) {
  const tag = findMetaTag(html, "name", "description");
  return tag ? searchQualityDecode(getAttribute(tag, "content")) : "";
}

function replaceMetaContent(html, key, value, content) {
  const tag = findMetaTag(html, key, value);
  if (!tag) return html;
  const next = /\bcontent\s*=\s*(["'])(.*?)\1/i.test(tag)
    ? tag.replace(/\bcontent\s*=\s*(["'])(.*?)\1/i, `content="${escapeAttribute(content)}"`)
    : tag.replace(/\s*\/?\>$/, ` content="${escapeAttribute(content)}">`);
  return html.replace(tag, next);
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
  if (!clipped) return clean.slice(0, max).trim();
  return `${clipped}…`;
}

function makePageSpecific(source, label, stopwords, intl, max) {
  const cleanLabel = String(label || "").replace(/\s+/g, " ").trim();
  if (!cleanLabel) return smartShorten(source, stopwords, intl, max);
  return smartShorten(`${cleanLabel}: ${source}`, stopwords, intl, max);
}

function pageLabel(html) {
  const match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? textContent(match[1]) : "";
}

function pageTitle(html) {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? textContent(match[1]).split(/\s+[|–—]\s+/)[0].trim() : "";
}

function textContent(value) {
  return decodeHtml(String(value || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function endsWithStopword(value, stopwords, intl) {
  const plain = decodeHtml(String(value || "")).replace(/[.…!?]+$/u, "").trim();
  const terminal = plain.match(/([\p{L}’'-]+)$/u)?.[1]?.toLocaleLowerCase(intl);
  return Boolean(terminal && stopwords.has(terminal));
}

function searchQualityDecode(value) {
  return String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/\s+/g, " ")
    .trim();
}

function searchQualityKey(value) {
  return searchQualityDecode(value).toLowerCase();
}

function normalizeUrl(value) {
  try {
    const parsed = new URL(value, SITE);
    parsed.hash = "";
    parsed.search = "";
    return parsed.href;
  } catch {
    return "";
  }
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
