import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

const decode = (value = "") => String(value)
  .replaceAll("&amp;", "&")
  .replaceAll("&quot;", '"')
  .replaceAll("&#39;", "'")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">")
  .replace(/\s+/g, " ")
  .trim();
const stripTags = (value = "") => decode(String(value).replace(/<[^>]+>/g, " "));
const one = (html, pattern) => html.match(pattern)?.[1] || "";
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"))?.[1] || "";

function publicPath(file) {
  const rel = relative(OUT, file).replaceAll("\\", "/");
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return `/${rel.slice(0, -"index.html".length)}`;
  return `/${rel}`;
}
function selfUrl(path) {
  return `${SITE}${path}`;
}
function internalTarget(href, currentPath) {
  if (!href || href.startsWith("#") || /^(?:https?:|mailto:|tel:|javascript:|data:)/i.test(href)) return null;
  const base = new URL(currentPath, SITE);
  const url = new URL(href, base);
  if (url.origin !== SITE) return null;
  return { path: url.pathname, hash: url.hash };
}
function fileForPath(pathname) {
  const clean = decodeURIComponent(pathname);
  if (clean === "/") return join(OUT, "index.html");
  if (/\.[a-z0-9]+$/i.test(clean)) return join(OUT, clean.replace(/^\//, ""));
  return join(OUT, clean.replace(/^\//, ""), "index.html");
}
function normalizeUrl(url) {
  try {
    const parsed = new URL(url, SITE);
    parsed.hash = "";
    parsed.search = "";
    return parsed.href;
  } catch {
    return "";
  }
}

const files = await walk(OUT);
const pages = [];
const byUrl = new Map();
for (const file of files) {
  const html = await readFile(file, "utf8");
  const path = publicPath(file);
  const title = stripTags(one(html, /<title[^>]*>([\s\S]*?)<\/title>/i));
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => stripTags(match[1]));
  const canonicalTag = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)?.[0] || html.match(/<link\b[^>]*href=["'][^"']+["'][^>]*rel=["']canonical["'][^>]*>/i)?.[0] || "";
  const canonical = normalizeUrl(attr(canonicalTag, "href"));
  const metaDescriptionTag = html.match(/<meta\b[^>]*name=["']description["'][^>]*>/i)?.[0] || html.match(/<meta\b[^>]*content=["'][^"']*["'][^>]*name=["']description["'][^>]*>/i)?.[0] || "";
  const description = decode(attr(metaDescriptionTag, "content"));
  const robotsTag = html.match(/<meta\b[^>]*name=["']robots["'][^>]*>/i)?.[0] || "";
  const robots = decode(attr(robotsTag, "content")).toLowerCase();
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].map((match) => decode(match[1]));
  const ldJson = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1].trim());
  const page = { file, path, url: selfUrl(path), html, title, h1s, canonical, description, robots, links, ldJson };
  pages.push(page);
  byUrl.set(normalizeUrl(page.url), page);
}

const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => normalizeUrl(match[1])));
const errors = [];
const warnings = [];
const titleOwners = new Map();
const descriptionOwners = new Map();
const inbound = new Map();

for (const page of pages) inbound.set(normalizeUrl(page.url), 0);

for (const page of pages) {
  const isHtmlDocument = page.path.endsWith("/") || page.path === "/";
  if (!isHtmlDocument) continue;
  const own = normalizeUrl(page.url);
  const canonical = page.canonical;
  const alias = canonical && canonical !== own;
  const indexable = !page.robots.includes("noindex") && !alias;

  if (!page.title) errors.push(`${page.path}: missing <title>.`);
  if (!page.description) errors.push(`${page.path}: missing meta description.`);
  if (!canonical) errors.push(`${page.path}: missing canonical URL.`);
  if (page.h1s.length !== 1) errors.push(`${page.path}: expected one visible H1, found ${page.h1s.length}.`);
  if (page.h1s[0] && page.h1s[0].length < 3) errors.push(`${page.path}: H1 is effectively empty.`);

  if (alias) {
    if (!byUrl.has(canonical)) errors.push(`${page.path}: canonical target does not exist in the built site: ${canonical}`);
    if (sitemapUrls.has(own)) errors.push(`${page.path}: alias page must not appear in sitemap.`);
  } else if (indexable) {
    if (canonical !== own) errors.push(`${page.path}: self-canonical mismatch: ${canonical || "missing"}`);
    if (!sitemapUrls.has(own)) warnings.push(`${page.path}: canonical page is not listed in sitemap.`);
    const titleKey = page.title.toLowerCase();
    const descriptionKey = page.description.toLowerCase();
    if (titleOwners.has(titleKey)) errors.push(`${page.path}: duplicate title with ${titleOwners.get(titleKey)}: ${page.title}`);
    else titleOwners.set(titleKey, page.path);
    if (descriptionOwners.has(descriptionKey)) errors.push(`${page.path}: duplicate meta description with ${descriptionOwners.get(descriptionKey)}.`);
    else descriptionOwners.set(descriptionKey, page.path);
  }

  if (page.title.length > 90) warnings.push(`${page.path}: title is very long (${page.title.length} characters).`);
  if (page.description.length > 240) warnings.push(`${page.path}: meta description is very long (${page.description.length} characters).`);
  if (/\b(?:keyword|keywords)\b/i.test(page.title) && page.title.includes(",")) warnings.push(`${page.path}: title looks list-like; review for keyword stuffing.`);

  for (let index = 0; index < page.ldJson.length; index += 1) {
    try {
      JSON.parse(page.ldJson[index]);
    } catch (error) {
      errors.push(`${page.path}: JSON-LD block ${index + 1} is invalid JSON: ${error.message}`);
    }
  }

  for (const href of page.links) {
    const target = internalTarget(href, page.path);
    if (!target) continue;
    const targetFile = fileForPath(target.path);
    try {
      await access(targetFile);
    } catch {
      errors.push(`${page.path}: broken internal link ${href}`);
      continue;
    }
    const targetUrl = normalizeUrl(`${SITE}${target.path}`);
    if (byUrl.has(targetUrl) && targetUrl !== own) inbound.set(targetUrl, (inbound.get(targetUrl) || 0) + 1);
    if (target.hash && target.path.endsWith("/")) {
      const targetPage = byUrl.get(targetUrl);
      if (targetPage) {
        const id = decodeURIComponent(target.hash.slice(1));
        const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (!new RegExp(`(?:id|name)=["']${escaped}["']`, "i").test(targetPage.html)) {
          errors.push(`${page.path}: internal link points to missing fragment ${href}`);
        }
      }
    }
  }
}

for (const url of sitemapUrls) {
  const page = byUrl.get(url);
  if (!page) continue;
  if (url === `${SITE}/`) continue;
  if ((inbound.get(url) || 0) === 0) errors.push(`${page.path}: sitemap page has no crawlable internal link from another HTML page.`);
}

const STOP = new Set("the a an and or but if then than of to in on for from with without at by as is are was were be been being this that these those it its we you your our their they can may might should could would do does did not no one into after before when where what why how more most less very only also still same another own new current page pages research evidence effect bias biases cognitive".split(" "));
function tokens(text) {
  return stripTags(text).toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((word) => word.length > 2 && !STOP.has(word));
}
function shingles(text, size = 5) {
  const words = tokens(text);
  const set = new Set();
  for (let index = 0; index <= words.length - size; index += 1) set.add(words.slice(index, index + size).join(" "));
  return set;
}
function similarity(left, right) {
  if (!left.size || !right.size) return 0;
  let common = 0;
  for (const item of left) if (right.has(item)) common += 1;
  return common / (left.size + right.size - common);
}

const reviewedBlocks = [];
for (const name of await readdir("data")) {
  if (!/^editorial-overrides(?:-[a-z0-9-]+)?\.json$/i.test(name)) continue;
  const payload = JSON.parse(await readFile(join("data", name), "utf8"));
  for (const entry of payload.entries || []) {
    if (tokens(entry.description || "").length >= 60) reviewedBlocks.push({ id: `entry:${entry.slug}`, text: entry.description });
  }
}
const notes = JSON.parse(await readFile("data/research-notes.json", "utf8"));
for (const note of notes.entries || []) {
  const text = [note.summary, ...(note.sections || []).flatMap((section) => section.paragraphs || [])].join(" ");
  if (tokens(text).length >= 60) reviewedBlocks.push({ id: `research:${note.slug}`, text });
}
for (let left = 0; left < reviewedBlocks.length; left += 1) {
  const leftShingles = shingles(reviewedBlocks[left].text);
  for (let right = left + 1; right < reviewedBlocks.length; right += 1) {
    const score = similarity(leftShingles, shingles(reviewedBlocks[right].text));
    if (score >= 0.72) errors.push(`Near-duplicate reviewed prose: ${reviewedBlocks[left].id} and ${reviewedBlocks[right].id} (5-word shingle Jaccard ${score.toFixed(2)}).`);
  }
}

if (warnings.length) {
  console.log(`Search quality warnings (${warnings.length}):`);
  for (const warning of warnings.slice(0, 30)) console.log(`- ${warning}`);
  if (warnings.length > 30) console.log(`- …and ${warnings.length - 30} more warnings.`);
}
if (errors.length) {
  console.error(`Search quality gate failed with ${errors.length} issue(s):`);
  for (const error of errors.slice(0, 80)) console.error(`- ${error}`);
  if (errors.length > 80) console.error(`- …and ${errors.length - 80} more issues.`);
  process.exit(1);
}

console.log(`Search quality gate passed: ${pages.length} HTML files, ${titleOwners.size} unique canonical titles, ${descriptionOwners.size} unique canonical descriptions, valid JSON-LD, crawlable internal links, no sitemap orphans, and ${reviewedBlocks.length} reviewed prose blocks checked for near-duplication.`);
