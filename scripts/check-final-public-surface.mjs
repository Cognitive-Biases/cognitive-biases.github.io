import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const identity = JSON.parse(await readFile("config/site-identity.json", "utf8"));
const SITE = identity.siteUrl;
const SITE_ORIGIN = new URL(SITE).origin;
const WEBSITE_ID = `${SITE}#website`;
const ORGANIZATION_ID = `${SITE}#organization`;
const LEGACY_APP_ID = `${SITE}#app`;

const fail = (message) => { throw new Error(`Final public surface gate: ${message}`); };
const decode = (value = "") => String(value)
  .replaceAll("&amp;", "&")
  .replaceAll("&quot;", '"')
  .replaceAll("&#39;", "'")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">")
  .replace(/\s+/g, " ")
  .trim();

function findTag(html, element, attrName, attrValue) {
  return html.match(new RegExp(`<${element}\\b(?=[^>]*\\b${attrName}=["']${attrValue}["'])[^>]*>`, "i"))?.[0] || "";
}
function attr(tag, name) {
  return decode(tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"))?.[1] || "");
}
function meta(html, kind, name) {
  return attr(findTag(html, "meta", kind, name), "content");
}
function canonical(html) {
  return attr(findTag(html, "link", "rel", "canonical"), "href");
}
function robots(html) {
  return meta(html, "name", "robots").toLowerCase();
}
function title(html) {
  return decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
}
function description(html) {
  return meta(html, "name", "description");
}
function jsonLdBlocks(html) {
  return [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1].trim());
}
function collectTyped(value, type, found = []) {
  if (!value || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    for (const item of value) collectTyped(item, type, found);
    return found;
  }
  const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]].filter(Boolean);
  if (types.includes(type)) found.push(value);
  for (const child of Object.values(value)) collectTyped(child, type, found);
  return found;
}
function htmlFileFor(urlValue) {
  const url = new URL(urlValue);
  if (url.origin !== SITE_ORIGIN) fail(`sitemap URL is on the wrong host: ${urlValue}`);
  if (url.pathname === "/") return join(OUT, "index.html");
  if (url.pathname.endsWith(".html")) return join(OUT, url.pathname.slice(1));
  return join(OUT, url.pathname.slice(1), "index.html");
}

await access(join(OUT, "index.html"));
const home = await readFile(join(OUT, "index.html"), "utf8");
if (title(home) !== identity.homepageTitle) fail(`homepage title mismatch: ${title(home)}`);
if (description(home) !== identity.homepageDescription) fail("homepage description does not match config/site-identity.json");
if (canonical(home) !== SITE) fail(`homepage canonical mismatch: ${canonical(home)}`);
if (meta(home, "property", "og:site_name") !== identity.siteName) fail("homepage og:site_name mismatch");
if (meta(home, "property", "og:title") !== identity.homepageTitle) fail("homepage og:title mismatch");
if (meta(home, "property", "og:description") !== identity.homepageDescription) fail("homepage og:description mismatch");
if (meta(home, "property", "og:url") !== SITE) fail("homepage og:url mismatch");
const homeOgImage = meta(home, "property", "og:image");
if (!homeOgImage || !homeOgImage.startsWith(SITE)) fail("homepage needs a canonical-host og:image");
if (meta(home, "name", "twitter:image") !== homeOgImage) fail("homepage twitter:image must match og:image");
if (!meta(home, "property", "og:image:alt")) fail("homepage og:image:alt is missing");
if (!meta(home, "name", "twitter:image:alt")) fail("homepage twitter:image:alt is missing");
if (/\b(?:noindex|none)\b/i.test(robots(home))) fail("homepage is accidentally noindex");
if (home.includes("Cognitive Biases | Decision tools, evidence & bias reference")) fail("obsolete homepage title survived the final artifact");

const iconTag = findTag(home, "link", "rel", "icon") || findTag(home, "link", "rel", "shortcut icon");
if (attr(iconTag, "href") !== identity.faviconPath) fail(`homepage favicon mismatch: ${attr(iconTag, "href")}`);
const favicon = await readFile(join(OUT, identity.faviconPath.replace(/^\//, "")));
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
if (!favicon.subarray(0, 8).equals(pngSignature)) fail("configured Search favicon is not a PNG despite its declared type");
const faviconWidth = favicon.readUInt32BE(16);
const faviconHeight = favicon.readUInt32BE(20);
if (faviconWidth !== faviconHeight) fail(`favicon is not square: ${faviconWidth}x${faviconHeight}`);
if (faviconWidth < 48) fail(`favicon is only ${faviconWidth}x${faviconHeight}; use a search-safe source of at least 48px`);

const parsedHomeLd = [];
for (const block of jsonLdBlocks(home)) {
  try { parsedHomeLd.push(JSON.parse(block)); }
  catch (error) { fail(`homepage contains invalid JSON-LD: ${error.message}`); }
}
const websites = parsedHomeLd.flatMap((value) => collectTyped(value, "WebSite"));
if (websites.length !== 1) fail(`homepage must expose exactly one full WebSite identity, found ${websites.length}`);
if (websites[0]["@id"] !== WEBSITE_ID || websites[0].name !== identity.siteName || websites[0].url !== SITE) fail("homepage WebSite identity is inconsistent with the identity contract");
if (websites[0].description !== identity.homepageDescription) fail("homepage WebSite description is inconsistent with the identity contract");
if (websites[0].alternateName && !(identity.alternateNames || []).length) fail("homepage WebSite still exposes an unapproved alternateName");
const organizations = parsedHomeLd.flatMap((value) => collectTyped(value, "Organization"));
if (organizations.length !== 1) fail(`homepage must expose exactly one full publisher Organization, found ${organizations.length}`);
if (organizations[0]["@id"] !== ORGANIZATION_ID || organizations[0].name !== identity.publisher.name || organizations[0].url !== identity.publisher.url) fail("homepage publisher Organization does not match the identity contract");
if (home.includes(LEGACY_APP_ID) || /"(?:SoftwareApplication|MobileApplication)"/.test(home)) fail("legacy mobile-app structured data survived on the homepage");

const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
const blocks = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => match[1]);
if (!blocks.length) fail("sitemap has no URL entries");
const urls = blocks.map((block) => decode(block.match(/<loc>([^<]+)<\/loc>/)?.[1] || ""));
if (urls.some((url) => !url)) fail("sitemap contains a URL block without loc");
if (new Set(urls).size !== urls.length) fail("sitemap contains duplicate loc entries");
if (!urls.includes(SITE)) fail("sitemap does not contain the canonical homepage");
if (urls.some((url) => !url.startsWith(SITE))) fail("sitemap contains a URL outside the canonical hostname");
if (urls.some((url) => /\/404(?:\.html)?\/?$/.test(url))) fail("404 route must not appear in the sitemap");
for (let index = 0; index < urls.length; index += 1) {
  if (new URL(urls[index]).pathname.startsWith("/biases/") && /<lastmod>/.test(blocks[index])) fail(`bias page carries unproven sitemap freshness: ${urls[index]}`);
  const file = htmlFileFor(urls[index]);
  let html;
  try { html = await readFile(file, "utf8"); }
  catch { fail(`sitemap URL has no final HTML artifact: ${urls[index]}`); }
  if (!title(html)) fail(`${urls[index]} is missing title in final artifact`);
  if (!description(html)) fail(`${urls[index]} is missing meta description in final artifact`);
  if (canonical(html) !== urls[index]) fail(`${urls[index]} canonical mismatch: ${canonical(html)}`);
  if (/\b(?:noindex|none)\b/i.test(robots(html))) fail(`${urls[index]} is in sitemap but marked noindex`);
  for (const block of jsonLdBlocks(html)) {
    try { JSON.parse(block); }
    catch (error) { fail(`${urls[index]} contains invalid JSON-LD: ${error.message}`); }
  }
  if (html.includes(LEGACY_APP_ID) || /"(?:SoftwareApplication|MobileApplication)"/.test(html)) fail(`${urls[index]} still exposes legacy app structured data`);
}

const robotsTxt = await readFile(join(OUT, "robots.txt"), "utf8");
if (!robotsTxt.includes(`Sitemap: ${SITE}sitemap.xml`)) fail("robots.txt does not advertise the canonical sitemap");
try {
  await access(join(OUT, "research", "feed.xml"));
  if (!robotsTxt.includes(`Sitemap: ${SITE}research/feed.xml`)) fail("robots.txt does not advertise the published research feed");
} catch (error) {
  if (!String(error?.message || "").startsWith("Final public surface gate:")) fail("research/feed.xml is expected but missing from the final artifact");
  throw error;
}

const errorHtml = await readFile(join(OUT, "404.html"), "utf8");
if (!/\bnoindex\b/i.test(robots(errorHtml))) fail("404.html must be noindex");
if (canonical(errorHtml)) fail("404.html must not advertise itself as canonical content");
for (const route of ["/", "/explore/", "/decide/", "/research/"]) {
  if (!errorHtml.includes(`href="${route}"`)) fail(`404.html is missing recovery route ${route}`);
}

for (const file of ["llms.txt", "llms-full.txt"]) {
  const text = await readFile(join(OUT, file), "utf8");
  if (!text.includes(`# ${identity.siteName}`)) fail(`${file} does not identify the product as ${identity.siteName}`);
  if (!text.includes(`Canonical website: ${SITE}`)) fail(`${file} does not advertise the canonical website`);
  if (/Educational mobile app \+ public reference/i.test(text)) fail(`${file} contains legacy app-first positioning`);
}

console.log(`Final public surface gate passed: ${urls.length} canonical sitemap pages, one ${identity.siteName} WebSite identity, publisher ${identity.publisher.name}, ${faviconWidth}x${faviconHeight} favicon, truthful bias freshness, valid final JSON-LD, social image parity, robots/feed discovery, custom noindex 404, and no legacy mobile-app schema.`);
