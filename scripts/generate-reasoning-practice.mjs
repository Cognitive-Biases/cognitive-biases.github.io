import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const practiceIndex = JSON.parse(await readFile("data/reasoning-practice/index.json", "utf8"));
const { packs: packSlugs = [], ...practiceMetadata } = practiceIndex;
const practicePacks = await Promise.all(packSlugs.map(async (slug) => {
  const pack = JSON.parse(await readFile(`data/reasoning-practice/${slug}.json`, "utf8"));
  if (pack.situation !== slug) throw new Error(`${slug}: reasoning-practice pack has a mismatched situation.`);
  for (const scenario of pack.scenarios || []) if (scenario.situation !== slug) throw new Error(`${scenario.slug}: scenario situation does not match ${slug}.`);
  return pack;
}));
const source = { ...practiceMetadata, scenarios: practicePacks.flatMap((pack) => pack.scenarios || []) };
const situationsData = JSON.parse(await readFile("data/situations.json", "utf8"));
const techniquesData = JSON.parse(await readFile("data/techniques.json", "utf8"));
const skillsData = JSON.parse(await readFile("data/skills.json", "utf8"));
const biases = JSON.parse(await readFile("data/biases.json", "utf8"));
const release = JSON.parse(await readFile("data/release.json", "utf8"));

const esc = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);
const situationBySlug = new Map(situationsData.situations.map((item) => [item.slug, item]));
const techniqueBySlug = new Map(techniquesData.techniques.map((item) => [item.slug, item]));
const skillBySlug = new Map(skillsData.entries.map((item) => [item.slug, item]));
const biasBySlug = new Map(biases.map((item) => [item.slug, item]));
const difficultyLabel = { starter: "Starter", intermediate: "Intermediate", advanced: "Advanced" };

function titleOfBias(slug) {
  const record = biasBySlug.get(slug);
  return String(record?.title || record?.name || slug).split(" – ")[0].trim();
}
function brand(size, alt = "") {
  return `<picture class="brand-picture"><source type="image/webp" srcset="/assets/brand.webp"><img src="/assets/biases_icon.png" width="${size}" height="${size}" alt="${esc(alt)}"></picture>`;
}
function header(current = "") {
  const items = [
    ["Decide", "/decide/", "decide"],
    ["Explore", "/explore/", "explore"],
    ["Compare", "/compare/", "compare"],
    ["Contexts", "/contexts/", "contexts"],
    ["Skills", "/skills/", "skills"],
    ["Practice", "/practice/", "practice"],
    ["Research", "/research/", "research"]
  ];
  const links = items.map(([label, href, key]) => `<a href="${href}"${current === key ? ' aria-current="page"' : ""}>${label}</a>`).join("");
  return `<header class="site-header"><a class="brand" href="/">${brand(48, "Cognitive Biases icon")}<span>Cognitive<br>Biases</span></a><nav aria-label="Primary">${links}<a class="nav-cta" href="/data/">Data</a></nav></header>`;
}
function footer() {
  return `<footer class="site-footer"><div><a class="brand brand--footer" href="/">${brand(40)}<span>Cognitive Biases</span></a><p>Evidence-backed decision tools for people and AI.</p></div><div class="footer-links"><a href="/decide/">Decide</a><a href="/practice/scenarios/">Reasoning practice</a><a href="/situations/">Situations</a><a href="/techniques/">Techniques</a><a href="/about/editorial/">Editorial process</a><a href="/data/">Data</a></div><p class="fine-print">Educational information, not medical, legal, financial or mental-health advice.</p></footer>`;
}
function page(title, description, path, body, schema) {
  const canonical = `${SITE}${path}`;
  const jsonLd = schema || {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: canonical,
    isPartOf: { "@type": "WebSite", name: "Cognitive Biases", url: SITE }
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head><body><a class="skip" href="#main">Skip to content</a>${header("practice")}<main id="main">${body}</main>${footer()}</body></html>`;
}
async function emit(route, html) {
  const target = join(OUT, route.replace(/^\//, ""), "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}
function scenarioCard(scenario) {
  const situation = situationBySlug.get(scenario.situation);
  const skill = skillBySlug.get(scenario.skill);
  return `<article class="application-card reasoning-card"><span>${esc(difficultyLabel[scenario.difficulty])} · ${esc(situation.title)}</span><strong>${esc(scenario.title)}</strong><p>${esc(scenario.prompt)}</p><small>Skill: ${esc(skill.title)}</small><a href="/practice/scenarios/${scenario.slug}/">Open scenario →</a></article>`;
}
function groupCards(items) {
  return `<div class="application-grid">${items.map(scenarioCard).join("")}</div>`;
}

const bySituation = situationsData.situations.map((situation) => ({
  situation,
  scenarios: source.scenarios.filter((scenario) => scenario.situation === situation.slug)
})).filter((group) => group.scenarios.length);
const bySkill = skillsData.entries.map((skill) => ({
  skill,
  scenarios: source.scenarios.filter((scenario) => scenario.skill === skill.slug)
})).filter((group) => group.scenarios.length);

const situationNav = bySituation.map(({ situation, scenarios }) => `<a class="reasoning-chip" href="#situation-${situation.slug}">${esc(situation.title)} <span>${scenarios.length}</span></a>`).join("");
const skillNav = bySkill.map(({ skill, scenarios }) => `<a class="reasoning-chip" href="#skill-${skill.slug}">${esc(skill.title)} <span>${scenarios.length}</span></a>`).join("");
const situationSections = bySituation.map(({ situation, scenarios }) => `<section class="section reasoning-group" id="situation-${situation.slug}"><p class="kicker">Situation</p><h2>${esc(situation.title)}</h2><p class="lede">${esc(situation.summary)}</p>${groupCards(scenarios)}</section>`).join("");
const skillSections = bySkill.map(({ skill, scenarios }) => `<section class="section reasoning-group" id="skill-${skill.slug}"><p class="kicker">Decision skill</p><h2>${esc(skill.title)}</h2><p class="lede">${esc(skill.outcome)}</p>${groupCards(scenarios)}</section>`).join("");
const hubCanonical = `${SITE}/practice/scenarios/`;
const hubSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": `${hubCanonical}#page`,
      url: hubCanonical,
      name: "Reasoning Practice | Cognitive Biases",
      description: source.description,
      isPartOf: { "@type": "WebSite", name: "Cognitive Biases", url: SITE }
    },
    {
      "@type": "ItemList",
      numberOfItems: source.scenarios.length,
      itemListElement: source.scenarios.map((scenario, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: scenario.title,
        url: `${SITE}/practice/scenarios/${scenario.slug}/`
      }))
    }
  ]
};
const hubBody = `<section class="page-hero"><p class="eyebrow">Reasoning Practice</p><h1>Practice decisions, not definitions.</h1><p class="lede">Read a realistic situation, choose the best first reasoning move, inspect missing evidence and finish with a practical next action. Several lenses may fit. The exercise teaches a useful first move rather than pretending one label explains everything.</p><p><a class="button" href="#browse-situation">Browse by situation</a> <a class="button button--dark" href="#browse-skill">Browse by skill</a></p></section><section class="section reasoning-overview"><p class="kicker">Coverage</p><h2>${source.scenarios.length} scenarios across ${bySituation.length} situations and ${bySkill.length} skills.</h2><div class="feature-list"><article><strong>1. Notice</strong><p>Read the decision without searching for a bias name.</p></article><article><strong>2. Choose</strong><p>Select the action that would make the reasoning more informative.</p></article><article><strong>3. Inspect</strong><p>Compare the explanation, missing evidence and alternative lenses.</p></article><article><strong>4. Act</strong><p>Finish with one concrete next step.</p></article></div></section><section class="section" id="browse-situation"><p class="kicker">Browse by situation</p><h2>Start from the decision in front of you.</h2><div class="reasoning-chip-list">${situationNav}</div></section>${situationSections}<section class="section section--ink" id="browse-skill"><p class="kicker">Browse by skill</p><h2>Train a capability across several situations.</h2><div class="reasoning-chip-list">${skillNav}</div></section>${skillSections}<section class="section"><p class="kicker">Boundary</p><h2>This is practice, not psychological assessment.</h2><p class="lede">${esc(source.boundary)}</p><p><a href="/about/editorial/">How the project reviews evidence and automation</a></p></section>`;
await emit("/practice/scenarios/", page("Reasoning Practice | Cognitive Biases", source.description, "/practice/scenarios/", hubBody, hubSchema));

for (const scenario of source.scenarios) {
  const situation = situationBySlug.get(scenario.situation);
  const skill = skillBySlug.get(scenario.skill);
  const technique = techniqueBySlug.get(scenario.technique);
  const primaryTitle = titleOfBias(scenario.primaryLens);
  const best = scenario.options.find((option) => option.id === scenario.bestOption);
  const optionMarkup = scenario.options.map((option) => `<li class="reasoning-option"><span>${option.id.toUpperCase()}</span><p>${esc(option.text)}</p></li>`).join("");
  const alternativeMarkup = scenario.alternativeLenses.length
    ? `<ul>${scenario.alternativeLenses.map((slug) => `<li><a href="/biases/${slug}/#evidence">${esc(titleOfBias(slug))}</a></li>`).join("")}</ul>`
    : `<p>No alternative lens is required for this exercise.</p>`;
  const canonical = `${SITE}/practice/scenarios/${scenario.slug}/`;
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LearningResource",
        "@id": `${canonical}#resource`,
        url: canonical,
        name: scenario.title,
        description: scenario.prompt,
        learningResourceType: "Scenario-based practice exercise",
        educationalLevel: difficultyLabel[scenario.difficulty],
        inLanguage: "en",
        about: [
          { "@type": "DefinedTerm", name: primaryTitle, url: `${SITE}/biases/${scenario.primaryLens}/` },
          { "@type": "DefinedTerm", name: skill.title, url: `${SITE}/skills/${skill.slug}/` }
        ],
        isPartOf: { "@type": "CollectionPage", name: "Reasoning Practice", url: hubCanonical }
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Practice", item: `${SITE}/practice/` },
          { "@type": "ListItem", position: 3, name: "Reasoning Practice", item: hubCanonical },
          { "@type": "ListItem", position: 4, name: scenario.title, item: canonical }
        ]
      }
    ]
  };
  const body = `<section class="page-hero"><p class="eyebrow">Reasoning Practice · ${esc(difficultyLabel[scenario.difficulty])}</p><h1>${esc(scenario.title)}</h1><p class="lede">${esc(scenario.prompt)}</p><div class="reasoning-meta"><a href="/situations/${situation.slug}/">${esc(situation.title)}</a><a href="/skills/${skill.slug}/">${esc(skill.title)}</a><a href="/techniques/${technique.slug}/">${esc(technique.title)}</a></div></section><section class="section reasoning-question"><p class="kicker">Your decision</p><h2>${esc(scenario.question)}</h2><ol class="reasoning-options">${optionMarkup}</ol><details class="reasoning-answer"><summary>Show the best first move</summary><div><p class="reasoning-best"><strong>${scenario.bestOption.toUpperCase()}.</strong> ${esc(best.text)}</p><h3>Why this move helps</h3><p>${esc(scenario.explanation)}</p><h3>Evidence still missing</h3><ul>${scenario.missingEvidence.map((item) => `<li>${esc(item)}</li>`).join("")}</ul><h3>Evidence note</h3><p>${esc(scenario.evidenceNote)}</p><h3>Next action</h3><p>${esc(scenario.nextAction)}</p></div></details></section><section class="section section--ink"><p class="kicker">Best first lens</p><h2><a href="/biases/${scenario.primaryLens}/#evidence">${esc(primaryTitle)}</a></h2><p class="lede">Use the lens to ask a better question. It does not prove that a person or team has a cognitive bias.</p><p><a class="button" href="/biases/${scenario.primaryLens}/#evidence">Read the evidence review</a></p></section><section class="section"><p class="kicker">Other defensible lenses</p><h2>The situation may have more than one explanation.</h2>${alternativeMarkup}</section><section class="section"><p class="kicker">Continue the path</p><h2>Situation → skill → technique → action.</h2><div class="application-grid"><article class="application-card"><span>Situation</span><strong>${esc(situation.title)}</strong><p>${esc(situation.summary)}</p><a href="/situations/${situation.slug}/">Open situation →</a></article><article class="application-card"><span>Skill</span><strong>${esc(skill.title)}</strong><p>${esc(skill.outcome)}</p><a href="/skills/${skill.slug}/">Build this skill →</a></article><article class="application-card"><span>Technique</span><strong>${esc(technique.title)}</strong><p>${esc(technique.purpose)}</p><a href="/techniques/${technique.slug}/">Run the technique →</a></article></div></section><section class="section"><p><a class="button button--dark" href="/practice/scenarios/">All reasoning scenarios</a></p></section>`;
  await emit(`/practice/scenarios/${scenario.slug}/`, page(`${scenario.title} | Reasoning Practice`, scenario.prompt, `/practice/scenarios/${scenario.slug}/`, body, schema));
}

await mkdir(join(OUT, "data"), { recursive: true });
await mkdir(join(OUT, "schemas"), { recursive: true });
await mkdir(join(OUT, "data", "schemas"), { recursive: true });
const publicData = { ...source, releaseVersion: release.releaseVersion };
await writeFile(join(OUT, "data", "reasoning-practice.json"), `${JSON.stringify(publicData, null, 2)}\n`);
await copyFile("schemas/reasoning-practice.schema.json", join(OUT, "schemas", "reasoning-practice.schema.json"));
await copyFile("schemas/reasoning-practice.schema.json", join(OUT, "data", "schemas", "reasoning-practice.schema.json"));

async function patchPage(path, marker, block, preferredMarker = "</main>") {
  let html = await readFile(path, "utf8");
  if (html.includes(marker)) return;
  if (preferredMarker && html.includes(preferredMarker)) html = html.replace(preferredMarker, `${block}${preferredMarker}`);
  else html += block;
  await writeFile(path, html);
}

const practiceCta = `<section class="section reasoning-practice-cta"><p class="kicker">Realistic reasoning scenarios</p><h2>Move beyond matching a question to a bias name.</h2><p class="lede">Practice choosing a useful first action, identifying missing evidence and keeping alternative explanations visible.</p><p><a class="button" href="/practice/scenarios/">Open ${source.scenarios.length} reasoning scenarios</a></p></section>`;
await patchPage(join(OUT, "practice", "index.html"), "reasoning-practice-cta", practiceCta);
const decideCta = `<section class="section reasoning-practice-cta"><p class="kicker">Train the decision path</p><h2>Practice before the real decision becomes expensive.</h2><p class="lede">Scenario exercises connect a situation to a reviewed lens, a practical technique and a next action.</p><p><a class="button" href="/practice/scenarios/">Open Reasoning Practice</a></p></section>`;
await patchPage(join(OUT, "decide", "index.html"), "reasoning-practice-cta", decideCta);

for (const situation of situationsData.situations) {
  const scenarios = source.scenarios.filter((scenario) => scenario.situation === situation.slug);
  if (!scenarios.length) continue;
  const block = `<section class="section reasoning-practice-links"><p class="kicker">Practice this situation</p><h2>Choose a useful first move.</h2>${groupCards(scenarios)}</section>`;
  await patchPage(join(OUT, "situations", situation.slug, "index.html"), "reasoning-practice-links", block);
}
for (const skill of skillsData.entries) {
  const scenarios = source.scenarios.filter((scenario) => scenario.skill === skill.slug);
  if (!scenarios.length) continue;
  const block = `<section class="section reasoning-practice-links"><p class="kicker">Practice this skill</p><h2>Apply the capability across real decisions.</h2>${groupCards(scenarios)}</section>`;
  await patchPage(join(OUT, "skills", skill.slug, "index.html"), "reasoning-practice-links", block);
}
for (const technique of techniquesData.techniques) {
  const scenarios = source.scenarios.filter((scenario) => scenario.technique === technique.slug);
  if (!scenarios.length) continue;
  const block = `<section class="section reasoning-practice-links"><p class="kicker">Practice this technique</p><h2>See when the move becomes useful.</h2>${groupCards(scenarios)}</section>`;
  await patchPage(join(OUT, "techniques", technique.slug, "index.html"), "reasoning-practice-links", block);
}

const dataBlock = `<section class="section reasoning-practice-data"><p class="kicker">Reasoning Practice dataset</p><h2>Realistic decision scenarios for people and AI systems.</h2><p class="lede">${source.scenarios.length} scenarios link situations, skills, reviewed lenses, techniques, missing evidence and practical next actions.</p><p><a class="button" href="/data/reasoning-practice.json">Download JSON</a> <a class="button button--dark" href="/schemas/reasoning-practice.schema.json">View JSON Schema</a></p></section>`;
await patchPage(join(OUT, "data", "index.html"), "reasoning-practice-data", dataBlock);
const qualityBlock = `<section class="section reasoning-practice-quality"><p class="kicker">Reasoning Practice coverage</p><h2>${source.scenarios.length} reviewed-link scenarios.</h2><p class="lede">Coverage: ${bySituation.length} decision situations, ${bySkill.length} decision skills and ${techniquesData.techniques.length} practical techniques. Every scenario keeps its primary lens, alternatives, missing evidence and next action explicit.</p></section>`;
await patchPage(join(OUT, "quality", "index.html"), "reasoning-practice-quality", qualityBlock);

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
const routes = ["/practice/scenarios/", ...source.scenarios.map((scenario) => `/practice/scenarios/${scenario.slug}/`)];
for (const route of routes) {
  const loc = `${SITE}${route}`;
  if (!sitemap.includes(`<loc>${loc}</loc>`)) sitemap = sitemap.replace("</urlset>", `<url><loc>${loc}</loc><lastmod>${source.updatedAt}</lastmod></url></urlset>`);
}
await writeFile(sitemapPath, sitemap);

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".reasoning-chip-list{")) {
  styles += `\n.reasoning-chip-list{display:flex;flex-wrap:wrap;gap:.65rem;margin:1.5rem 0}.reasoning-chip{display:inline-flex;gap:.5rem;align-items:center;padding:.65rem .8rem;border:var(--line);background:#fff;font-weight:800;text-decoration:none}.reasoning-chip span{font-size:.76rem;opacity:.7}.reasoning-meta{display:flex;flex-wrap:wrap;gap:.55rem;margin-top:1.25rem}.reasoning-meta a{padding:.45rem .65rem;border:1px solid currentColor;font-size:.82rem;font-weight:800;text-decoration:none}.reasoning-options{display:grid;gap:.75rem;list-style:none;padding:0;margin:1.5rem 0}.reasoning-option{display:grid;grid-template-columns:2.25rem 1fr;gap:.8rem;align-items:start;padding:1rem;border:var(--line);background:#fff}.reasoning-option>span{display:grid;place-items:center;width:2.1rem;height:2.1rem;border:2px solid currentColor;font-weight:900}.reasoning-option p{margin:.2rem 0}.reasoning-answer{margin-top:1.25rem;border:var(--line);background:#fff}.reasoning-answer summary{cursor:pointer;padding:1rem;font-weight:900}.reasoning-answer>div{padding:0 1.25rem 1.25rem;border-top:var(--line)}.reasoning-best{font-size:1.08rem}.reasoning-card small{display:block}.reasoning-group{scroll-margin-top:1rem}@media(max-width:760px){.reasoning-option{grid-template-columns:1.9rem 1fr}.reasoning-chip-list{display:grid}.reasoning-chip{justify-content:space-between}}\n`;
  await writeFile(stylesPath, styles);
}

console.log(`Generated ${source.scenarios.length} realistic reasoning scenarios across ${bySituation.length} situations and ${bySkill.length} skills.`);
