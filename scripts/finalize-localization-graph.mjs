import { access, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const localeManifest = JSON.parse(await readFile("data/locales.json", "utf8"));
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((entry) => entry.published);
const dispositions = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const byId = new Map(biases.map((entry) => [entry.id, entry]));

const publishedHomes = [];
for (const locale of localeManifest.locales || []) {
  const route = locale.code === localeManifest.canonicalLocale
    ? "/"
    : locale.urlBase || `/${locale.code.toLowerCase()}/`;
  const file = route === "/" ? join(OUT, "index.html") : join(OUT, route.replace(/^\//, ""), "index.html");
  try {
    await access(file);
    publishedHomes.push({ code: locale.code, route, file });
  } catch {
    // A locale may be declared before a public home exists. Only published homes join the cluster.
  }
}

const homeCluster = [
  ...publishedHomes.map(({ code, route }) => `<link rel="alternate" hreflang="${escapeAttribute(code)}" href="${SITE}${route}">`),
  `<link rel="alternate" hreflang="x-default" href="${SITE}/">`
].join("");

let homeClustersUpdated = 0;
for (const home of publishedHomes) {
  const html = await readFile(home.file, "utf8");
  const next = replaceHreflangCluster(html, homeCluster);
  if (next !== html) {
    await writeFile(home.file, next);
    homeClustersUpdated += 1;
  }
}

const aliasPairs = [];
for (const group of dispositions.groups || []) {
  const primary = byId.get(group.primaryId);
  if (!primary) throw new Error(`${group.concept}: missing published primary ${group.primaryId}.`);
  const duplicateIds = new Set(group.duplicateIds || []);
  for (const separateId of group.separateIds || []) {
    if (duplicateIds.has(separateId)) throw new Error(`${group.concept}: ${separateId} cannot be both duplicate and separate.`);
    if (!byId.has(separateId)) throw new Error(`${group.concept}: missing published separate record ${separateId}.`);
  }
  for (const duplicateId of duplicateIds) {
    const duplicate = byId.get(duplicateId);
    if (!duplicate) throw new Error(`${group.concept}: missing published duplicate ${duplicateId}.`);
    aliasPairs.push({ concept: group.concept, primary, duplicate });
  }
}

const localizedPages = new Map();
for (const home of publishedHomes.filter((entry) => entry.code !== localeManifest.canonicalLocale)) {
  const root = join(OUT, home.route.replace(/^\//, "").replace(/\/$/, ""));
  const files = await walkHtml(root);
  const records = [];
  for (const file of files) {
    const html = await readFile(file, "utf8");
    const en = alternateHref(html, "en");
    const slug = englishBiasSlug(en);
    if (!slug) continue;
    const canonical = canonicalHref(html);
    if (!canonical) continue;
    records.push({ file, html, slug, canonical, route: new URL(canonical).pathname });
  }
  localizedPages.set(home.code, records);
}

let localizedAliasesCanonicalized = 0;
let internalAliasCardsRemoved = 0;
let internalAliasLinksRewritten = 0;
const localizedAliasUrls = new Set();

for (const [localeCode, records] of localizedPages) {
  const byEnglishSlug = new Map(records.map((record) => [record.slug, record]));
  for (const { primary, duplicate } of aliasPairs) {
    const primaryRecord = byEnglishSlug.get(primary.slug);
    const duplicateRecord = byEnglishSlug.get(duplicate.slug);
    if (!primaryRecord || !duplicateRecord) continue;

    let aliasHtml = duplicateRecord.html;
    aliasHtml = replaceLinkHref(aliasHtml, "canonical", null, primaryRecord.canonical);
    aliasHtml = replaceMetaContent(aliasHtml, "property", "og:url", primaryRecord.canonical);
    aliasHtml = replaceAlternateHref(aliasHtml, localeCode, primaryRecord.canonical);
    aliasHtml = replaceAlternateHref(aliasHtml, "en", `${SITE}/biases/${primary.slug}/`);
    aliasHtml = replaceAlternateHref(aliasHtml, "x-default", `${SITE}/biases/${primary.slug}/`);
    if (aliasHtml !== duplicateRecord.html) {
      await writeFile(duplicateRecord.file, aliasHtml);
      duplicateRecord.html = aliasHtml;
      localizedAliasesCanonicalized += 1;
    }
    localizedAliasUrls.add(duplicateRecord.canonical);

    for (const record of records) {
      if (record.file === duplicateRecord.file) continue;
      let html = await readFile(record.file, "utf8");
      const withoutCards = removeArticlesContainingHref(html, duplicateRecord.route);
      if (withoutCards !== html) {
        internalAliasCardsRemoved += 1;
        html = withoutCards;
      }
      const rewritten = html.replaceAll(`href="${duplicateRecord.route}"`, `href="${primaryRecord.route}"`);
      if (rewritten !== html) {
        internalAliasLinksRewritten += 1;
        html = rewritten;
      }
      if (html !== await readFile(record.file, "utf8")) await writeFile(record.file, html);
    }
  }
}

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
let localizedAliasSitemapUrlsRemoved = 0;
for (const url of localizedAliasUrls) {
  const pattern = new RegExp(`<url>\\s*<loc>${escapeRegex(url)}<\\/loc>[\\s\\S]*?<\\/url>\\s*`, "g");
  const before = sitemap;
  sitemap = sitemap.replace(pattern, "");
  if (sitemap !== before) localizedAliasSitemapUrlsRemoved += 1;
}
await writeFile(sitemapPath, sitemap);

console.log(`Localization graph finalized: ${publishedHomes.length} home locale(s), ${homeClustersUpdated} home hreflang cluster update(s), ${localizedAliasesCanonicalized} localized alias canonical(s), ${localizedAliasSitemapUrlsRemoved} localized alias sitemap URL(s) removed, ${internalAliasCardsRemoved} internal alias card cleanup(s), ${internalAliasLinksRewritten} internal alias link rewrite(s).`);

async function walkHtml(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return []; }
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walkHtml(path));
    else if (entry.isFile() && entry.name === "index.html") files.push(path);
  }
  return files;
}

function replaceHreflangCluster(html, cluster) {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  let next = html;
  for (const tag of tags) {
    if (getAttribute(tag, "rel")?.toLowerCase() === "alternate" && getAttribute(tag, "hreflang")) {
      next = next.replace(tag, "");
    }
  }
  if (!next.includes("</head>")) throw new Error("Cannot finalize hreflang cluster without </head>.");
  return next.replace("</head>", `${cluster}</head>`);
}

function alternateHref(html, code) {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  const tag = tags.find((item) => getAttribute(item, "rel")?.toLowerCase() === "alternate" && getAttribute(item, "hreflang")?.toLowerCase() === code.toLowerCase());
  return tag ? decodeHtml(getAttribute(tag, "href")) : "";
}

function canonicalHref(html) {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  const tag = tags.find((item) => getAttribute(item, "rel")?.toLowerCase() === "canonical");
  return tag ? decodeHtml(getAttribute(tag, "href")) : "";
}

function englishBiasSlug(value) {
  const match = String(value || "").match(/^https:\/\/cognitive-biases\.github\.io\/biases\/([^/]+)\/$/);
  return match?.[1] || "";
}

function replaceLinkHref(html, rel, hreflang, href) {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  const tag = tags.find((item) => {
    if (getAttribute(item, "rel")?.toLowerCase() !== rel.toLowerCase()) return false;
    if (hreflang === null) return true;
    return getAttribute(item, "hreflang")?.toLowerCase() === String(hreflang).toLowerCase();
  });
  if (!tag) return html;
  const nextTag = setAttribute(tag, "href", href);
  return html.replace(tag, nextTag);
}

function replaceAlternateHref(html, hreflang, href) {
  return replaceLinkHref(html, "alternate", hreflang, href);
}

function replaceMetaContent(html, key, value, content) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const tag = tags.find((item) => getAttribute(item, key)?.toLowerCase() === value.toLowerCase());
  if (!tag) return html;
  return html.replace(tag, setAttribute(tag, "content", content));
}

function removeArticlesContainingHref(html, href) {
  return html.replace(/<article\b[\s\S]*?<\/article>/gi, (article) => article.includes(`href="${href}"`) ? "" : article);
}

function setAttribute(tag, name, value) {
  const expression = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i");
  if (expression.test(tag)) return tag.replace(expression, `${name}="${escapeAttribute(value)}"`);
  return tag.replace(/\s*\/?\>$/, ` ${name}="${escapeAttribute(value)}">`);
}

function getAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2] || "";
}

function decodeHtml(value) {
  return String(value || "")
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

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
