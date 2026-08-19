import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const DATA_OUT = join(OUT, "data");

const skillsDoc = JSON.parse(await readFile("data/skills.json", "utf8"));
const contextsDoc = JSON.parse(await readFile("data/contexts.json", "utf8"));
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const duplicates = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const release = JSON.parse(await readFile("data/release.json", "utf8"));

const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const byBiasSlug = new Map(biases.map((bias) => [bias.slug, bias]));
const byContextSlug = new Map((contextsDoc.entries || []).map((context) => [context.slug, context]));
const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const evidenceBySlug = new Map(evidenceDocs.flatMap((document) => document.reviews || []).map((review) => [review.slug, review]));

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const titleOf = (bias) => String(bias?.title || bias?.name || bias?.slug || "Untitled concept").split(" – ")[0].trim();

function brand(size, alt) {
  return `<picture class="brand-picture"><source type="image/webp" srcset="/assets/brand.webp"><img src="/assets/biases_icon.png" width="${size}" height="${size}" alt="${escapeHtml(alt)}"></picture>`;
}

function header(current = "") {
  const link = (href, label, key) => `<a href="${href}"${current === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<header class="site-header"><a class="brand" href="/">${brand(48, "Cognitive Biases icon")}<span>Cognitive<br>Biases</span></a><nav aria-label="Primary">${link("/explore/", "Explore", "explore")}${link("/contexts/", "Decision guides", "contexts")}${link("/skills/", "Skills", "skills")}${link("/practice/", "Practice", "practice")}${link("/evidence/", "Evidence", "evidence")}${link("/research/", "Research", "research")}${link("/data/", "Data", "data")}</nav></header>`;
}

function footer() {
  return `<footer class="site-footer"><div><a class="brand brand--footer" href="/">${brand(40, "")}<span>Cognitive Biases</span></a><p>A public guide to cognitive biases, evidence and better decisions.</p></div><div class="footer-links"><a href="/skills/">Decision skills</a><a href="/practice/">Practice Lab</a><a href="/contexts/">Decision guides</a><a href="/methodology/">Methodology</a><a href="/quality/">Quality status</a><a href="/data/">Data</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p></footer>`;
}

function list(items) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

const slugs = new Set();
const resolvedSkills = [];
for (const skill of skillsDoc.entries || []) {
  if (!skill.slug || slugs.has(skill.slug)) throw new Error(`Invalid or duplicate skill slug: ${skill.slug || "<missing>"}`);
  slugs.add(skill.slug);
  if (!skill.title || !skill.summary || !skill.outcome) throw new Error(`${skill.slug}: title, summary and outcome are required.`);
  if (!Array.isArray(skill.whenToUse) || skill.whenToUse.length < 2) throw new Error(`${skill.slug}: add at least two whenToUse items.`);
  if (!Array.isArray(skill.actions) || skill.actions.length < 2) throw new Error(`${skill.slug}: add at least two actions.`);
  if (!Array.isArray(skill.contexts) || skill.contexts.length === 0) throw new Error(`${skill.slug}: at least one context is required.`);
  if (!Array.isArray(skill.biases) || skill.biases.length < 2) throw new Error(`${skill.slug}: at least two reviewed bias lenses are required.`);

  const contexts = skill.contexts.map((slug) => {
    const context = byContextSlug.get(slug);
    if (!context) throw new Error(`${skill.slug}: unknown context ${slug}.`);
    return {
      slug,
      title: context.title,
      summary: context.summary,
      url: `${SITE}/contexts/${slug}/`,
      practiceUrl: `${SITE}/practice/${slug}/`
    };
  });

  const lenses = skill.biases.map((slug) => {
    const bias = byBiasSlug.get(slug);
    if (!bias || duplicateIds.has(bias.id)) throw new Error(`${skill.slug}: ${slug} is not a published canonical bias.`);
    const review = evidenceBySlug.get(slug);
    if (!review) throw new Error(`${skill.slug}: ${slug} is not evidence-reviewed.`);
    return {
      slug,
      title: titleOf(bias),
      url: `${SITE}/biases/${slug}/`,
      evidenceUrl: `${SITE}/biases/${slug}/#evidence`,
      evidenceStatus: review.evidenceStatus,
      qualification: review.qualification
    };
  });

  resolvedSkills.push({ ...skill, contexts, lenses, canonicalUrl: `${SITE}/skills/${skill.slug}/` });
}

for (const skill of resolvedSkills) {
  const canonicalUrl = skill.canonicalUrl;
  const contextCards = skill.contexts.map((context) => `<article class="practice-set-card"><p class="kicker">Decision context</p><h3><a href="/contexts/${context.slug}/">${escapeHtml(context.title)}</a></h3><p>${escapeHtml(context.summary)}</p><p><a href="/practice/${context.slug}/">Practice this context →</a></p></article>`).join("");
  const lensCards = skill.lenses.map((lens) => `<article class="practice-card"><h3><a href="/biases/${lens.slug}/">${escapeHtml(lens.title)}</a></h3><p>${escapeHtml(lens.qualification)}</p><p><span class="evidence-label">${escapeHtml(lens.evidenceStatus)}</span> <a href="/biases/${lens.slug}/#evidence">Read evidence review</a></p></article>`).join("");
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LearningResource",
        "@id": `${canonicalUrl}#resource`,
        url: canonicalUrl,
        name: skill.title,
        description: skill.summary,
        learningResourceType: "Decision skill guide",
        educationalUse: "Practice",
        inLanguage: "en",
        teaches: skill.outcome,
        about: skill.lenses.map((lens) => ({ "@type": "DefinedTerm", name: lens.title, url: lens.url }))
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Skills", item: `${SITE}/skills/` },
          { "@type": "ListItem", position: 3, name: skill.title, item: canonicalUrl }
        ]
      }
    ]
  };
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${escapeHtml(skill.title)} | Decision Skills | Cognitive Biases</title><meta name="description" content="${escapeHtml(skill.summary)}"><link rel="canonical" href="${canonicalUrl}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="${escapeHtml(skill.title)} | Decision Skills"><meta property="og:description" content="${escapeHtml(skill.summary)}"><meta property="og:url" content="${canonicalUrl}"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip" href="#main">Skip to content</a>${header("skills")}<main id="main"><section class="page-hero"><p class="eyebrow">Decision skill</p><h1>${escapeHtml(skill.title)}</h1><p class="lede">${escapeHtml(skill.summary)}</p><p><strong>Learning outcome:</strong> ${escapeHtml(skill.outcome)}</p></section><section class="section"><p class="kicker">When it matters</p><h2>Notice the situation before naming the bias.</h2>${list(skill.whenToUse)}</section><section class="section section--ink"><p class="kicker">Practice the skill</p><h2>Use a better reasoning move.</h2>${list(skill.actions)}</section><section class="section"><p class="kicker">Decision contexts</p><h2>Apply the skill to real kinds of decisions.</h2><div class="practice-set-grid">${contextCards}</div></section><section class="section"><p class="kicker">Evidence-reviewed lenses</p><h2>Patterns worth checking, not labels for people.</h2><p class="lede">Several patterns can fit the same situation. Use these lenses to ask better questions, then inspect the evidence behind each concept.</p><div class="practice-list">${lensCards}</div></section></main>${footer()}</body></html>`;
  const target = join(OUT, "skills", skill.slug, "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}

const hubCanonical = `${SITE}/skills/`;
const hubCards = resolvedSkills.map((skill) => `<article class="practice-set-card"><p class="kicker">${skill.lenses.length} reviewed lenses · ${skill.contexts.length} contexts</p><h2><a href="/skills/${skill.slug}/">${escapeHtml(skill.title)}</a></h2><p>${escapeHtml(skill.summary)}</p><p><strong>Outcome:</strong> ${escapeHtml(skill.outcome)}</p><p><a href="/skills/${skill.slug}/">Build this skill →</a></p></article>`).join("");
const hubSchema = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "CollectionPage", "@id": `${hubCanonical}#page`, url: hubCanonical, name: "Decision Skills | Cognitive Biases", description: "Practical skills for evaluating evidence, forecasting, reasoning under uncertainty and using AI more carefully." },
    { "@type": "ItemList", numberOfItems: resolvedSkills.length, itemListElement: resolvedSkills.map((skill, index) => ({ "@type": "ListItem", position: index + 1, name: skill.title, url: skill.canonicalUrl })) }
  ]
};
const hubHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>Decision Skills | Cognitive Biases</title><meta name="description" content="Build practical skills for evaluating evidence, forecasting, reasoning under uncertainty and using AI more carefully."><link rel="canonical" href="${hubCanonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="Decision Skills | Cognitive Biases"><meta property="og:description" content="Train better reasoning with evidence-linked skills, contexts and practice."><meta property="og:url" content="${hubCanonical}"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(hubSchema)}</script></head><body><a class="skip" href="#main">Skip to content</a>${header("skills")}<main id="main"><section class="page-hero"><p class="eyebrow">Decision Skills</p><h1>Learn what to do, not only what the bias is called.</h1><p class="lede">Bias names are useful vocabulary. Skills are what help when a real decision arrives. These guides connect reviewed cognitive-bias lenses with practical questions, actions, contexts and exercises.</p></section><section class="section"><p class="kicker">Skill library</p><h2>${resolvedSkills.length} practical skills built on reviewed material.</h2><div class="practice-set-grid">${hubCards}</div></section><section class="section section--ink"><p class="kicker">How to use this</p><h2>Start with the task you need to do better.</h2><p class="lede">Choose a skill, open a decision context, try the practice set, then inspect the evidence behind the lenses that mattered. The goal is not to diagnose yourself or someone else. It is to improve the next reasoning move.</p></section></main>${footer()}</body></html>`;
await mkdir(join(OUT, "skills"), { recursive: true });
await writeFile(join(OUT, "skills", "index.html"), hubHtml);

await mkdir(DATA_OUT, { recursive: true });
await writeFile(join(DATA_OUT, "skills.json"), `${JSON.stringify({ schemaVersion: release.schemaVersion, releaseVersion: release.releaseVersion, updatedAt: release.releaseDate, skills: resolvedSkills }, null, 2)}\n`);

for (const skill of resolvedSkills) {
  for (const context of skill.contexts) {
    const contextPath = join(OUT, "contexts", context.slug, "index.html");
    let html = await readFile(contextPath, "utf8");
    const skillUrl = `/skills/${skill.slug}/`;
    if (!html.includes(skillUrl)) {
      html = html.replace("</main>", `<aside class="practice-teaser"><span>Decision skill</span><a href="${skillUrl}">${escapeHtml(skill.title)} →</a></aside></main>`);
      await writeFile(contextPath, html);
    }
  }
  for (const lens of skill.lenses) {
    const biasPath = join(OUT, "biases", lens.slug, "index.html");
    let html = await readFile(biasPath, "utf8");
    const skillUrl = `/skills/${skill.slug}/`;
    if (!html.includes(skillUrl)) {
      const teaser = `<aside class="practice-teaser"><span>Build the skill</span><a href="${skillUrl}">${escapeHtml(skill.title)} →</a></aside>`;
      html = html.replace("</main>", `${teaser}</main>`);
      await writeFile(biasPath, html);
    }
  }
}

const homepagePath = join(OUT, "index.html");
let homepage = await readFile(homepagePath, "utf8");
if (!homepage.includes('href="/skills/"')) {
  const featured = resolvedSkills.slice(0, 3).map((skill) => `<article><h3><a href="/skills/${skill.slug}/">${escapeHtml(skill.title)}</a></h3><p>${escapeHtml(skill.summary)}</p></article>`).join("");
  homepage = homepage.replace("</main>", `<section class="section"><p class="kicker">Decision Skills</p><h2>Knowing a bias name is not the same as making a better decision.</h2><p class="lede">Build practical skills that connect evidence, decision contexts and short exercises.</p><div class="practice-home-grid">${featured}</div><p><a class="button" href="/skills/">Explore decision skills</a></p></section></main>`);
  await writeFile(homepagePath, homepage);
}

const practiceHubPath = join(OUT, "practice", "index.html");
let practiceHub = await readFile(practiceHubPath, "utf8");
if (!practiceHub.includes('href="/skills/"')) {
  practiceHub = practiceHub.replace("</main>", `<section class="section"><p class="kicker">Practice by skill</p><h2>Choose what you want to get better at.</h2><p class="lede">The same exercises can be approached through a decision context or through the skill they develop.</p><p><a class="button" href="/skills/">Browse decision skills</a></p></section></main>`);
  await writeFile(practiceHubPath, practiceHub);
}
