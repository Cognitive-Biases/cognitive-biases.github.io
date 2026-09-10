import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const OUT = "dist";
const HOME = "dist/index.html";
const STYLES = "dist/styles.css";
const LLMS = "dist/llms.txt";
const DIGESTS = "data/monthly-research-digests.json";
const DECISION_LINK = '<a class="button button--dark" href="/decide/">Open the decision review</a>';
const SEARCH_TITLE = "Cognitive Biases: Examples, Evidence & Decision Tools";
const SEARCH_DESCRIPTION = "Explore cognitive biases with clear examples, evidence reviews, comparisons and practical decision tools for everyday choices, work and AI.";
const SITE_FOCUS_PROOF = "Cognitive Biases is a practical reference with clear examples, evidence reviews, comparisons and decision tools for real choices.";
const SITE_NAME = "Cognitive Biases";
const SITE_ALTERNATE_NAME = "Cognitive Biases Library";
const SITE_URL = "https://cognitive-biases.github.io/";
const FAVICON_PATH = "/favicon.png";
const escape = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character]);

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

function routeFor(file) {
  const local = relative(OUT, file).replaceAll("\\", "/");
  if (local === "index.html") return "/";
  return `/${local.replace(/index\.html$/, "")}`;
}

function active(route, prefix) {
  return route === prefix || route.startsWith(prefix) ? ' aria-current="page"' : "";
}

function focusedHeader(route) {
  const core = `<a href="/explore/"${active(route, "/explore/")}>Explore</a><a href="/contexts/"${active(route, "/contexts/")}>Guides</a><a href="/evidence/"${active(route, "/evidence/")}>Evidence</a><a href="/tools/decision-audit/"${active(route, "/tools/")}>Decision tools</a>`;
  const drawerCore = `<a href="/explore/">Explore</a><a href="/contexts/">Guides</a><a href="/evidence/">Evidence</a><a href="/tools/decision-audit/">Decision tools</a><a href="/compare/">Compare</a>`;
  const search = route === "/" ? '<a class="home-search" href="/explore/#search"><img src="/assets/editorial/home/search-icon.png" width="30" height="30" alt=""><span>Search</span></a>' : "";
  const homeClass = route === "/" ? " site-header--home" : "";
  return `<header class="site-header${homeClass}"><a class="brand" href="/" aria-label="Cognitive Biases home"><picture class="brand-picture"><source type="image/webp" srcset="/assets/brand.webp"><img src="/assets/biases_icon.png" width="52" height="52" alt=""></picture><span><strong>Cognitive Biases</strong><small>Public knowledge library</small></span></a><nav aria-label="Primary"><div class="site-nav"><div class="site-nav__core">${core}${search}</div><button class="nav-menu" type="button" aria-expanded="false" aria-controls="site-nav-drawer">Menu</button><div class="site-nav__drawer" id="site-nav-drawer" hidden><div class="site-nav__drawer-core">${drawerCore}</div><a class="nav-search" href="/explore/#search">Search the library</a></div></div></nav></header>`;
}

function ensureSecondaryPractice(html) {
  const footerPattern = /<div class="footer-links">([\s\S]*?)<\/div>/;
  const match = html.match(footerPattern);
  if (!match || match[1].includes('href="/practice/"')) return html;
  return html.replace(footerPattern, `<div class="footer-links"><a href="/practice/">Practice</a>${match[1]}</div>`);
}

function ensureMeta(html, matcher, tag) {
  if (matcher.test(html)) return html.replace(matcher, tag);
  return html.replace("</head>", `${tag}</head>`);
}

function normalizeSearchAppearance(html) {
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${SEARCH_TITLE}</title>`);
  html = ensureMeta(html, /<meta\b[^>]*name=["']description["'][^>]*>/i, `<meta name="description" content="${SEARCH_DESCRIPTION}">`);
  html = ensureMeta(html, /<meta\b[^>]*property=["']og:site_name["'][^>]*>/i, `<meta property="og:site_name" content="${SITE_NAME}">`);
  html = ensureMeta(html, /<meta\b[^>]*property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${SEARCH_TITLE}">`);
  html = ensureMeta(html, /<meta\b[^>]*property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${SEARCH_DESCRIPTION}">`);
  html = ensureMeta(html, /<meta\b[^>]*name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${SEARCH_TITLE}">`);
  html = ensureMeta(html, /<meta\b[^>]*name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${SEARCH_DESCRIPTION}">`);
  html = ensureMeta(html, /<link\b[^>]*rel=["'](?:shortcut\s+)?icon["'][^>]*>/i, `<link rel="icon" type="image/png" sizes="192x192" href="${FAVICON_PATH}">`);

  let websiteNodes = 0;
  let organizationNodes = 0;
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
    if (types.includes("WebSite")) {
      node.name = SITE_NAME;
      node.alternateName = SITE_ALTERNATE_NAME;
      node.url = SITE_URL;
      node.description = SEARCH_DESCRIPTION;
      websiteNodes += 1;
    }
    if (types.includes("Organization") && (node["@id"] === `${SITE_URL}#organization` || node.url === SITE_URL.replace(/\/$/, ""))) {
      node.name = SITE_NAME;
      node.alternateName = SITE_ALTERNATE_NAME;
      node.logo = { "@type": "ImageObject", url: `${SITE_URL}favicon.png`, width: 192, height: 192 };
      organizationNodes += 1;
    }
    for (const value of Object.values(node)) visit(value);
  };

  html = html.replace(/(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi, (match, open, json, close) => {
    try {
      const data = JSON.parse(json);
      const beforeWebsites = websiteNodes;
      const beforeOrganizations = organizationNodes;
      visit(data);
      if (websiteNodes === beforeWebsites && organizationNodes === beforeOrganizations) return match;
      return `${open}${JSON.stringify(data)}${close}`;
    } catch {
      return match;
    }
  });

  if (websiteNodes === 0) {
    const schema = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE_URL}#website`,
      url: SITE_URL,
      name: SITE_NAME,
      alternateName: SITE_ALTERNATE_NAME,
      description: SEARCH_DESCRIPTION
    };
    html = html.replace("</head>", `<script type="application/ld+json" data-search-site-name="true">${JSON.stringify(schema)}</script></head>`);
  }

  return html;
}

let html = await readFile(HOME, "utf8");

if (!html.includes('href="/decide/"')) {
  const sectionPattern = /(<section class="section decision-first-home">[\s\S]*?)(<\/section>)/;
  if (!sectionPattern.test(html)) {
    throw new Error("Cannot restore /decide/ discovery: decision-first homepage section is missing.");
  }
  html = html.replace(sectionPattern, `$1<p class="decision-first-home__hub">${DECISION_LINK}</p>$2`);
}

if (!html.includes('href="/decide/"')) {
  throw new Error("/decide/ is still not crawlable from the homepage.");
}

const digestData = JSON.parse(await readFile(DIGESTS, "utf8"));
const latestDigest = [...(digestData.digests || [])].sort((a, b) => String(b.slug).localeCompare(String(a.slug)))[0];
if (latestDigest && !html.includes(`href="/research/digests/${latestDigest.slug}/"`)) {
  const signals = latestDigest.signals || [];
  const labels = signals.slice(0, 3).map((signal) => `<li><span>${escape(signal.delta)}</span>${escape(signal.title)}</li>`).join("");
  const section = `<section class="section research-digest-home" aria-labelledby="latest-research-digest"><div class="research-digest-home__copy"><p class="kicker">Latest research · ${escape(latestDigest.month)}</p><h2 id="latest-research-digest">What changed in the evidence?</h2><p>${escape(latestDigest.summary)}</p><p>We do not publish a paper list. Each monthly update says what strengthened, what narrowed, what opened a new context, and what is still only worth watching.</p><div class="actions"><a class="button" href="/research/digests/${escape(latestDigest.slug)}/">Read the ${escape(latestDigest.month)} digest</a><a href="/research/digests/">All monthly digests →</a></div></div><div class="research-digest-home__signals"><p class="kicker">This month</p><ul>${labels}</ul><p class="fine-print">${signals.length} reviewed signals. Preprints stay provisional; null results and evidence gaps stay visible.</p></div></section>`;
  if (!html.includes("</main>")) throw new Error("Cannot add latest research digest: homepage main element is missing.");
  html = html.replace("</main>", `${section}</main>`);
}

if (latestDigest && !html.includes(`href="/research/digests/${latestDigest.slug}/"`)) {
  throw new Error("Latest monthly research digest is not crawlable from the homepage.");
}

if (!html.includes(SITE_FOCUS_PROOF)) {
  const heroLead = "<p>Learn the patterns. Check the evidence.<br>Make a clearer move.</p>";
  if (!html.includes(heroLead)) throw new Error("Cannot add homepage focus proof: editorial hero lead is missing.");
  html = html.replace(heroLead, `${heroLead}<p class="editorial-hero__proof">${SITE_FOCUS_PROOF}</p>`);
}

html = normalizeSearchAppearance(html);

for (const required of [
  `<title>${SEARCH_TITLE}</title>`,
  `<meta name="description" content="${SEARCH_DESCRIPTION}">`,
  `<meta property="og:site_name" content="${SITE_NAME}">`,
  `<link rel="icon" type="image/png" sizes="192x192" href="${FAVICON_PATH}">`,
  `"name":"${SITE_NAME}"`,
  `"alternateName":"${SITE_ALTERNATE_NAME}"`
]) {
  if (!html.includes(required)) throw new Error(`Homepage search appearance is incomplete: ${required}`);
}

await writeFile(HOME, html);

const files = await htmlFiles(OUT);
let focusedHeaders = 0;
let secondaryPracticeLinks = 0;
for (const file of files) {
  const route = routeFor(file);
  const before = await readFile(file, "utf8");
  const headerPattern = /<header class="site-header(?: site-header--home)?">[\s\S]*?<\/header>/;
  let after = before;
  if (headerPattern.test(after)) after = after.replace(headerPattern, focusedHeader(route));
  const withPractice = ensureSecondaryPractice(after);
  if (withPractice !== after) secondaryPracticeLinks += 1;
  after = withPractice;
  if (after !== before) {
    await writeFile(file, after);
    if (headerPattern.test(before)) focusedHeaders += 1;
  }
}

html = await readFile(HOME, "utf8");
for (const route of ["/explore/", "/contexts/", "/evidence/", "/tools/decision-audit/", "/compare/"]) {
  if (!html.includes(`href="${route}"`)) throw new Error(`Focused primary navigation is missing ${route}.`);
}
for (const secondary of ["/practice/", "/research/", "/quality/", "/about/", "/data/"]) {
  if (!html.includes(`href="${secondary}"`)) throw new Error(`Homepage lost secondary proof/utility discovery for ${secondary}.`);
}

let styles = await readFile(STYLES, "utf8");
if (!styles.includes(".research-digest-home{")) {
  styles += `\n.research-digest-home{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr);gap:1.5rem;align-items:start}.research-digest-home__copy,.research-digest-home__signals{border:var(--line);background:#fff;padding:1.35rem}.research-digest-home__copy{box-shadow:8px 8px 0 var(--yellow)}.research-digest-home__signals{box-shadow:8px 8px 0 var(--cyan)}.research-digest-home__signals ul{list-style:none;margin:1rem 0;padding:0;display:grid;gap:.8rem}.research-digest-home__signals li{display:grid;gap:.2rem;padding-top:.8rem;border-top:2px solid var(--ink);font-weight:850}.research-digest-home__signals li span{font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;color:#5a6475}.research-digest-home .actions{align-items:center;gap:1rem;flex-wrap:wrap}.research-digest-home .actions>a:not(.button){font-weight:900}@media(max-width:760px){.research-digest-home{grid-template-columns:1fr}}\n`;
}
if (!styles.includes(".editorial-hero__proof{")) {
  styles += `\n.editorial-hero__proof{max-width:50rem;margin:.8rem 0 0;font-size:.92rem;line-height:1.55}.editorial-hero__proof::before{content:"Evidence note · ";font-weight:900;text-transform:uppercase;letter-spacing:.04em;font-size:.74rem}\n`;
}
await writeFile(STYLES, styles);

let llms = await readFile(LLMS, "utf8");
if (!llms.includes("Monthly research digests:")) {
  const researchLine = "- Research: https://cognitive-biases.github.io/research/";
  if (!llms.includes(researchLine)) throw new Error("Cannot add monthly digest to llms.txt: Research line is missing.");
  const discovery = `${researchLine}\n- Monthly research digests: https://cognitive-biases.github.io/research/digests/ — evidence-delta updates that label new findings as strengthening, narrowing, new context or watch-only instead of treating every new paper as settled evidence.\n- Research Atom feed: https://cognitive-biases.github.io/research/feed.xml — research notes and monthly digests in one update feed.`;
  llms = llms.replace(researchLine, discovery);
}
if (!llms.includes("Monthly research digest data:")) {
  const notesLine = "- Research notes: https://cognitive-biases.github.io/data/research-notes.json";
  if (!llms.includes(notesLine)) throw new Error("Cannot add monthly digest data to llms.txt: Research notes line is missing.");
  llms = llms.replace(notesLine, `${notesLine}\n- Monthly research digest data: https://cognitive-biases.github.io/data/monthly-research-digests.json\n- Monthly research digest schema: https://cognitive-biases.github.io/schemas/monthly-research-digests.schema.json`);
}
if (!llms.includes("Treat `watch only` monthly research signals as provisional")) {
  const rule = "Important interpretation rule: older library entries are not automatically evidence-reviewed. Prefer entries with an explicit evidence review when making claims about scientific support. Preserve the evidence class, descriptive status, qualification and review date when summarising reviewed material.";
  if (!llms.includes(rule)) throw new Error("Cannot add monthly digest interpretation rule to llms.txt.");
  llms = llms.replace(rule, `${rule}\n\nTreat \`watch only\` monthly research signals as provisional discovery, not canonical evidence. A monthly \`strengthens\`, \`narrows\` or \`new context\` label describes how the project interpreted a reviewed source; when making a scientific claim, prefer the resulting canonical evidence page and its sources when one exists.`);
}
await writeFile(LLMS, llms);

for (const required of [
  "https://cognitive-biases.github.io/data/monthly-research-digests.json",
  "https://cognitive-biases.github.io/schemas/monthly-research-digests.schema.json",
  "https://cognitive-biases.github.io/research/feed.xml"
]) {
  if (!llms.includes(required)) throw new Error(`Monthly research discovery is incomplete in generated llms.txt: ${required}`);
}

console.log(`Decision, research, site-focus and search appearance verified: /decide/${latestDigest ? `, /research/digests/${latestDigest.slug}/, research feed, monthly digest data and schema` : ""}; ${focusedHeaders} page headers normalized to five primary destinations; ${secondaryPracticeLinks} Practice footer links restored; homepage title, description, site name and favicon normalized.`);
