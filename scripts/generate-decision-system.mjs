import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const situationsData = JSON.parse(await readFile("data/situations.json", "utf8"));
const techniquesData = JSON.parse(await readFile("data/techniques.json", "utf8"));
const skillsData = JSON.parse(await readFile("data/skills.json", "utf8"));
const biases = JSON.parse(await readFile("data/biases.json", "utf8"));

const esc = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[c]);

const biasBySlug = new Map(biases.map((bias) => [bias.slug, bias]));
const techniqueBySlug = new Map(techniquesData.techniques.map((technique) => [technique.slug, technique]));
const skillBySlug = new Map(skillsData.entries.map((skill) => [skill.slug, skill]));

function biasTitle(slug) {
  const record = biasBySlug.get(slug);
  return record ? String(record.title).split(" – ")[0] : slug;
}
function nav() {
  return `<header class="site-header"><a class="brand" href="/"><img src="/assets/icon2.png" width="48" height="48" alt="Cognitive Biases icon"><span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/decide/">Decide</a><a href="/skills/">Learn</a><a href="/research/">Research</a><a class="nav-cta" href="/data/">Data</a></nav></header>`;
}
const footer = `<footer class="site-footer"><div><a class="brand brand--footer" href="/"><img src="/assets/icon2.png" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p>Evidence-backed decision tools for people and AI.</p></div><div class="footer-links"><a href="/decide/">Decide</a><a href="/situations/">Situations</a><a href="/techniques/">Techniques</a><a href="/skills/">Skills</a><a href="/research/">Research</a><a href="/data/">Data</a></div><p class="fine-print">Educational information, not medical, legal, financial or mental-health advice.</p></footer>`;

function page(title, description, path, body, schemaType = "WebPage") {
  const canonical = `${SITE}${path}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: title,
    description,
    url: canonical,
    isPartOf: { "@type": "WebSite", name: "Cognitive Biases", url: SITE }
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip" href="#main">Skip to content</a>${nav()}<main id="main">${body}</main>${footer}</body></html>`;
}
async function emit(path, html) {
  const target = join(OUT, path.replace(/^\//, ""), "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}
const card = (label, title, text, href) => `<article class="application-card"><span>${esc(label)}</span><strong>${esc(title)}</strong><p>${esc(text)}</p><a href="${href}">Open →</a></article>`;
const list = (items) => `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;

const featuredSituations = situationsData.situations.slice(0, 6).map((s) => card("Situation", s.title, s.summary, `/situations/${s.slug}/`)).join("");
const decideBody = `<section class="page-hero"><p class="eyebrow">Decision-first</p><h1>Start with the decision, not the bias name.</h1><p class="lede">Choose a real situation, check what evidence is missing, use a few relevant cognitive-bias lenses, then select a practical technique and write the next action.</p><p><a class="button" href="/situations/">Choose a situation</a> <a class="button button--dark" href="/tools/decision-audit/">Open Decision Audit</a></p></section><section class="section"><p class="kicker">A simple path</p><h2>Situation → evidence → lens → technique → action.</h2><div class="feature-list"><article><strong>1. Situation</strong><p>Describe the decision in ordinary language.</p></article><article><strong>2. Missing evidence</strong><p>Separate what is known from what still needs checking.</p></article><article><strong>3. Lenses</strong><p>Use a small number of reviewed concepts as questions, not diagnoses.</p></article><article><strong>4. Technique</strong><p>Choose a concrete reasoning move such as an independent estimate or reference class.</p></article><article><strong>5. Action</strong><p>Record the next step and what would make you update the decision.</p></article></div></section><section class="section"><p class="kicker">Common situations</p><h2>Where a structured review can help.</h2><div class="application-grid">${featuredSituations}</div><p><a class="button button--dark" href="/situations/">All situations</a></p></section><section class="section section--ink"><p class="kicker">Practical layer</p><h2>Awareness is not the intervention.</h2><p class="lede">Knowing a bias name rarely changes a decision by itself. Techniques turn the library into repeatable checks that can be used in a meeting, an AI prompt, a project review or a personal decision.</p><p><a class="button" href="/techniques/">Browse techniques</a></p></section>`;
await emit("/decide/", page("Decision Review | Cognitive Biases", "Evidence-backed decision tools that start from a real situation and connect missing evidence, cognitive-bias lenses, practical techniques and next actions.", "/decide/", decideBody));

const situationHubBody = `<section class="page-hero"><p class="eyebrow">Situation-first library</p><h1>What decision are you making?</h1><p class="lede">You do not need to know the name of a cognitive bias. Start from the work or life situation, then use a few evidence-aware questions to test the decision.</p></section><section class="section"><div class="application-grid">${situationsData.situations.map((s) => card("Situation", s.title, s.summary, `/situations/${s.slug}/`)).join("")}</div></section><section class="section section--ink"><p class="kicker">Boundary</p><h2>A lens is a question, not a diagnosis.</h2><p class="lede">These pages show reasoning risks that may be worth checking. They do not prove that a person or team has a named bias.</p></section>`;
await emit("/situations/", page("Decision Situations | Cognitive Biases", "Situation-first guides for hiring, estimation, incidents, product decisions, vendor selection, forecasting, negotiation, AI research and more.", "/situations/", situationHubBody));

for (const s of situationsData.situations) {
  const lensCards = s.biases.map((slug) => card("Evidence-linked lens", biasTitle(slug), "Use this concept as a question to test the decision, not as a label for a person.", `/biases/${slug}/`)).join("");
  const techniqueCards = s.techniques.map((slug) => {
    const technique = techniqueBySlug.get(slug);
    return card("Technique", technique.title, technique.purpose, `/techniques/${slug}/`);
  }).join("");
  const skill = skillBySlug.get(s.skill);
  const body = `<section class="page-hero"><p class="eyebrow">Decision situation</p><h1>${esc(s.title)}</h1><p class="lede">${esc(s.summary)}</p><p><a class="button" href="/tools/decision-audit/">Use Decision Audit</a></p></section><section class="section"><p class="kicker">Signals to notice</p><h2>Reasons to slow down and check.</h2>${list(s.signals)}</section><section class="section section--ink"><p class="kicker">Questions before action</p><h2>Make the missing evidence visible.</h2>${list(s.questions)}</section><section class="section"><p class="kicker">Relevant lenses</p><h2>Concepts that may help you test the reasoning.</h2><div class="application-grid">${lensCards}</div></section><section class="section"><p class="kicker">Practical moves</p><h2>Do something different, not only notice a label.</h2><div class="application-grid">${techniqueCards}</div></section><section class="section"><p class="kicker">Skill to develop</p><h2><a href="/skills/${skill.slug}/">${esc(skill.title)}</a></h2><p class="lede">${esc(skill.outcome)}</p></section>`;
  await emit(`/situations/${s.slug}/`, page(`${s.title} Decision Review | Cognitive Biases`, `${s.summary} Practical questions, relevant cognitive-bias lenses and decision techniques.`, `/situations/${s.slug}/`, body));
}

const techniqueHubBody = `<section class="page-hero"><p class="eyebrow">Debiasing toolkit</p><h1>Techniques for better decisions.</h1><p class="lede">A cognitive-bias label is useful only if it changes what you check or do next. These techniques are short, reusable reasoning procedures linked to situations and reviewed concepts.</p></section><section class="section"><div class="application-grid">${techniquesData.techniques.map((t) => card("Technique", t.title, t.purpose, `/techniques/${t.slug}/`)).join("")}</div></section><section class="section section--ink"><p class="kicker">Use carefully</p><h2>No technique is a universal cure.</h2><p class="lede">Effectiveness depends on the task, timing, evidence quality and how the technique is used. The goal is a more inspectable decision process, not a promise of perfect rationality.</p></section>`;
await emit("/techniques/", page("Decision Techniques | Cognitive Biases", "Practical techniques including independent estimates, reference-class forecasting, decision journals, red-team review and source tracing.", "/techniques/", techniqueHubBody));

for (const t of techniquesData.techniques) {
  const relatedSituations = situationsData.situations.filter((s) => s.techniques.includes(t.slug));
  const situationCards = relatedSituations.map((s) => card("Use in", s.title, s.summary, `/situations/${s.slug}/`)).join("");
  const lensCards = t.biases.map((slug) => card("Related lens", biasTitle(slug), "Read the evidence and limits before treating this technique as relevant.", `/biases/${slug}/`)).join("");
  const body = `<section class="page-hero"><p class="eyebrow">Decision technique</p><h1>${esc(t.title)}</h1><p class="lede">${esc(t.purpose)}</p></section><section class="section"><p class="kicker">When to use</p><h2>A specific reasoning move for a specific problem.</h2><p class="lede">${esc(t.whenToUse)}</p></section><section class="section section--ink"><p class="kicker">Procedure</p><h2>Run the technique.</h2><ol>${t.steps.map((step) => `<li>${esc(step)}</li>`).join("")}</ol></section><section class="section"><p class="kicker">Limit</p><h2>What this technique cannot guarantee.</h2><p class="lede">${esc(t.limitations)}</p></section><section class="section"><p class="kicker">Situations</p><h2>Where this may be useful.</h2><div class="application-grid">${situationCards}</div></section><section class="section"><p class="kicker">Evidence-linked concepts</p><h2>Why this check may matter.</h2><div class="application-grid">${lensCards}</div></section>`;
  await emit(`/techniques/${t.slug}/`, page(`${t.title} | Cognitive Biases`, `${t.purpose} Step-by-step procedure, limitations and related decision situations.`, `/techniques/${t.slug}/`, body, "HowTo"));
}

await mkdir(join(OUT, "data"), { recursive: true });
await writeFile(join(OUT, "data", "situations.json"), JSON.stringify(situationsData, null, 2) + "\n");
await writeFile(join(OUT, "data", "techniques.json"), JSON.stringify(techniquesData, null, 2) + "\n");

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}
const primaryNav = `<nav aria-label="Primary"><a href="/decide/">Decide</a><a href="/skills/">Learn</a><a href="/research/">Research</a><a class="nav-cta" href="/data/">Data</a></nav>`;
for (const path of await walk(OUT)) {
  let html = await readFile(path, "utf8");
  const before = html;
  html = html.replace(/<nav aria-label="Primary">[\s\S]*?<\/nav>/, primaryNav);
  if (html !== before) await writeFile(path, html);
}

const homePath = join(OUT, "index.html");
let home = await readFile(homePath, "utf8");
if (!home.includes('class="decision-first-home"')) {
  const block = `<section class="section decision-first-home"><p class="kicker">Start with a real decision</p><h2>From bias names to a decision you can inspect.</h2><p class="lede">Choose a situation, identify missing evidence, use a few relevant lenses and finish with a practical next action.</p><div class="application-grid"><article class="application-card"><span>Decision path</span><strong>Choose a situation</strong><p>Hiring, estimation, incidents, AI research, vendor selection, negotiation and more.</p><a href="/situations/">Start from a situation →</a></article><article class="application-card"><span>Practical toolkit</span><strong>Use a technique</strong><p>Independent estimates, outside view, decision journals, red-team review, source tracing and more.</p><a href="/techniques/">Browse techniques →</a></article></div></section>`;
  home = home.replace("</main>", `${block}</main>`);
  await writeFile(homePath, home);
}

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
const routes = [
  "/decide/", "/situations/", ...situationsData.situations.map((s) => `/situations/${s.slug}/`),
  "/techniques/", ...techniquesData.techniques.map((t) => `/techniques/${t.slug}/`)
];
for (const route of routes) {
  const loc = `${SITE}${route}`;
  if (!sitemap.includes(`<loc>${loc}</loc>`)) {
    sitemap = sitemap.replace("</urlset>", `<url><loc>${loc}</loc><lastmod>${situationsData.updatedAt}</lastmod></url></urlset>`);
  }
}
await writeFile(sitemapPath, sitemap);

console.log(`Generated decision-first layer: ${situationsData.situations.length} situations and ${techniquesData.techniques.length} techniques.`);
