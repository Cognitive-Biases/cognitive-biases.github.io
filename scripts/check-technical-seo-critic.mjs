import { readFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const identity = JSON.parse(await readFile("config/site-identity.json", "utf8"));
const SITE = identity.siteUrl;
const ORIGIN = new URL(SITE).origin;
const allowedHeadElements = new Set(["base", "link", "meta", "title", "style", "script", "noscript", "template"]);
const hardIssues = [];
const watches = [];

const decode = (value = "") => String(value)
  .replaceAll("&amp;", "&")
  .replaceAll("&quot;", '"')
  .replaceAll("&#39;", "'")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">")
  .replace(/\s+/g, " ")
  .trim();

function attrs(tag) {
  const out = {};
  const body = String(tag).replace(/^<\/?[\w:-]+\s*/i, "").replace(/\/?\s*>$/, "");
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = re.exec(body))) out[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  return out;
}

function htmlFileFor(urlValue) {
  const url = new URL(urlValue);
  if (url.pathname === "/") return join(OUT, "index.html");
  if (url.pathname.endsWith(".html")) return join(OUT, url.pathname.slice(1));
  return join(OUT, url.pathname.slice(1), "index.html");
}

function canonical(html, baseUrl) {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(match[0]);
    if (!String(a.rel || "").toLowerCase().split(/\s+/).includes("canonical") || !a.href) continue;
    try { return new URL(a.href, baseUrl).href; } catch { return null; }
  }
  return null;
}

function effectiveHeadIssues(html, url) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
  if (head == null) {
    hardIssues.push(`${url}: missing explicit <head>...</head>`);
    return;
  }
  const ranges = [];
  for (const match of head.matchAll(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi)) {
    ranges.push([match.index, match.index + match[0].length]);
  }
  for (const match of head.matchAll(/<([a-z][\w:-]*)\b[^>]*>/gi)) {
    const name = match[1].toLowerCase();
    if (allowedHeadElements.has(name)) continue;
    if (ranges.some(([start, end]) => match.index > start && match.index < end)) continue;
    hardIssues.push(`${url}: invalid <${name}> inside head can terminate Google metadata parsing`);
  }
}

function inspectObsoleteSignals(html, url) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(match[0]);
    const name = String(a.name || "").toLowerCase();
    const content = String(a.content || "").toLowerCase();
    if (name === "keywords") hardIssues.push(`${url}: obsolete meta keywords survived the final artifact`);
    if (name === "google" && content.includes("nositelinkssearchbox")) hardIssues.push(`${url}: obsolete nositelinkssearchbox control survived the final artifact`);
  }
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(match[0]);
    const rel = String(a.rel || "").toLowerCase().split(/\s+/).filter(Boolean);
    if (rel.includes("next") || rel.includes("prev")) hardIssues.push(`${url}: rel=${rel.includes("next") ? "next" : "prev"} is present as obsolete Google pagination metadata`);
  }
}

function inspectRobotsControls(html, url) {
  const restricted = [];
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(match[0]);
    const name = String(a.name || "").toLowerCase();
    if (!new Set(["robots", "googlebot"]).has(name)) continue;
    const content = String(a.content || "").toLowerCase();
    for (const signal of ["noindex", "none", "nofollow", "nosnippet", "noimageindex", "max-snippet:0", "max-image-preview:none", "max-video-preview:0"]) {
      if (content.replace(/\s+/g, "").includes(signal)) restricted.push(`${name}:${signal}`);
    }
    if (/unavailable_after\s*:/i.test(content)) restricted.push(`${name}:unavailable_after`);
  }
  if (restricted.length) hardIssues.push(`${url}: unintended Search-serving restriction(s) on a sitemap URL: ${[...new Set(restricted)].join(", ")}`);
}

function inspectLinks(html, url) {
  let queryLinks = 0;
  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const a = attrs(match[0]);
    const rawHref = String(a.href || "").trim();
    if (!rawHref || /^(?:#|mailto:|tel:|javascript:|data:)/i.test(rawHref)) continue;
    let target;
    try { target = new URL(rawHref, url); } catch { continue; }
    if (target.origin !== ORIGIN) continue;
    const rel = String(a.rel || "").toLowerCase().split(/\s+/).filter(Boolean);
    if (rel.includes("nofollow")) hardIssues.push(`${url}: internal discovery link is nofollow -> ${target.href}`);
    if (target.search) queryLinks += 1;
  }
  return queryLinks;
}

const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => decode(match[1])).filter(Boolean);
if (!urls.length) throw new Error("Technical SEO Critic: sitemap has no canonical URL cohort");

let queryLinkCount = 0;
let paginationCount = 0;
for (const url of urls) {
  const html = await readFile(htmlFileFor(url), "utf8");
  effectiveHeadIssues(html, url);
  inspectObsoleteSignals(html, url);
  inspectRobotsControls(html, url);
  queryLinkCount += inspectLinks(html, url);
  if (/\/page\/\d+\/?$/i.test(new URL(url).pathname) || /(?:^|[?&])page=\d+/i.test(new URL(url).search)) paginationCount += 1;
  const declaredCanonical = canonical(html, url);
  if (declaredCanonical !== url) hardIssues.push(`${url}: critic observed non-self canonical ${declaredCanonical || "missing"}`);
}

if (queryLinkCount > 0) watches.push(`${queryLinkCount} same-origin query-bearing internal link(s) are discoverable; review TSC-04 crawl-state-space applicability.`);
if (paginationCount === 0) watches.push("TSC-03 pagination is not applicable to the current sitemap cohort.");
else watches.push(`TSC-03 detected ${paginationCount} paginated canonical URL(s); existing self-canonical gate remains active.`);

for (const watch of watches) console.log(`WATCH: ${watch}`);
if (hardIssues.length) {
  console.error(`Technical SEO Critic found ${hardIssues.length} hard issue(s):`);
  for (const issue of hardIssues.slice(0, 50)) console.error(`- ${issue}`);
  throw new Error("Technical SEO Critic failed final-artifact checks");
}

console.log(`Technical SEO Critic passed ${urls.length} sitemap pages: effective head integrity, negative robots controls, internal followability, obsolete SEO-signal rejection and canonical parity. Field CWV plus HTTP Link/ETag/Last-Modified remain live/owner-data checks.`);
