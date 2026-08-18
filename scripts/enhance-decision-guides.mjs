import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const contexts = JSON.parse(await readFile("data/contexts.json", "utf8"));
const config = JSON.parse(await readFile("data/context-groups.json", "utf8"));
const bySlug = new Map((contexts.entries || []).map((entry) => [entry.slug, entry]));
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

const seen = new Set();
for (const group of config.groups || []) {
  if (!group.slug || !group.title || !group.summary || !Array.isArray(group.contexts) || !group.contexts.length) {
    throw new Error("Each decision-guide group needs slug, title, summary and at least one context.");
  }
  for (const slug of group.contexts) {
    if (!bySlug.has(slug)) throw new Error(`${group.slug}: unknown context ${slug}.`);
    if (seen.has(slug)) throw new Error(`${slug}: context appears in more than one decision-guide group.`);
    seen.add(slug);
  }
}
for (const slug of bySlug.keys()) {
  if (!seen.has(slug)) throw new Error(`${slug}: context is missing from data/context-groups.json.`);
}
for (const slug of config.homepageFeatured || []) {
  if (!bySlug.has(slug)) throw new Error(`Homepage decision guide ${slug} does not exist.`);
}
if (new Set(config.homepageFeatured || []).size !== (config.homepageFeatured || []).length) throw new Error("Homepage decision guides contain duplicates.");

const card = (context) => `<article class="context-card guide-card"><p class="kicker">Decision guide</p><h3><a href="/contexts/${context.slug}/">${escapeHtml(context.title)}</a></h3><p>${escapeHtml(context.summary)}</p><span>${context.lenses.length} evidence-reviewed lenses</span><a href="/contexts/${context.slug}/">Open guide →</a></article>`;
const groupLinks = (config.groups || []).map((group) => `<a href="#${group.slug}">${escapeHtml(group.title)}</a>`).join("");
const groupsHtml = (config.groups || []).map((group) => {
  const groupContexts = group.contexts.map((slug) => bySlug.get(slug));
  return `<section class="section guide-group" id="${escapeHtml(group.slug)}"><p class="kicker">Decision guides</p><h2>${escapeHtml(group.title)}</h2><p class="lede">${escapeHtml(group.summary)}</p><div class="context-grid">${groupContexts.map(card).join("")}</div></section>`;
}).join("");

const hubPath = join(OUT, "contexts", "index.html");
let hub = await readFile(hubPath, "utf8");
hub = hub.replace(/<title>[^<]*<\/title>/, "<title>Decision guides for real choices | Cognitive Biases</title>");
hub = hub.replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="Practical decision guides for projects, forecasts, AI, misinformation, pricing and choice design, built from evidence-reviewed cognitive-bias lenses.">');
hub = hub.replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="Decision guides for real choices | Cognitive Biases">');
hub = hub.replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="Start with the decision you have, then use evidence-reviewed lenses to test what may be shaping it.">');

const hero = `<section class="page-hero"><p class="eyebrow">Decision guides</p><h1>Start with the decision, not the bias name.</h1><p class="lede">You do not need to know a psychology term first. Choose the situation you are facing, then use a small set of evidence-reviewed questions to test the decision.</p><nav class="guide-jumps" aria-label="Decision guide topics">${groupLinks}</nav></section>`;
const heroPattern = /<section class="page-hero">[\s\S]*?<\/section>/;
if (!heroPattern.test(hub)) throw new Error("Decision-context hub hero was not found.");
hub = hub.replace(heroPattern, hero);

const gridPattern = /<section class="section"><p class="kicker">Available contexts<\/p>[\s\S]*?<div class="context-grid">[\s\S]*?<\/div><\/section>/;
if (!gridPattern.test(hub)) throw new Error("Decision-context hub grid was not found.");
hub = hub.replace(gridPattern, groupsHtml);

hub = hub.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (match, payload) => {
  let schema;
  try { schema = JSON.parse(payload); } catch { return match; }
  const graph = schema?.["@graph"];
  if (!Array.isArray(graph)) return match;
  const page = graph.find((node) => node?.["@id"] === `${SITE}/contexts/#page`);
  const list = graph.find((node) => node?.["@id"] === `${SITE}/contexts/#contexts`);
  if (!page || !list) return match;
  page.name = "Decision guides for real choices | Cognitive Biases";
  page.description = "Practical decision guides organized around projects, forecasts, AI, information checking, pricing and choice design.";
  page.mainEntity = { "@id": `${SITE}/contexts/#contexts` };
  if (!graph.some((node) => node?.["@id"] === `${SITE}/contexts/#breadcrumb`)) {
    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${SITE}/contexts/#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Decision guides", item: `${SITE}/contexts/` },
      ],
    });
  }
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
});
await writeFile(hubPath, hub);

const homePath = join(OUT, "index.html");
let home = await readFile(homePath, "utf8");
if (home.includes('class="section home-guides"')) throw new Error("Homepage decision-guide section was already inserted.");
const featured = (config.homepageFeatured || []).map((slug) => bySlug.get(slug));
const homeGuides = `<section class="section home-guides"><p class="kicker">Start from a real situation</p><h2>Decision guides for the questions people actually have.</h2><p class="lede">Use a guide when you know the problem but not the bias name. Each one combines a small set of reviewed lenses with a concrete workflow.</p><div class="home-guide-grid">${featured.map((context) => `<article><h3><a href="/contexts/${context.slug}/">${escapeHtml(context.title)}</a></h3><p>${escapeHtml(context.summary)}</p><a href="/contexts/${context.slug}/">Use this guide →</a></article>`).join("")}</div><p><a class="button" href="/contexts/">Browse all decision guides</a></p></section>`;
const systemPattern = /<section class="section home-system">[\s\S]*?<\/section>/;
if (!systemPattern.test(home)) throw new Error("Homepage decision-system section was not found for guide discovery.");
home = home.replace(systemPattern, (section) => `${section}${homeGuides}`);
await writeFile(homePath, home);

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".guide-jumps{")) {
  styles += `\n.guide-jumps{display:flex;gap:.55rem;flex-wrap:wrap;margin-top:1.3rem}.guide-jumps a{padding:.45rem .65rem;border:2px solid var(--ink);background:#fff;font-weight:900;text-decoration:none}.guide-group{scroll-margin-top:90px}.guide-group>.lede{max-width:850px}.guide-card h3{font:1.2rem/1.08 Archivo Black,sans-serif;letter-spacing:-.04em;margin:0}.guide-card h3 a{text-decoration:none}.home-guide-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-left:var(--line);border-top:var(--line);margin:1.5rem 0}.home-guide-grid article{display:flex;flex-direction:column;gap:.7rem;min-height:210px;padding:1.1rem;border-right:var(--line);border-bottom:var(--line);background:#fff}.home-guide-grid h3{font:1.15rem/1.08 Archivo Black,sans-serif;letter-spacing:-.035em;margin:0}.home-guide-grid h3 a{text-decoration:none}.home-guide-grid article>a{margin-top:auto;font-weight:900}@media(max-width:760px){.home-guide-grid{grid-template-columns:1fr}}\n`;
  await writeFile(stylesPath, styles);
}

console.log(`Decision-guide discovery enhanced: ${bySlug.size} contexts in ${config.groups.length} groups; ${featured.length} featured on homepage.`);
