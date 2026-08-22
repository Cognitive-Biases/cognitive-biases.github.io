import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const trust = JSON.parse(await readFile("data/project-trust.json", "utf8"));
const esc = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const brand = (size, alt = "") => `<picture><source srcset="/assets/brand.webp" type="image/webp"><img src="/assets/biases_icon.png" width="${size}" height="${size}" alt="${esc(alt)}"></picture>`;
const nav = `<header class="site-header"><a class="brand" href="/">${brand(48, "Cognitive Biases icon")}<span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/decide/">Decide</a><a href="/explore/">Explore</a><a href="/compare/">Compare</a><a href="/contexts/">Contexts</a><a href="/skills/">Skills</a><a href="/practice/">Practice</a><a href="/research/">Research</a><a class="nav-cta" href="/data/">Data</a></nav></header>`;
const trustLine = `<p class="fine-print trust-line">Maintained by <a href="/about/editorial/">${esc(trust.maintainer.name)}</a> · <a href="/methodology/">Review methodology</a></p>`;
const footer = `<footer class="site-footer"><div><a class="brand brand--footer" href="/">${brand(40)}<span>Cognitive Biases</span></a><p>A public guide to cognitive biases, evidence and better decisions.</p></div><div class="footer-links"><a href="/about/editorial/">Editorial process</a><a href="/methodology/">Methodology</a><a href="/quality/">Quality status</a><a href="/research/">Research</a><a href="/data/">Data</a></div><p class="fine-print">Educational information, not medical, legal, financial or mental-health advice.</p>${trustLine}</footer>`;

function page(title, description, path, body) {
  const canonical = `${SITE}${path}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: title,
    description,
    url: canonical,
    mainEntity: {
      "@type": "Person",
      name: trust.maintainer.name,
      jobTitle: trust.maintainer.role,
      url: canonical
    },
    isPartOf: { "@type": "WebSite", name: "Cognitive Biases", url: SITE }
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip" href="#main">Skip to content</a>${nav}<main id="main">${body}</main>${footer}</body></html>`;
}
const list = (items) => `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
const body = `<section class="page-hero"><p class="eyebrow">Editorial transparency</p><h1>Who maintains this project, and what does “reviewed” mean?</h1><p class="lede">Cognitive Biases is an independent public knowledge project maintained by ${esc(trust.maintainer.name)}. The goal is not to make every page sound certain. The goal is to make the source, review state, limits and next useful question visible.</p></section><section class="section"><p class="kicker">Maintainer</p><h2>${esc(trust.maintainer.name)}</h2><p class="lede">${esc(trust.maintainer.role)}. The maintainer is responsible for the project direction, public data contract and editorial workflow. A maintainer credit does not turn the project into an academic institution or make every legacy page independently verified.</p><p><a class="button" href="/methodology/">Read the methodology</a> <a class="button button--dark" href="/quality/">See current quality status</a></p></section><section class="section section--ink"><p class="kicker">What review labels mean</p><h2>Reviewed is a process claim, not a prestige label.</h2><h3>Evidence-reviewed</h3><p>${esc(trust.reviewMeaning.evidenceReviewed)}</p><h3>Legacy / generated</h3><p>${esc(trust.reviewMeaning.legacy)}</p><h3>Research note</h3><p>${esc(trust.reviewMeaning.researchNote)}</p></section><section class="section"><p class="kicker">Editorial workflow</p><h2>How a claim moves toward publication.</h2><ol>${trust.workflow.map((step) => `<li>${esc(step)}</li>`).join("")}</ol></section><section class="section"><p class="kicker">Automation and AI</p><h2>Useful for the workflow, not a substitute for evidence.</h2><div class="feature-list"><article><strong>Allowed</strong>${list(trust.automation.allowed)}</article><article><strong>Not allowed</strong>${list(trust.automation.notAllowed)}</article></div></section><section class="section section--ink"><p class="kicker">Corrections</p><h2>The project should be able to change its mind.</h2><p class="lede">If a source is wrong, a claim is too strong, a relation is misleading or the data contract is inconsistent, corrections are welcome. Evidence-related changes require provenance and editorial review before they change the public evidence state.</p><p><a class="button" href="${esc(trust.corrections.contributing)}">Contribution and correction guide ↗</a></p></section>`;

const target = join(OUT, "about", "editorial", "index.html");
await mkdir(dirname(target), { recursive: true });
await writeFile(target, page("Editorial Process and Maintainer | Cognitive Biases", "Who maintains Cognitive Biases, what evidence-reviewed means, how sources are checked, and how AI and automation are used without replacing editorial review.", "/about/editorial/", body));
await mkdir(join(OUT, "data"), { recursive: true });
await writeFile(join(OUT, "data", "project-trust.json"), JSON.stringify(trust, null, 2) + "\n");

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}
for (const path of await walk(OUT)) {
  if (path === target) continue;
  let html = await readFile(path, "utf8");
  const before = html;
  html = html.replace(/<p class="fine-print">Made by <a href="https:\/\/metalhatscats\.com\/">MetalHatsCats<\/a><\/p>/g, trustLine);
  if (html.includes("</footer>") && !html.includes('href="/about/editorial/"')) html = html.replace("</footer>", `${trustLine}</footer>`);
  if (html !== before) await writeFile(path, html);
}

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
const loc = `${SITE}/about/editorial/`;
if (!sitemap.includes(`<loc>${loc}</loc>`)) sitemap = sitemap.replace("</urlset>", `<url><loc>${loc}</loc><lastmod>${trust.updatedAt}</lastmod></url></urlset>`);
await writeFile(sitemapPath, sitemap);
console.log(`Generated editorial trust layer for ${trust.maintainer.name}.`);
