import { access, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const situationsData = JSON.parse(await readFile("data/situations.json", "utf8"));
const guidesData = JSON.parse(await readFile("data/situation-guides.json", "utf8"));
const practiceIndex = JSON.parse(await readFile("data/reasoning-practice/index.json", "utf8"));

const esc = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[c]);

async function collectEntries(pattern) {
  const files = (await readdir("data")).filter((name) => pattern.test(name));
  const docs = await Promise.all(files.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
  return docs.flatMap((doc) => doc.entries || []);
}

const comparisonBySlug = new Map((await collectEntries(/^comparisons(?:-[a-z0-9-]+)?\.json$/i)).map((entry) => [entry.slug, entry]));
const researchBySlug = new Map((await collectEntries(/^research-notes(?:-[a-z0-9-]+)?\.json$/i)).map((entry) => [entry.slug, entry]));
const practiceBySituation = new Map();

for (const slug of practiceIndex.packs || []) {
  const pack = JSON.parse(await readFile(`data/reasoning-practice/${slug}.json`, "utf8"));
  practiceBySituation.set(slug, pack.scenarios || []);
}

const situationBySlug = new Map(situationsData.situations.map((situation) => [situation.slug, situation]));
const deepSituations = guidesData.guides.map((guide) => {
  const situation = situationBySlug.get(guide.situation);
  if (!situation) throw new Error(`Unknown situation for deep guide: ${guide.situation}`);
  if (guide.tier !== "deep") throw new Error(`${guide.situation}: deep guide tier must be deep.`);
  return { ...situation, guide };
});

function insertAfterHero(html, block) {
  const heroStart = html.indexOf('<section class="page-hero">');
  if (heroStart < 0) throw new Error("Page hero not found.");
  const heroEnd = html.indexOf("</section>", heroStart);
  if (heroEnd < 0) throw new Error("Page hero is not closed.");
  const end = heroEnd + "</section>".length;
  return `${html.slice(0, end)}${block}${html.slice(end)}`;
}

function protocolMarkup(items) {
  return `<ol class="decision-protocol">${items.map((item, index) => `<li><strong>${index + 1}.</strong> ${esc(item)}</li>`).join("")}</ol>`;
}

function scenarioCards(scenarios) {
  return `<div class="application-grid">${scenarios.map((scenario) =>
    `<article class="application-card"><span>${esc(scenario.difficulty)} practice</span><strong>${esc(scenario.title)}</strong><p>${esc(scenario.prompt)}</p><a href="/practice/scenarios/${esc(scenario.slug)}/">Try the scenario →</a></article>`
  ).join("")}</div>`;
}

function comparisonCards(slugs) {
  const entries = slugs.map((slug) => comparisonBySlug.get(slug)).filter(Boolean);
  if (!entries.length) return "";
  return `<section class="section decision-guide-comparisons"><p class="kicker">Compare nearby explanations</p><h2>Similar labels can point to different failures.</h2><div class="application-grid">${entries.map((entry) =>
    `<article class="application-card"><span>Reviewed comparison</span><strong>${esc(entry.title)}</strong><p>${esc(entry.keyDifference || entry.summary)}</p><a href="/compare/${esc(entry.slug)}/">Compare the two →</a></article>`
  ).join("")}</div></section>`;
}

function researchCards(slugs) {
  const entries = slugs.map((slug) => researchBySlug.get(slug)).filter(Boolean);
  if (!entries.length) return "";
  return `<section class="section decision-guide-research"><p class="kicker">Reviewed research notes</p><h2>Go deeper where the evidence needs more context.</h2><div class="application-grid">${entries.map((entry) =>
    `<article class="application-card"><span>${esc(entry.status || "Research note")}</span><strong>${esc(entry.title)}</strong><p>${esc(entry.summary)}</p><a href="/research/${esc(entry.slug)}/">Read the synthesis →</a></article>`
  ).join("")}</div></section>`;
}

function deepGuideMarkup(situation) {
  const guide = situation.guide;
  const scenarios = practiceBySituation.get(situation.slug) || [];
  const recordItems = guide.decisionRecord.map((item) => `<li>${esc(item)}</li>`).join("");
  const why = guide.whyHard.map((paragraph) => `<p>${esc(paragraph)}</p>`).join("");
  return `<div class="decision-deep-guide" data-guide-tier="deep">
    <section class="section decision-guide-problem">
      <p class="kicker">Deep decision guide · reviewed ${esc(guide.reviewedAt)}</p>
      <h2>${esc(guide.hook)}</h2>
      <p class="lede">${esc(guide.problemQuestion)}</p>
      ${why}
    </section>
    <section class="section section--ink decision-guide-protocol" id="decision-review-protocol">
      <p class="kicker">A better review</p>
      <h2>Run the decision in five moves.</h2>
      ${protocolMarkup(guide.reviewProtocol)}
    </section>
    <section class="section decision-guide-example">
      <p class="kicker">Worked example</p>
      <h2>${esc(guide.workedExample.title)}</h2>
      <div class="feature-list">
        <article><strong>Situation</strong><p>${esc(guide.workedExample.setup)}</p></article>
        <article><strong>Weak review</strong><p>${esc(guide.workedExample.weakReview)}</p></article>
        <article><strong>Stronger review</strong><p>${esc(guide.workedExample.strongerReview)}</p></article>
      </div>
    </section>
    <section class="section decision-guide-record">
      <p class="kicker">Decision record</p>
      <h2>Write down the parts that are easiest to rewrite later.</h2>
      <ul>${recordItems}</ul>
    </section>
    <section class="section decision-guide-practice">
      <p class="kicker">Practice the decision</p>
      <h2>Try the reasoning before the stakes are real.</h2>
      ${scenarioCards(scenarios)}
    </section>
    ${comparisonCards(guide.comparisonSlugs || [])}
    ${researchCards(guide.researchNoteSlugs || [])}
    <section class="section decision-guide-boundary">
      <p class="kicker">Evidence boundary</p>
      <h2>Useful lens, not a diagnosis.</h2>
      <p class="lede">${esc(guide.evidenceBoundary)}</p>
      <p class="fine-print">${esc(guide.sourceBoundary)}</p>
    </section>
  </div>`;
}

for (const situation of deepSituations) {
  const path = join(OUT, "situations", situation.slug, "index.html");
  let html = await readFile(path, "utf8");
  if (html.includes('class="decision-deep-guide"')) throw new Error(`${situation.slug}: deep guide already injected.`);
  html = insertAfterHero(html, deepGuideMarkup(situation));
  await writeFile(path, html);
}

const hubPath = join(OUT, "situations", "index.html");
let hub = await readFile(hubPath, "utf8");
if (!hub.includes('id="deep-decision-guides"')) {
  const cards = deepSituations.map((situation) =>
    `<article class="application-card"><span>Deep guide</span><strong>${esc(situation.title)}</strong><p>${esc(situation.guide.hook)} ${esc(situation.guide.problemQuestion)}</p><a href="/situations/${esc(situation.slug)}/">Open the guide →</a></article>`
  ).join("");
  const block = `<section class="section decision-cluster-featured" id="deep-decision-guides"><p class="kicker">Deep decision guides</p><h2>Five decisions where a bias list is not enough.</h2><p class="lede">Each guide connects the situation to a review protocol, realistic practice, nearby explanations and explicit evidence limits.</p><div class="application-grid">${cards}</div></section>`;
  hub = insertAfterHero(hub, block);
  await writeFile(hubPath, hub);
}

for (const situation of deepSituations) {
  const scenarios = practiceBySituation.get(situation.slug) || [];
  if (scenarios.length < 2) throw new Error(`${situation.slug}: deep guide needs at least two practice scenarios.`);
  for (const slug of situation.guide.comparisonSlugs || []) {
    if (!comparisonBySlug.has(slug)) throw new Error(`${situation.slug}: unknown comparison ${slug}.`);
    await access(join(OUT, "compare", slug, "index.html"));
  }
  for (const slug of situation.guide.researchNoteSlugs || []) {
    if (!researchBySlug.has(slug)) throw new Error(`${situation.slug}: unknown research note ${slug}.`);
    await access(join(OUT, "research", slug, "index.html"));
  }
}

await writeFile(join(OUT, "data", "situation-guides.json"), JSON.stringify(guidesData, null, 2) + "\n");

console.log(`Deep decision guides injected for ${deepSituations.length} situations with reciprocal practice, comparison and research links.`);
