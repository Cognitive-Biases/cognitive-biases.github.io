import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const identity = JSON.parse(await readFile("config/site-identity.json", "utf8"));
const WEBSITE_ID = `${identity.siteUrl}#website`;
const ORGANIZATION_ID = `${identity.siteUrl}#organization`;
const LEGACY_APP_ID = `${identity.siteUrl}#app`;

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
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

const escapeAttr = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

function metaContent(html, key, value) {
  const tag = html.match(new RegExp(`<meta\\b(?=[^>]*\\b${key}=["']${value}["'])[^>]*>`, "i"))?.[0] || "";
  return tag.match(/\bcontent=["']([^"']*)["']/i)?.[1] || "";
}

function setOrAddMeta(html, key, value, content) {
  const pattern = new RegExp(`<meta\\b(?=[^>]*\\b${key}=["']${value}["'])[^>]*>`, "i");
  const replacement = `<meta ${key}="${value}" content="${escapeAttr(content)}">`;
  if (pattern.test(html)) return html.replace(pattern, replacement);
  return html.replace("</head>", `${replacement}</head>`);
}

function normalizeGraph(value, seen) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeGraph(item, seen))
      .filter((item) => item !== null && item !== undefined);
  }
  if (!value || typeof value !== "object") return value;

  const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]].filter(Boolean);
  const id = value["@id"];
  const isLegacyApp = id === LEGACY_APP_ID && types.some((type) => type === "SoftwareApplication" || type === "MobileApplication");
  if (isLegacyApp) return null;

  if (types.includes("WebSite") && (id === WEBSITE_ID || value.url === identity.siteUrl || value.url === identity.siteUrl.slice(0, -1))) {
    if (seen.websites.has(WEBSITE_ID)) return { "@id": WEBSITE_ID };
    seen.websites.add(WEBSITE_ID);
    value["@id"] = WEBSITE_ID;
    value.name = identity.siteName;
    value.url = identity.siteUrl;
    value.description = identity.homepageDescription;
    value.publisher = { "@id": ORGANIZATION_ID };
    if ((identity.alternateNames || []).length) value.alternateName = identity.alternateNames;
    else delete value.alternateName;
  }

  if (types.includes("Organization") && (id === ORGANIZATION_ID || (value.name === "Cognitive Biases" && String(value.url || "").startsWith(identity.siteUrl)))) {
    if (seen.organizations.has(ORGANIZATION_ID)) return { "@id": ORGANIZATION_ID };
    seen.organizations.add(ORGANIZATION_ID);
    value["@id"] = ORGANIZATION_ID;
    value.name = identity.publisher.name;
    value.url = identity.publisher.url;
    delete value.alternateName;
    delete value.logo;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === "@context" || key === "@type" || key === "@id") continue;
    const normalized = normalizeGraph(child, seen);
    if (normalized === null || normalized === undefined) delete value[key];
    else value[key] = normalized;
  }
  return value;
}

let changedPages = 0;
let removedLegacyApps = 0;
let addedTwitterImages = 0;
for (const file of await walk(OUT)) {
  let html = await readFile(file, "utf8");
  const before = html;
  const seen = { websites: new Set(), organizations: new Set() };

  const iconPattern = /<link\b(?=[^>]*\brel=["'](?:shortcut\s+)?icon["'])[^>]*>/i;
  const iconTag = `<link rel="icon" type="image/png" href="${identity.faviconPath}">`;
  html = iconPattern.test(html) ? html.replace(iconPattern, iconTag) : html.replace("</head>", `${iconTag}</head>`);

  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || identity.siteName);
  const ogImage = decode(metaContent(html, "property", "og:image"));
  if (ogImage) {
    if (!/<meta\b(?=[^>]*\bname=["']twitter:image["'])[^>]*>/i.test(html)) addedTwitterImages += 1;
    html = setOrAddMeta(html, "name", "twitter:image", ogImage);
    html = setOrAddMeta(html, "property", "og:image:alt", title || identity.siteName);
    html = setOrAddMeta(html, "name", "twitter:image:alt", title || identity.siteName);
  }

  html = html.replace(/(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi, (whole, open, json, close) => {
    try {
      const parsed = JSON.parse(json);
      const legacyBefore = JSON.stringify(parsed).includes(LEGACY_APP_ID);
      const normalized = normalizeGraph(parsed, seen);
      const legacyAfter = JSON.stringify(normalized).includes(LEGACY_APP_ID);
      if (legacyBefore && !legacyAfter) removedLegacyApps += 1;
      return `${open}${JSON.stringify(normalized)}${close}`;
    } catch {
      return whole;
    }
  });

  if (html !== before) {
    await writeFile(file, html);
    changedPages += 1;
  }
}

console.log(`Final public metadata normalized on ${changedPages} page(s); removed ${removedLegacyApps} legacy app schema node(s); added ${addedTwitterImages} Twitter image declarations; favicon and site/publisher semantics aligned to config/site-identity.json.`);
