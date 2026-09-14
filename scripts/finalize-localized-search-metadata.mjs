import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

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
let duplicateGroupsFound = 0;
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

    const current = metaDescription(html);
    if (current) {
      const improved = current.length > MAX_META || endsWithStopword(current, stopwords, config.intl)
        ? smartShorten(current, stopwords, config.intl, MAX_META)
        : current;
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

await repairDuplicateDescriptions();
console.log(`Localized search metadata finalized: ${filesChecked} HTML files checked, ${descriptionsChanged} descriptions repaired, ${duplicateGroupsFound} duplicate group(s) found, ${duplicateRepairs} collision repair(s), ${russianCopyChanged} Russian copy repair(s).`);

async function repairDuplicateDescriptions() {
  const records = [];
  for (const file of await walkAnyHtml(OUT)) {
    const html = await readFile(file, "utf8");
    const description = metaDescription(html);
    if (!description) continue;
    records.push({ file, locale: localeForFile(file), html, description, key: searchQualityKey(description) });
  }

  const groups = new Map();
  for (const record of records) {
    if (!groups.has(record.key)) groups.set(record.key, []);
    groups.get(record.key).push(record);
  }

  const used = new Map();
  for (const record of records) {
    if (!used.has(record.key)) used.set(record.key, record.file);
  }

  for (const group of groups.values()) {
    if (group.length < 2 || !group.some((record) => record.locale)) continue;
    duplicateGroupsFound += 1;

    const protectedRecord = group.find((record) => !record.locale) || group[0];
    const repairTargets = group.filter((record) => record !== protectedRecord && record.locale);

    for (const record of repairTargets) {
      const config = LOCALES[record.locale];
      const stopwords = new Set(config.stopwords);
      const labels = [pageLabel(record.html), pageTitle(record.html)].filter(Boolean);
      let improved = "";

      for (const label of labels) {
        const candidate = makePageSpecific(record.description, label, stopwords, config.intl, MAX_META);
        if (candidate && !used.has(searchQualityKey(candidate))) {
          improved = candidate;
          break;
        }
      }

      if (!improved) {
        const label = labels[0] || localizedRouteLabel(record.file);
        const candidate = smartShorten(`${label}: ${record.description}`, stopwords, config.intl, MAX_META);
        if (candidate && !used.has(searchQualityKey(candidate))) improved = candidate;
      }

      if (!improved) {
        throw new Error(`Unable to make localized meta description unique for ${record.file}.`);
      }

      let html = record.html;
      html = replaceMetaContent(html, "name", "description", improved);
      html = replaceMetaContent(html, "property", "og:description", improved);
      await writeFile(record.file, html);
      used.set(searchQualityKey(improved), record.file);
      descriptionsChanged += 1;
      duplicateRepairs += 1;
    }
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

function localizedRouteLabel(file) {
  const rel = relative(OUT, file).replaceAll("\\", "/").replace(/\/index\.html$/i, "");
  const slug = rel.split("/").filter(Boolean).at(-1) || "page";
  return slug.replaceAll("-", " ");
}

function findMetaTag(html, key, value) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  return tags.find((tag) => getAttribute(tag, key)?.toLowerCase() === value.toLowerCase()) || null;
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
