import { readFile, writeFile } from "node:fs/promises";

const HOME = "dist/index.html";
const SITE = "https://cognitive-biases.github.io/";
const TITLE = "Cognitive Biases: Examples, Evidence & Decision Tools";
const DESCRIPTION = "Explore cognitive biases with clear examples, evidence reviews, comparisons and practical decision tools for everyday choices, work and AI.";
const SITE_NAME = "Cognitive Biases";
const ALTERNATE_NAMES = ["Cognitive Biases Library", "cognitive-biases.github.io"];
const FAVICON = "/assets/biases_icon.png";

function setOrAdd(html, pattern, replacement) {
  if (pattern.test(html)) return html.replace(pattern, replacement);
  return html.replace("</head>", `${replacement}</head>`);
}

let html = await readFile(HOME, "utf8");

html = html.replace(/<title>[^<]*<\/title>/i, `<title>${TITLE}</title>`);
html = setOrAdd(html, /<meta\b[^>]*name=["']description["'][^>]*>/i, `<meta name="description" content="${DESCRIPTION}">`);
html = setOrAdd(html, /<meta\b[^>]*property=["']og:site_name["'][^>]*>/i, `<meta property="og:site_name" content="${SITE_NAME}">`);
html = setOrAdd(html, /<meta\b[^>]*property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${TITLE}">`);
html = setOrAdd(html, /<meta\b[^>]*property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${DESCRIPTION}">`);
html = setOrAdd(html, /<meta\b[^>]*name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${TITLE}">`);
html = setOrAdd(html, /<meta\b[^>]*name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${DESCRIPTION}">`);
html = setOrAdd(html, /<link\b[^>]*rel=["'](?:shortcut\s+)?icon["'][^>]*>/i, `<link rel="icon" type="image/png" sizes="80x80" href="${FAVICON}">`);

let sawWebsite = false;
let sawOrganization = false;

function visit(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) visit(item);
    return;
  }

  const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];

  if (types.includes("WebSite")) {
    node.name = SITE_NAME;
    node.alternateName = ALTERNATE_NAMES;
    node.url = SITE;
    node.description = DESCRIPTION;
    sawWebsite = true;
  }

  if (types.includes("Organization") && (node["@id"] === `${SITE}#organization` || node.url === SITE || node.url === SITE.slice(0, -1))) {
    node.name = SITE_NAME;
    node.alternateName = ALTERNATE_NAMES;
    node.url = SITE;
    node.logo = {
      "@type": "ImageObject",
      url: `${SITE}assets/biases_icon.png`,
      width: 80,
      height: 80
    };
    sawOrganization = true;
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

if (!sawWebsite) {
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE}#website`,
    url: SITE,
    name: SITE_NAME,
    alternateName: ALTERNATE_NAMES,
    description: DESCRIPTION
  };
  html = html.replace("</head>", `<script type="application/ld+json" data-search-site-name="true">${JSON.stringify(website)}</script></head>`);
}

const required = [
  `<title>${TITLE}</title>`,
  `<meta name="description" content="${DESCRIPTION}">`,
  `<meta property="og:site_name" content="${SITE_NAME}">`,
  `<link rel="icon" type="image/png" sizes="80x80" href="${FAVICON}">`,
  `"name":"${SITE_NAME}"`,
  `"alternateName":["Cognitive Biases Library","cognitive-biases.github.io"]`
];
for (const token of required) {
  if (!html.includes(token)) throw new Error(`Search appearance finalization failed: missing ${token}`);
}

await writeFile(HOME, html);
console.log(`Search appearance finalized: ${TITLE}; site name ${SITE_NAME}; favicon ${FAVICON}; organization schema ${sawOrganization ? "updated" : "not present"}.`);
