import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const DATA_OUT = join(OUT, "data");
const contexts = JSON.parse(await readFile("data/contexts.json", "utf8"));
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const duplicates = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const release = JSON.parse(await readFile("data/release.json", "utf8"));
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const evidenceReviews = evidenceDocs.flatMap((document) => document.reviews || []);
const evidenceBySlug = new Map(evidenceReviews.map((review) => [review.slug, review]));
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const titleOf = (bias) => String(bias?.title || bias?.name || bias?.slug || "Untitled concept").split(" – ")[0].trim();

function optionsFor(lenses, index) {
  const count = lenses.length;
  const answer = lenses[index];
  const choices = [answer, lenses[(index + 1) % count], lenses[(index + 2) % count]];
  const shift = index % choices.length;
  return [...choices.slice(shift), ...choices.slice(0, shift)];
}

function brand(size, alt) {
  return `<picture class="brand-picture"><source type="image/webp" srcset="/assets/brand.webp"><img src="/assets/biases_icon.png" width="${size}" height="${size}" alt="${escapeHtml(alt)}"></picture>`;
}

function header(current = "") {
  const link = (href, label, key) => `<a href="${href}"${current === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<header class="site-header"><a class="brand" href="/">${brand(48, "Cognitive Biases icon")}<span>Cognitive<br>Biases</span></a><nav aria-label="Primary">${link("/explore/", "Explore", "explore")}${link("/contexts/", "Decision guides", "contexts")}${link("/practice/", "Practice", "practice")}${link("/evidence/", "Evidence", "evidence")}${link("/research/", "Research", "research")}${link("/data/", "Data", "data")}</nav></header>`;
}

function footer() {
  return `<footer class="site-footer"><div><a class="brand brand--footer" href="/">${brand(40, "")}<span>Cognitive Biases</span></a><p>A public guide to cognitive biases, evidence and better decisions.</p></div><div class="footer-links"><a href="/practice/">Practice Lab</a><a href="/contexts/">Decision guides</a><a href="/methodology/">Methodology</a><a href="/quality/">Quality status</a><a href="/data/">Data</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p></footer>`;
}

const practiceSets = [];
for (const context of contexts.entries || []) {
  if (!Array.isArray(context.lenses) || context.lenses.length < 3) throw new Error(`${context.slug}: practice needs at least three reviewed lenses.`);
  const lenses = context.lenses.map((lens) => {
    const bias = bySlug.get(lens.slug);
    const review = evidenceBySlug.get(lens.slug);
    if (!bias || duplicateIds.has(bias.id)) throw new Error(`${context.slug}: ${lens.slug} is not canonical.`);
    if (!review) throw new Error(`${context.slug}: ${lens.slug} is not evidence-reviewed.`);
    return { ...lens, bias, review };
  });
  const canonicalUrl = `${SITE}/practice/${context.slug}/`;
  const scenarios = lenses.map((lens, index) => {
    const options = optionsFor(lenses, index).map((option) => ({
      slug: option.slug,
      title: titleOf(option.bias),
      canonicalUrl: `${SITE}/biases/${option.slug}/`
    }));
    return {
      scenarioId: `${context.slug}-${index + 1}`,
      prompt: `In ${context.title.toLowerCase()}, which lens does this check belong to: “${lens.question}”`,
      answerSlug: lens.slug,
      answerTitle: titleOf(lens.bias),
      question: lens.question,
      evidenceStatus: lens.review.evidenceStatus,
      qualification: lens.review.qualification,
      canonicalBiasUrl: `${SITE}/biases/${lens.slug}/`,
      evidenceUrl: `${SITE}/biases/${lens.slug}/#evidence`,
      options
    };
  });
  practiceSets.push({
    slug: context.slug,
    title: context.title,
    summary: context.summary,
    contextSlug: context.slug,
    contextUrl: `${SITE}/contexts/${context.slug}/`,
    canonicalUrl,
    scenarioCount: scenarios.length,
    scenarios
  });

  const exercises = scenarios.map((scenario, index) => `<article class="practice-card" id="${escapeHtml(scenario.scenarioId)}"><p class="practice-card__number">Exercise ${index + 1} of ${scenarios.length}</p><h2>${escapeHtml(scenario.prompt)}</h2><ol class="practice-options">${scenario.options.map((option) => `<li><a href="/biases/${option.slug}/">${escapeHtml(option.title)}</a></li>`).join("")}</ol><details class="practice-answer"><summary>Show the best first lens</summary><div><p><strong>${escapeHtml(scenario.answerTitle)}</strong></p><p>${escapeHtml(scenario.question)}</p><p><span class="evidence-label">Evidence note</span> ${escapeHtml(scenario.qualification)}</p><p><a href="/biases/${scenario.answerSlug}/#evidence">Read the evidence review</a> · <a href="/contexts/${context.slug}/">Open the decision guide</a></p></div></details></article>`).join("");
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LearningResource",
        "@id": `${canonicalUrl}#resource`,
        url: canonicalUrl,
        name: `${context.title} practice`,
        description: `Practice choosing evidence-reviewed cognitive-bias lenses for ${context.title.toLowerCase()}.`,
        learningResourceType: "Practice exercise",
        inLanguage: "en",
        isPartOf: { "@type": "LearningResource", name: context.title, url: `${SITE}/contexts/${context.slug}/` },
        about: lenses.map(({ bias }) => ({ "@type": "DefinedTerm", name: titleOf(bias), url: `${SITE}/biases/${bias.slug}/` }))
      },
      {
        "@type": "ItemList",
        numberOfItems: scenarios.length,
        itemListElement: scenarios.map((scenario, index) => ({ "@type": "ListItem", position: index + 1, name: scenario.prompt, url: `${canonicalUrl}#${scenario.scenarioId}` }))
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Practice", item: `${SITE}/practice/` },
          { "@type": "ListItem", position: 3, name: context.title, item: canonicalUrl }
        ]
      }
    ]
  };
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>Practice: ${escapeHtml(context.title)} | Cognitive Biases</title><meta name="description" content="Practice ${scenarios.length} evidence-reviewed cognitive-bias lenses for ${escapeHtml(context.title.toLowerCase())} with short questions, answers and source links."><link rel="canonical" href="${canonicalUrl}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="Practice: ${escapeHtml(context.title)}"><meta property="og:description" content="Short evidence-linked exercises for ${escapeHtml(context.title.toLowerCase())}."><meta property="og:url" content="${canonicalUrl}"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip" href="#main">Skip to content</a>${header("practice")}<main id="main"><section class="page-hero"><p class="eyebrow">Practice Lab</p><h1>${escapeHtml(context.title)}</h1><p class="lede">Learn to connect a practical check with the evidence-reviewed lens behind it. A real situation can involve several patterns, so each exercise asks for the best first lens among the listed options, not a diagnosis.</p></section><section class="section practice-intro"><p class="kicker">How to use this set</p><h2>Read the check. Choose a lens. Then inspect the evidence.</h2><p>${escapeHtml(context.summary)}</p><p><a href="/contexts/${context.slug}/">Read the full decision guide</a> before or after the set.</p></section><section class="section"><div class="practice-list">${exercises}</div></section></main>${footer()}</body></html>`;
  const target = join(OUT, "practice", context.slug, "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}

const hubCanonical = `${SITE}/practice/`;
const hubCards = practiceSets.map((set) => `<article class="practice-set-card"><p class="kicker">${set.scenarioCount} exercises</p><h2><a href="/practice/${set.slug}/">${escapeHtml(set.title)}</a></h2><p>${escapeHtml(set.summary)}</p><p><a href="/practice/${set.slug}/">Start practice →</a></p></article>`).join("");
const hubSchema = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "CollectionPage", "@id": `${hubCanonical}#page`, url: hubCanonical, name: "Practice Lab | Cognitive Biases", description: "Short evidence-linked exercises for learning cognitive-bias lenses in real decision contexts." },
    { "@type": "ItemList", numberOfItems: practiceSets.length, itemListElement: practiceSets.map((set, index) => ({ "@type": "ListItem", position: index + 1, name: set.title, url: set.canonicalUrl })) }
  ]
};
const hubHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>Practice Lab | Cognitive Biases</title><meta name="description" content="Practice recognizing evidence-reviewed cognitive-bias lenses with short exercises organized around real decision contexts."><link rel="canonical" href="${hubCanonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="Practice Lab | Cognitive Biases"><meta property="og:description" content="Short evidence-linked exercises for better decisions."><meta property="og:url" content="${hubCanonical}"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(hubSchema)}</script></head><body><a class="skip" href="#main">Skip to content</a>${header("practice")}<main id="main"><section class="page-hero"><p class="eyebrow">Practice Lab</p><h1>Train the question, not the label.</h1><p class="lede">Definitions are easy to recognize after you have seen the answer. These sets practice a harder step: choosing which evidence-reviewed lens gives you the most useful first question in a real decision context.</p></section><section class="section"><p class="kicker">Practice sets</p><h2>${practiceSets.length} contexts, ${practiceSets.reduce((sum, set) => sum + set.scenarioCount, 0)} evidence-linked exercises.</h2><div class="practice-set-grid">${hubCards}</div></section><section class="section section--ink"><p class="kicker">What this is not</p><h2>Not a personality test. Not a diagnosis.</h2><p class="lede">Several cognitive patterns can fit the same situation. The goal is to learn useful questions and then inspect the evidence behind them.</p></section></main>${footer()}</body></html>`;
await mkdir(join(OUT, "practice"), { recursive: true });
await writeFile(join(OUT, "practice", "index.html"), hubHtml);

await mkdir(DATA_OUT, { recursive: true });
await writeFile(join(DATA_OUT, "practice-sets.json"), `${JSON.stringify({ schemaVersion: release.schemaVersion, releaseVersion: release.releaseVersion, updatedAt: release.releaseDate, sets: practiceSets }, null, 2)}\n`);

for (const set of practiceSets) {
  const contextPath = join(OUT, "contexts", set.contextSlug, "index.html");
  let contextHtml = await readFile(contextPath, "utf8");
  if (!contextHtml.includes(`/practice/${set.slug}/`)) {
    contextHtml = contextHtml.replace("</main>", `<section class="section practice-cta"><p class="kicker">Practice this context</p><h2>Can you match the question to the lens?</h2><p><a class="button" href="/practice/${set.slug}/">Open ${set.scenarioCount} practice exercises</a></p></section></main>`);
    await writeFile(contextPath, contextHtml);
  }
  for (const scenario of set.scenarios) {
    const biasPath = join(OUT, "biases", scenario.answerSlug, "index.html");
    let biasHtml = await readFile(biasPath, "utf8");
    if (!biasHtml.includes(`/practice/${set.slug}/`)) {
      const teaser = `<aside class="practice-teaser"><span>Practice</span><a href="/practice/${set.slug}/">Test this lens in ${escapeHtml(set.title)} →</a></aside>`;
      const marker = '<section class="related">';
      biasHtml = biasHtml.includes(marker) ? biasHtml.replace(marker, `${teaser}${marker}`) : biasHtml.replace("</main>", `${teaser}</main>`);
      await writeFile(biasPath, biasHtml);
    }
  }
}

const homepagePath = join(OUT, "index.html");
let homepage = await readFile(homepagePath, "utf8");
if (!homepage.includes('href="/practice/"')) {
  const featured = practiceSets.slice(0, 3).map((set) => `<article><h3><a href="/practice/${set.slug}/">${escapeHtml(set.title)}</a></h3><p>${set.scenarioCount} short exercises with evidence links.</p></article>`).join("");
  homepage = homepage.replace("</main>", `<section class="section practice-home"><p class="kicker">Practice Lab</p><h2>Knowing the name is not the same as spotting the question.</h2><p class="lede">Practice matching decision checks to evidence-reviewed cognitive-bias lenses.</p><div class="practice-home-grid">${featured}</div><p><a class="button" href="/practice/">Open Practice Lab</a></p></section></main>`);
  await writeFile(homepagePath, homepage);
}

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".practice-set-grid{")) {
  styles += `\n.practice-set-grid,.practice-home-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-left:var(--line);border-top:var(--line);margin-top:1.5rem}.practice-set-card,.practice-home-grid article{padding:1.2rem;border-right:var(--line);border-bottom:var(--line);background:#fff}.practice-set-card h2,.practice-home-grid h3{font:1.2rem/1.08 Archivo Black,sans-serif;letter-spacing:-.04em;margin:.35rem 0}.practice-list{display:grid;gap:1.3rem;max-width:950px;margin:0 auto}.practice-card{border:var(--line);background:#fff;padding:1.3rem;box-shadow:6px 6px 0 var(--ink)}.practice-card__number{font-size:.75rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#5a6475}.practice-card h2{font:1.25rem/1.2 Archivo Black,sans-serif;letter-spacing:-.035em}.practice-options{display:grid;gap:.55rem;padding-left:1.4rem}.practice-options a{font-weight:800}.practice-answer{margin-top:1rem;border-top:2px solid var(--ink);padding-top:.8rem}.practice-answer summary{cursor:pointer;font-weight:900}.practice-answer>div{margin-top:.8rem;padding:.9rem;background:var(--paper);border:2px solid var(--ink)}.evidence-label,.practice-teaser>span{display:inline-block;font-size:.72rem;font-weight:900;text-transform:uppercase;background:var(--yellow);border:2px solid var(--ink);padding:.18rem .4rem}.practice-teaser{display:flex;gap:.7rem;align-items:center;flex-wrap:wrap;margin:1.4rem 0;padding:.7rem .9rem;border:2px solid var(--ink);background:#fff}.practice-teaser a{font-weight:900}.practice-cta{background:var(--cyan)}@media(max-width:900px){.practice-set-grid,.practice-home-grid{grid-template-columns:1fr}}\n`;
  await writeFile(stylesPath, styles);
}

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
for (const url of [hubCanonical, ...practiceSets.map((set) => set.canonicalUrl)]) {
  if (!sitemap.includes(`<loc>${url}</loc>`)) sitemap = sitemap.replace("</urlset>", `  <url><loc>${url}</loc></url>\n</urlset>`);
}
await writeFile(sitemapPath, sitemap);

console.log(`Practice Lab generated: ${practiceSets.length} sets, ${practiceSets.reduce((sum, set) => sum + set.scenarioCount, 0)} exercises.`);
