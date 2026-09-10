import { readFile, writeFile } from "node:fs/promises";

const HOME = "dist/index.html";
const identity = JSON.parse(await readFile("config/site-identity.json", "utf8"));
const SITE = identity.siteUrl;
const TITLE = identity.homepageTitle;
const DESCRIPTION = identity.homepageDescription;
const SITE_NAME = identity.siteName;
const ALTERNATE_NAMES = identity.alternateNames || [];
const FAVICON = identity.faviconPath;

function setOrAdd(html, pattern, replacement) {
  if (pattern.test(html)) return html.replace(pattern, replacement);
  return html.replace("</head>", `${replacement}</head>`);
}

let html = await readFile(HOME, "utf8");

html = html.replace(/<title>[^<]*<\/title>/i, `<title>${TITLE}</title>`);
html = setOrAdd(html, /<meta\b[^>]*name=["']description["'][^>]*>/i, `<meta name="description" content="${DESCRIPTION}">`);
html = setOrAdd(html, /<link\b[^>]*rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${SITE}">`);
html = setOrAdd(html, /<meta\b[^>]*property=["']og:site_name["'][^>]*>/i, `<meta property="og:site_name" content="${SITE_NAME}">`);
html = setOrAdd(html, /<meta\b[^>]*property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${TITLE}">`);
html = setOrAdd(html, /<meta\b[^>]*property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${DESCRIPTION}">`);
html = setOrAdd(html, /<meta\b[^>]*property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${SITE}">`);
html = setOrAdd(html, /<meta\b[^>]*name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${TITLE}">`);
html = setOrAdd(html, /<meta\b[^>]*name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${DESCRIPTION}">`);
html = setOrAdd(html, /<link\b[^>]*rel=["'](?:shortcut\s+)?icon["'][^>]*>/i, `<link rel="icon" type="image/png" href="${FAVICON}">`);

let websiteCount = 0;

function visit(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) visit(item);
    return;
  }

  const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
  if (types.includes("WebSite")) {
    websiteCount += 1;
    node.name = SITE_NAME;
    node.url = SITE;
    node.description = DESCRIPTION;
    if (ALTERNATE_NAMES.length) node.alternateName = ALTERNATE_NAMES;
    else delete node.alternateName;
  }

  for (const value of Object.values(node)) visit(value);
}

html = html.replace(/(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi, (whole, open, json, close) => {
  try {
    const value = JSON.parse(json);
    visit(value);
    return `${open}${JSON.stringify(value)}${close}`;
  } catch {
    return whole;
  }
});

if (websiteCount === 0) {
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE}#website`,
    url: SITE,
    name: SITE_NAME,
    description: DESCRIPTION
  };
  if (ALTERNATE_NAMES.length) website.alternateName = ALTERNATE_NAMES;
  html = html.replace("</head>", `<script type="application/ld+json" data-search-site-name="true">${JSON.stringify(website)}</script></head>`);
  websiteCount = 1;
}

if (websiteCount !== 1) throw new Error(`Search appearance finalization found ${websiteCount} WebSite nodes; expected exactly one homepage identity.`);

const required = [
  `<title>${TITLE}</title>`,
  `<meta name="description" content="${DESCRIPTION}">`,
  `<link rel="canonical" href="${SITE}">`,
  `<meta property="og:site_name" content="${SITE_NAME}">`,
  `<meta property="og:url" content="${SITE}">`,
  `<link rel="icon" type="image/png" href="${FAVICON}">`,
  `"name":"${SITE_NAME}"`,
  `"url":"${SITE}"`
];
for (const token of required) {
  if (!html.includes(token)) throw new Error(`Search appearance finalization failed: missing ${token}`);
}

await writeFile(HOME, html);
console.log(`Search appearance finalized from config/site-identity.json: ${TITLE}; site name ${SITE_NAME}; favicon ${FAVICON}; one WebSite identity.`);
