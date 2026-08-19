import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const DATA_OUT = join(OUT, "data");

const experimentData = JSON.parse(await readFile("data/experiments.json", "utf8"));
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const contexts = JSON.parse(await readFile("data/contexts.json", "utf8"));
const everyday = JSON.parse(await readFile("data/everyday-guides.json", "utf8"));
const duplicates = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
const contextBySlug = new Map((contexts.entries || []).map((context) => [context.slug, context]));
const everydayBySlug = new Map((everyday.entries || []).map((guide) => [guide.slug, guide]));
const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const evidenceReviews = evidenceDocs.flatMap((document) => document.reviews || []);
const evidenceBySlug = new Map(evidenceReviews.map((review) => [review.slug, review]));

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character]);
const titleOf = (bias) => String(bias?.title || bias?.name || bias?.slug || "Untitled concept").split(/\s+[–—]\s+/)[0].trim();

function brand(size, alt) {
  return `<picture class="brand-picture"><source type="image/webp" srcset="/assets/brand.webp"><img src="/assets/biases_icon.png" width="${size}" height="${size}" alt="${escapeHtml(alt)}"></picture>`;
}

function header() {
  return `<header class="site-header"><a class="brand" href="/">${brand(48, "Cognitive Biases icon")}<span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/everyday/">Everyday life</a><a href="/explore/">Explore</a><a href="/contexts/">Decision guides</a><a href="/practice/">Practice</a><a href="/research/">Research</a><a class="nav-cta" href="/data/">Data</a></nav></header>`;
}

function footer() {
  return `<footer class="site-footer"><div><a class="brand brand--footer" href="/">${brand(40, "")}<span>Cognitive Biases</span></a><p>A public guide to cognitive biases, evidence and better decisions.</p></div><div class="footer-links"><a href="/experiments/">Experiments Lab</a><a href="/everyday/">Everyday life</a><a href="/practice/">Practice Lab</a><a href="/contexts/">Decision guides</a><a href="/research/">Research</a><a href="/data/">Data</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p></footer>`;
}

function schemaForExperiment(experiment, bias) {
  const canonical = `${SITE}/experiments/${experiment.slug}/`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LearningResource",
        "@id": `${canonical}#resource`,
        url: canonical,
        name: experiment.title,
        description: experiment.summary,
        learningResourceType: "Interactive demonstration",
        educationalUse: "Practice",
        inLanguage: "en",
        dateModified: experimentData.updatedAt,
        about: {
          "@type": "DefinedTerm",
          name: titleOf(bias),
          url: `${SITE}/biases/${bias.slug}/`
        },
        isPartOf: {
          "@type": "CollectionPage",
          name: "Cognitive Bias Experiments Lab",
          url: `${SITE}/experiments/`
        }
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Experiments Lab", item: `${SITE}/experiments/` },
          { "@type": "ListItem", position: 3, name: experiment.title, item: canonical }
        ]
      }
    ]
  };
}

function pageForExperiment(experiment, bias, review, context, everydayGuide) {
  const canonical = `${SITE}/experiments/${experiment.slug}/`;
  const schema = schemaForExperiment(experiment, bias);
  const payload = JSON.stringify({
    slug: experiment.slug,
    title: experiment.title,
    responseType: experiment.responseType,
    responseLabel: experiment.responseLabel || "",
    conditions: experiment.conditions,
    prediction: experiment.prediction,
    interpretation: experiment.interpretation,
    debias: experiment.debias
  }).replaceAll("<", "\\u003c");
  const contextLink = context ? `<a href="/contexts/${context.slug}/">${escapeHtml(context.title)}</a>` : "";
  const everydayLink = everydayGuide ? `<a href="/everyday/${everydayGuide.slug}/">${escapeHtml(everydayGuide.title)}</a>` : "";
  const deeperLinks = [everydayLink, contextLink].filter(Boolean).join(" · ");
  const noscriptConditions = experiment.conditions.map((condition) => `<article><strong>${escapeHtml(condition.label)}</strong><p>${escapeHtml(condition.prompt)}</p></article>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"><title>${escapeHtml(experiment.title)} | Cognitive Biases</title><meta name="description" content="${escapeHtml(experiment.summary)}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="${escapeHtml(experiment.title)}"><meta property="og:description" content="${escapeHtml(experiment.summary)}"><meta property="og:url" content="${canonical}"><meta name="twitter:card" content="summary"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip" href="#main">Skip to content</a>${header()}<main id="main"><article class="experiment-article"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/experiments/">Experiments Lab</a> / ${escapeHtml(experiment.category)}</nav><p class="eyebrow">${escapeHtml(experiment.category)} · interactive demo</p><h1>${escapeHtml(experiment.title)}</h1><p class="experiment-lede">${escapeHtml(experiment.summary)}</p><section><p class="kicker">Question</p><h2>${escapeHtml(experiment.researchQuestion)}</h2><p>This is an educational demonstration, not a scientific measurement of you. One response cannot show that a bias caused your choice.</p></section><section class="experiment-box" data-experiment><p class="experiment-privacy">Your response stays on this page. Nothing is sent or stored.</p><p class="kicker" data-condition-label>Random condition</p><h2 data-prompt>Loading the scenario…</h2><div data-response></div><button class="button" type="button" data-reveal hidden>Compare the other condition</button><div class="experiment-result" data-result hidden></div></section><noscript><section class="experiment-noscript"><h2>JavaScript is off</h2><p>You can still compare the two conditions manually.</p>${noscriptConditions}</section></noscript><section class="experiment-evidence"><p class="kicker">Evidence-reviewed lens</p><h2><a href="/biases/${bias.slug}/">${escapeHtml(titleOf(bias))}</a></h2><p>${escapeHtml(review.qualification || review.evidenceStatus || "See the evidence review for the current assessment.")}</p><p><a href="/biases/${bias.slug}/#evidence">Read the evidence review →</a></p>${deeperLinks ? `<p>${deeperLinks}</p>` : ""}</section><section class="experiment-caution"><p class="kicker">How to interpret this</p><p>${escapeHtml(experiment.interpretation)}</p><p><strong>Better check:</strong> ${escapeHtml(experiment.debias)}</p></section></article><script type="application/json" id="experiment-definition">${payload}</script><script src="/experiments.js" defer></script></main>${footer()}</body></html>`;
}

const experiments = [];
for (const experiment of experimentData.entries || []) {
  const bias = bySlug.get(experiment.biasSlug);
  if (!bias) throw new Error(`${experiment.slug}: unknown bias ${experiment.biasSlug}`);
  if (duplicateIds.has(bias.id)) throw new Error(`${experiment.slug}: ${experiment.biasSlug} is not canonical`);
  const review = evidenceBySlug.get(experiment.biasSlug);
  if (!review) throw new Error(`${experiment.slug}: ${experiment.biasSlug} is not evidence-reviewed`);
  const context = experiment.contextSlug ? contextBySlug.get(experiment.contextSlug) : null;
  if (experiment.contextSlug && !context) throw new Error(`${experiment.slug}: unknown context ${experiment.contextSlug}`);
  const everydayGuide = experiment.everydaySlug ? everydayBySlug.get(experiment.everydaySlug) : null;
  if (experiment.everydaySlug && !everydayGuide) throw new Error(`${experiment.slug}: unknown everyday guide ${experiment.everydaySlug}`);
  experiments.push({ ...experiment, bias, review, context, everydayGuide });
}

for (const experiment of experiments) {
  const target = join(OUT, "experiments", experiment.slug, "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, pageForExperiment(experiment, experiment.bias, experiment.review, experiment.context, experiment.everydayGuide));
}

const hubCanonical = `${SITE}/experiments/`;
const hubSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": `${hubCanonical}#page`,
      url: hubCanonical,
      name: "Cognitive Bias Experiments Lab",
      description: "Interactive demonstrations of evidence-reviewed cognitive bias effects with private, local-only responses.",
      inLanguage: "en"
    },
    {
      "@type": "ItemList",
      numberOfItems: experiments.length,
      itemListElement: experiments.map((experiment, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: experiment.title,
        url: `${SITE}/experiments/${experiment.slug}/`
      }))
    }
  ]
};
const cards = experiments.map((experiment) => `<article class="experiment-card"><p class="kicker">${escapeHtml(experiment.category)}</p><h2><a href="/experiments/${experiment.slug}/">${escapeHtml(experiment.title)}</a></h2><p>${escapeHtml(experiment.summary)}</p><p><a href="/experiments/${experiment.slug}/">Run the demo →</a></p></article>`).join("");
const hubHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"><title>Cognitive Bias Experiments Lab | Interactive Demos</title><meta name="description" content="Try short interactive demonstrations of anchoring, framing, decoy effects, escalation, outcome bias and the planning fallacy. Responses stay in your browser."><link rel="canonical" href="${hubCanonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="Cognitive Bias Experiments Lab"><meta property="og:description" content="Short evidence-linked demonstrations you can run on yourself without sending data anywhere."><meta property="og:url" content="${hubCanonical}"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(hubSchema)}</script></head><body><a class="skip" href="#main">Skip to content</a>${header()}<main id="main"><section class="page-hero experiment-hub-hero"><p class="eyebrow">Experiments Lab</p><h1>See the manipulation before you memorise the label.</h1><p class="lede">Each demo changes one part of a decision and lets you compare the alternative version after you answer. Your response stays in the browser. We do not treat these demos as scientific measurements or collect them as study data.</p></section><section class="section"><p class="kicker">How it works</p><h2>One question. One changed variable. One evidence trail.</h2><p class="lede">A random condition appears first. Make a quick judgment, then reveal the other version and inspect what changed. The useful lesson is the design of the comparison, not whether one click proves that you are biased.</p><div class="experiment-grid">${cards}</div></section><section class="section section--ink"><p class="kicker">Research foundation</p><h2>These demos are interfaces, not new findings.</h2><p class="lede">Every experiment points to an evidence-reviewed concept. The machine-readable experiment specifications can also be reused later for controlled human studies or AI-model benchmarks.</p><p><a class="button" href="/data/experiments.json">Open experiment data</a></p></section></main>${footer()}</body></html>`;
await mkdir(join(OUT, "experiments"), { recursive: true });
await writeFile(join(OUT, "experiments", "index.html"), hubHtml);

const publicPayload = {
  version: experimentData.version,
  updatedAt: experimentData.updatedAt,
  description: experimentData.description,
  canonicalUrl: `${SITE}/experiments/`,
  privacy: "Responses are not transmitted or persisted by the static experiment pages.",
  experiments: experiments.map((experiment) => ({
    slug: experiment.slug,
    title: experiment.title,
    category: experiment.category,
    summary: experiment.summary,
    researchQuestion: experiment.researchQuestion,
    responseType: experiment.responseType,
    responseLabel: experiment.responseLabel || null,
    conditions: experiment.conditions,
    prediction: experiment.prediction,
    interpretation: experiment.interpretation,
    debias: experiment.debias,
    canonicalUrl: `${SITE}/experiments/${experiment.slug}/`,
    bias: {
      slug: experiment.bias.slug,
      title: titleOf(experiment.bias),
      canonicalUrl: `${SITE}/biases/${experiment.bias.slug}/`,
      evidenceUrl: `${SITE}/biases/${experiment.bias.slug}/#evidence`,
      evidenceStatus: experiment.review.evidenceStatus,
      qualification: experiment.review.qualification
    },
    context: experiment.context ? {
      slug: experiment.context.slug,
      title: experiment.context.title,
      canonicalUrl: `${SITE}/contexts/${experiment.context.slug}/`
    } : null,
    everyday: experiment.everydayGuide ? {
      slug: experiment.everydayGuide.slug,
      title: experiment.everydayGuide.title,
      canonicalUrl: `${SITE}/everyday/${experiment.everydayGuide.slug}/`
    } : null
  }))
};
await mkdir(DATA_OUT, { recursive: true });
await writeFile(join(DATA_OUT, "experiments.json"), `${JSON.stringify(publicPayload, null, 2)}\n`);

const script = `(() => {
  const root = document.querySelector('[data-experiment]');
  const source = document.getElementById('experiment-definition');
  if (!root || !source) return;
  const definition = JSON.parse(source.textContent);
  const firstIndex = Math.random() < 0.5 ? 0 : 1;
  const first = definition.conditions[firstIndex];
  const other = definition.conditions[firstIndex === 0 ? 1 : 0];
  const label = root.querySelector('[data-condition-label]');
  const prompt = root.querySelector('[data-prompt]');
  const response = root.querySelector('[data-response]');
  const reveal = root.querySelector('[data-reveal]');
  const result = root.querySelector('[data-result]');
  label.textContent = first.label;
  prompt.textContent = first.prompt;
  const finish = (answer) => {
    root.dataset.answered = 'true';
    response.querySelectorAll('button,input').forEach((element) => { element.disabled = true; });
    const note = document.createElement('p');
    note.className = 'experiment-answer-note';
    note.textContent = 'Your answer: ' + answer + '. It stays only on this page.';
    response.append(note);
    reveal.hidden = false;
  };
  if (definition.responseType === 'choice') {
    const wrap = document.createElement('div');
    wrap.className = 'experiment-options';
    for (const option of first.options || []) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = option;
      button.addEventListener('click', () => finish(option), { once: true });
      wrap.append(button);
    }
    response.append(wrap);
  } else if (definition.responseType === 'rating') {
    const text = document.createElement('p');
    text.className = 'experiment-response-label';
    text.textContent = definition.responseLabel;
    const wrap = document.createElement('div');
    wrap.className = 'experiment-rating';
    for (let value = 1; value <= 7; value += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = String(value);
      button.setAttribute('aria-label', 'Rating ' + value + ' of 7');
      button.addEventListener('click', () => finish(value + '/7'), { once: true });
      wrap.append(button);
    }
    response.append(text, wrap);
  } else {
    const form = document.createElement('form');
    form.className = 'experiment-number';
    const labelEl = document.createElement('label');
    labelEl.textContent = definition.responseLabel || 'Your estimate';
    const input = document.createElement('input');
    input.type = 'number';
    input.required = true;
    input.step = 'any';
    input.inputMode = 'decimal';
    const button = document.createElement('button');
    button.type = 'submit';
    button.className = 'button';
    button.textContent = 'Lock my estimate';
    labelEl.append(input);
    form.append(labelEl, button);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!input.value) return;
      finish(input.value);
    }, { once: true });
    response.append(form);
  }
  reveal.addEventListener('click', () => {
    reveal.hidden = true;
    result.hidden = false;
    const options = other.options?.length ? '<ul>' + other.options.map((option) => '<li>' + escapeHtml(option) + '</li>').join('') + '</ul>' : '';
    result.innerHTML = '<p class="kicker">Other condition</p><h3>' + escapeHtml(other.label) + '</h3><p>' + escapeHtml(other.prompt) + '</p>' + options + '<p><strong>What studies predict:</strong> ' + escapeHtml(definition.prediction) + '</p><p><strong>What to notice:</strong> ' + escapeHtml(definition.interpretation) + '</p><p><strong>Better check:</strong> ' + escapeHtml(definition.debias) + '</p>';
  }, { once: true });
  function escapeHtml(value) {
    const element = document.createElement('span');
    element.textContent = String(value);
    return element.innerHTML;
  }
})();`;
await writeFile(join(OUT, "experiments.js"), script);

const byBias = new Map();
for (const experiment of experiments) {
  const rows = byBias.get(experiment.biasSlug) || [];
  rows.push(experiment);
  byBias.set(experiment.biasSlug, rows);
}
for (const [biasSlug, rows] of byBias) {
  const path = join(OUT, "biases", biasSlug, "index.html");
  let html = await readFile(path, "utf8");
  if (!html.includes('class="experiment-teaser"')) {
    const links = rows.map((experiment) => `<li><a href="/experiments/${experiment.slug}/">${escapeHtml(experiment.title)}</a></li>`).join("");
    const teaser = `<aside class="experiment-teaser"><span>Experiment</span><strong>Try the manipulation yourself</strong><ul>${links}</ul></aside>`;
    const marker = '<section class="related">';
    html = html.includes(marker) ? html.replace(marker, `${teaser}${marker}`) : html.replace("</main>", `${teaser}</main>`);
    await writeFile(path, html);
  }
}

async function insertSection(path, marker, section) {
  let html = await readFile(path, "utf8");
  if (!html.includes(marker)) {
    html = html.replace("</main>", `${section}</main>`);
    await writeFile(path, html);
  }
}
const featured = experiments.slice(0, 3).map((experiment) => `<article><p class="kicker">${escapeHtml(experiment.category)}</p><h3><a href="/experiments/${experiment.slug}/">${escapeHtml(experiment.title)}</a></h3><p>${escapeHtml(experiment.summary)}</p></article>`).join("");
await insertSection(join(OUT, "index.html"), 'class="experiment-home"', `<section class="section experiment-home"><p class="kicker">Experiments Lab</p><h2>Change one detail. See whether the judgment moves.</h2><p class="lede">Run short, private demonstrations of anchoring, framing, choice architecture and decision review. Nothing is uploaded.</p><div class="experiment-home-grid">${featured}</div><p><a class="button" href="/experiments/">Open Experiments Lab</a></p></section>`);
await insertSection(join(OUT, "research", "index.html"), 'class="experiment-research-link"', `<section class="experiment-research-link"><h2>Interactive experiment specifications</h2><p>Use the <a href="/experiments/">Experiments Lab</a> to inspect paired conditions built from evidence-reviewed concepts. The current pages are educational demos; the public specifications can support later controlled studies and AI benchmarks.</p></section>`);
await insertSection(join(OUT, "practice", "index.html"), 'class="experiment-practice-link"', `<section class="section experiment-practice-link"><p class="kicker">Experiments Lab</p><h2>Practice recognition, then inspect the manipulation.</h2><p class="lede">Practice asks which lens fits. Experiments change one variable and let you compare the alternative condition.</p><p><a class="button" href="/experiments/">Try interactive demos</a></p></section>`);

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
for (const path of ["/experiments/", ...experiments.map((experiment) => `/experiments/${experiment.slug}/`)]) {
  const url = `${SITE}${path}`;
  if (!sitemap.includes(`<loc>${url}</loc>`)) {
    sitemap = sitemap.replace("</urlset>", `<url><loc>${url}</loc><lastmod>${experimentData.updatedAt}</lastmod></url></urlset>`);
  }
}
await writeFile(sitemapPath, sitemap);

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".experiment-grid{")) {
  styles += `
.experiment-grid,.experiment-home-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-left:var(--line);border-top:var(--line);margin-top:2rem}
.experiment-card,.experiment-home-grid article{padding:1.4rem;border-right:var(--line);border-bottom:var(--line);background:#fff}
.experiment-card h2,.experiment-home-grid h3{font:1.25rem/1.15 Archivo Black,sans-serif;letter-spacing:-.04em;margin:.45rem 0 .8rem}
.experiment-card a,.experiment-home-grid h3 a{text-decoration:none}
.experiment-card a:hover,.experiment-home-grid h3 a:hover{text-decoration:underline}
.experiment-article{max-width:900px;margin:0 auto;padding:4rem 6vw 6rem}
.experiment-article h1{font:clamp(2.8rem,6vw,5.4rem)/.94 Archivo Black,sans-serif;letter-spacing:-.07em;margin:.7rem 0 1.4rem}
.experiment-article h2{font:1.65rem/1.08 Archivo Black,sans-serif;letter-spacing:-.04em;margin-top:2.4rem}
.experiment-lede{font-size:1.25rem;font-weight:800}
.experiment-box{border:var(--line);padding:1.5rem;margin:2.4rem 0;background:#fff;box-shadow:9px 9px 0 var(--cyan)}
.experiment-privacy{font-size:.9rem;font-weight:800}
.experiment-options,.experiment-rating{display:flex;gap:.7rem;flex-wrap:wrap;margin:1.2rem 0}
.experiment-options button,.experiment-rating button{border:var(--line);background:#fff;padding:.7rem .9rem;font:inherit;font-weight:900;cursor:pointer}
.experiment-options button:hover,.experiment-rating button:hover{background:var(--yellow)}
.experiment-options button:disabled,.experiment-rating button:disabled{cursor:default;opacity:.65}
.experiment-number label{display:grid;gap:.5rem;font-weight:900;max-width:360px}
.experiment-number input{border:var(--line);font:inherit;padding:.65rem;background:#fff}
.experiment-number .button{margin-top:1rem}
.experiment-answer-note{font-weight:900;border-top:var(--line);padding-top:1rem}
.experiment-result{margin-top:1.4rem;border-top:var(--line);padding-top:1rem}
.experiment-result h3{font:1.25rem Archivo Black,sans-serif}
.experiment-evidence,.experiment-caution,.experiment-noscript{border:var(--line);padding:1.4rem;margin:2rem 0;background:#fff}
.experiment-caution{background:var(--yellow)}
.experiment-teaser{border:var(--line);padding:1.2rem;margin:2rem 0;background:#fff}
.experiment-teaser>span{display:block;color:var(--pink);font-weight:900;text-transform:uppercase;font-size:.78rem;letter-spacing:.08em}
.experiment-teaser>strong{display:block;font:1.15rem Archivo Black,sans-serif;margin:.35rem 0}
.experiment-teaser ul{margin:.8rem 0 0;padding-left:1.2rem}
@media(max-width:900px){.experiment-grid,.experiment-home-grid{grid-template-columns:1fr 1fr}}
@media(max-width:760px){.experiment-grid,.experiment-home-grid{grid-template-columns:1fr}.experiment-article{padding-top:3rem}}
`;
  await writeFile(stylesPath, styles);
}

console.log(`Generated ${experiments.length} experiment demos, public specs and ${byBias.size} evidence-linked bias cross-links.`);
