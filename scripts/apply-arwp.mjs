import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const OUT = "dist";
const SITE = "https://cognitive-biases.github.io";

const artifacts = [
  ["ai/site-profile.json", "ai/site-profile.json"],
  ["ai/ai-search-profile.json", "ai/ai-search-profile.json"],
  ["ai/locales.json", "ai/locales.json"],
  ["ai/history.json", "history.json"],
  ["ai/citation-index.json", "citation-index.json"],
  ["ai/trust.json", "trust/trust.json"],
  ["ai/corrections.json", "trust/corrections.json"],
  ["ai/knowledge-graph.json", "knowledge/graph.json"],
  ["ai/llms.de.txt", "de/llms.txt"],
  ["ai/llms.ru.txt", "ru/llms.txt"],
  ["llms.txt", "llms.txt"],
  ["llms-full.txt", "llms-full.txt"]
];

const discoveryLinks = [
  '<link rel="describedby" type="application/json" href="/ai/site-profile.json" title="Agent-Ready Web Profile">',
  '<link rel="describedby" type="application/json" href="/ai/ai-search-profile.json" title="AI Search & Citation Profile">',
  '<link rel="describedby" type="application/json" href="/ai/locales.json" title="Agent locale manifest">',
  '<link rel="alternate" type="text/plain" hreflang="en" href="/llms.txt" title="English agent routing">',
  '<link rel="alternate" type="text/plain" hreflang="de" href="/de/llms.txt" title="German agent routing">',
  '<link rel="alternate" type="text/plain" hreflang="ru" href="/ru/llms.txt" title="Russian agent routing">',
  '<link rel="alternate" type="application/ld+json" href="/knowledge/graph.json" title="Knowledge graph">'
];

const footerLinks = '<p class="fine-print arwp-links">Project: <a href="/history/">History</a> · <a href="/trust/">Trust Center</a> · <a href="/ai/site-profile.json">Agent profile</a> · <a href="/citation-index.json">Citation index</a></p>';

async function walkHtml(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walkHtml(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

async function publish(source, target) {
  const output = join(OUT, target);
  await mkdir(dirname(output), { recursive: true });
  await cp(source, output);
}

function escape(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function shellPage({ title, description, canonical, body }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${canonical}"><link rel="stylesheet" href="/styles.css"></head><body><main class="article"><p class="breadcrumbs"><a href="/">Cognitive Biases</a></p>${body}</main></body></html>`;
}

function historyPage(history) {
  const events = history.events.map((event) => `<article><p class="eyebrow">${escape(event.date)} · ${escape(event.status)}</p><h2>${escape(event.title)}</h2><p>${escape(event.summary)}</p>${event.evidence?.length ? `<p><strong>Evidence</strong>: ${event.evidence.map((url) => `<a href="${escape(url)}">source</a>`).join(" · ")}</p>` : ""}</article>`).join("");
  return shellPage({
    title: "Project history | Cognitive Biases",
    description: "Source-backed timeline of the Cognitive Biases knowledge library, research layers and agent-discovery surfaces.",
    canonical: `${SITE}/history/`,
    body: `<h1>Project history</h1><p class="definition">Status: <strong>${escape(history.status)}</strong>. Maturity: <strong>${escape(history.maturity)}</strong>. Last updated ${escape(history.lastUpdated)}.</p>${events}<p><a href="/history.json">Machine-readable history</a></p>`
  });
}

function trustPage(trust) {
  const boundaries = trust.boundaries.map((item) => `<li>${escape(item)}</li>`).join("");
  return shellPage({
    title: "Trust Center | Cognitive Biases",
    description: "Identity, evidence-review practices, provenance, security, reuse boundaries and limitations for Cognitive Biases.",
    canonical: `${SITE}/trust/`,
    body: `<h1>Trust Center</h1><p class="definition">This page describes what the project can substantiate, how evidence is reviewed, and where the boundaries are.</p><h2>Identity</h2><p>Maintained by ${escape(trust.maintainer.name)} in the <a href="${escape(trust.identity.repository)}">public repository</a>. Citation metadata and the current licence are published with the source.</p><h2>Evidence and review</h2><p>Reviewed evidence, methodology, quality status, provenance and release manifests remain the source of record. Research maturity labels describe project artifacts; they are not scientific-certainty scores.</p><h2>Corrections</h2><p>Material factual, evidence, provenance, methodology or data-contract errors are recorded in the <a href="/trust/corrections.json">corrections ledger</a>. Non-sensitive corrections can be reported through the repository issue template.</p><h2>Security</h2><p>See the <a href="${escape(trust.security.policy)}">security policy</a> for sensitive reports. The public site is static and the reference MCP interface is intended to be read-only.</p><h2>Boundaries</h2><ul>${boundaries}</ul><p><a href="/trust/trust.json">Machine-readable Trust Center</a></p>`
  });
}

for (const [source, target] of artifacts) await publish(source, target);

const history = JSON.parse(await readFile("ai/history.json", "utf8"));
const trust = JSON.parse(await readFile("ai/trust.json", "utf8"));
await mkdir(join(OUT, "history"), { recursive: true });
await mkdir(join(OUT, "trust"), { recursive: true });
await writeFile(join(OUT, "history", "index.html"), historyPage(history));
await writeFile(join(OUT, "trust", "index.html"), trustPage(trust));

const llmsPath = join(OUT, "llms.txt");
let llms = await readFile(llmsPath, "utf8");
const arwpRouting = `\n- Project history: ${SITE}/history/\n- Machine-readable history: ${SITE}/history.json\n- Agent locale manifest: ${SITE}/ai/locales.json\n- German agent routing: ${SITE}/de/llms.txt\n- Russian agent routing: ${SITE}/ru/llms.txt\n- AI Search & Citation Profile: ${SITE}/ai/ai-search-profile.json\n- Canonical citation index: ${SITE}/citation-index.json\n- Trust Center: ${SITE}/trust/\n- Corrections ledger: ${SITE}/trust/corrections.json\n- Knowledge graph: ${SITE}/knowledge/graph.json\n`;
if (!llms.includes("AI Search & Citation Profile:")) {
  const anchor = `- Canonical website: ${SITE}/`;
  llms = llms.includes(anchor) ? llms.replace(anchor, `${anchor}${arwpRouting}`) : `${llms.trim()}\n${arwpRouting}`;
  await writeFile(llmsPath, llms);
}

let changed = 0;
for (const file of await walkHtml(OUT)) {
  let html = await readFile(file, "utf8");
  if (!html.includes("</head>")) continue;

  const missingLinks = discoveryLinks.filter((link) => {
    const href = link.match(/href="([^"]+)"/)?.[1];
    return href && !html.includes(`href="${href}"`);
  });
  if (missingLinks.length) html = html.replace("</head>", `${missingLinks.join("")} </head>`);

  if (html.includes("</footer>") && !html.includes("class=\"fine-print arwp-links\"")) {
    html = html.replace("</footer>", `${footerLinks}</footer>`);
  }

  await writeFile(file, html);
  changed += 1;
}

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
for (const url of [`${SITE}/history/`, `${SITE}/trust/`]) {
  if (!sitemap.includes(`<loc>${url}</loc>`)) {
    sitemap = sitemap.replace("</urlset>", `<url><loc>${url}</loc></url></urlset>`);
  }
}
await writeFile(sitemapPath, sitemap);

console.log(`Published ${artifacts.length} ARWP artifacts, 2 human trust/history pages, and advertised discovery metadata from ${changed} HTML files.`);
