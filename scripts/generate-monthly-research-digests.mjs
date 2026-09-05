import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const data = JSON.parse(await readFile("data/monthly-research-digests.json", "utf8"));
const digests = [...(data.digests || [])].sort((a, b) => String(b.slug).localeCompare(String(a.slug)));

const escape = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character]);

const header = () => `<header class="site-header"><a class="brand" href="/"><img src="/assets/icon2.png" width="48" height="48" alt="Cognitive Biases cat icon"><span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/explore/">Explore</a><a href="/tools/decision-audit/">Decision Audit</a><a href="/evidence/">Evidence</a><a href="/research/">Research</a><a href="/data/">Data</a><a href="/about/">About</a></nav></header>`;
const footer = () => `<footer class="site-footer"><div><a class="brand brand--footer" href="/"><img src="/assets/icon2.png" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p>A public guide to cognitive biases, evidence and better decisions.</p></div><div class="footer-links"><a href="/tools/decision-audit/">Decision Audit</a><a href="/contexts/">Decision contexts</a><a href="/evidence/">Evidence</a><a href="/compare/">Compare</a><a href="/research/">Research</a><a href="/research/changes/">Evidence changes</a><a href="/data/">Data</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p></footer>`;
const list = (items = []) => `<ul>${items.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>`;
const deltaLabel = (value = "") => ({
  strengthens: "Evidence update · strengthens",
  narrows: "Evidence update · narrows",
  "new context": "New context",
  "watch only": "Research watch · not a settled claim"
})[value] || value;
const changeDefinition = {
  strengthens: "A useful new result supports an existing evidence record without making it universal.",
  narrows: "A boundary condition, null result, or competing finding makes an existing claim more precise.",
  "new context": "Evidence moves a known decision problem into a practical setting that deserves explicit guidance."
};

async function emit(path, content) {
  const target = join(OUT, path.replace(/^\//, ""), "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

function digestPage(digest) {
  const path = `/research/digests/${digest.slug}/`;
  const canonical = `${SITE}${path}`;
  const signals = (digest.signals || []).map((signal) => {
    const source = signal.source || {};
    const sourceMeta = [source.publishedAt, signal.sourceStatus].filter(Boolean).join(" · ");
    return `<section class="article-section"><p class="eyebrow">${escape(deltaLabel(signal.delta))} · ${escape(signal.confidence)}</p><h2>${escape(signal.title)}</h2><p><strong>What the study found.</strong> ${escape(signal.finding)}</p><p><strong>Why it matters.</strong> ${escape(signal.whyItMatters)}</p><p><strong>Try this.</strong> ${escape(signal.practicalCheck)}</p><p><strong>What this changes here.</strong> ${escape(signal.siteAction)}</p><p class="fine-print"><a href="${escape(source.url)}" rel="external">${escape(source.title)}</a>${sourceMeta ? ` · ${escape(sourceMeta)}` : ""}${source.doi ? ` · DOI ${escape(source.doi)}` : ""}</p></section>`;
  }).join("");

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: digest.title,
    description: digest.summary,
    datePublished: digest.publishedAt,
    dateModified: digest.publishedAt,
    mainEntityOfPage: canonical,
    author: { "@type": "Organization", name: "Cognitive Biases", url: SITE },
    publisher: { "@type": "Organization", name: "Cognitive Biases", url: SITE }
  }).replace(/</g, "\\u003c");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${escape(digest.title)} | Cognitive Biases</title><meta name="description" content="${escape(digest.summary)}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="article"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="${escape(digest.title)}"><meta property="og:description" content="${escape(digest.summary)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE}/assets/icon2.png"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${jsonLd}</script></head><body><a class="skip" href="#main">Skip to content</a>${header()}<main id="main"><section class="page-hero"><p class="eyebrow">Monthly research digest · ${escape(digest.month)}</p><h1>${escape(digest.title)}</h1><p class="lede">${escape(digest.summary)}</p><p>${escape(digest.editorialNote)}</p></section><article class="article"><h2>What is worth remembering</h2>${list(digest.takeaways)}${signals}<h2>What changed in the project</h2>${list(digest.whatChanged)}<h2>Questions we are carrying forward</h2>${list(digest.nextQuestions)}<p><a class="button" href="/research/digests/">All monthly digests</a> <a href="/research/changes/">Evidence Change Log</a> · <a href="/research/">Research hub</a></p></article></main>${footer()}</body></html>`;
}

function indexPage() {
  const canonical = `${SITE}/research/digests/`;
  const cards = digests.map((digest) => `<article><p class="eyebrow">${escape(digest.month)}</p><strong><a href="/research/digests/${escape(digest.slug)}/">${escape(digest.title)}</a></strong><p>${escape(digest.summary)}</p><p>${(digest.signals || []).length} reviewed signals · evidence changes, boundary conditions and research-watch items.</p></article>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>Monthly Cognitive Bias Research Digests | Cognitive Biases</title><meta name="description" content="Monthly evidence updates on cognitive biases, decision making and human-AI judgment, with practical checks and explicit uncertainty."><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="Monthly Cognitive Bias Research Digests"><meta property="og:description" content="What changed in the evidence, what remains uncertain, and what to do with it."><meta property="og:url" content="${canonical}"><link rel="stylesheet" href="/styles.css"></head><body><a class="skip" href="#main">Skip to content</a>${header()}<main id="main"><section class="page-hero"><p class="eyebrow">Research · monthly evidence delta</p><h1>What changed in cognitive-bias research?</h1><p class="lede">A monthly digest for people who want more than a list of new papers. We track what strengthens, narrows or extends an existing claim — and what is still only worth watching.</p></section><article class="article"><section><h2>Monthly digests</h2><div class="feature-list">${cards}</div></section><section><h2>How to read these updates</h2><p><strong>Strengthens</strong> means a useful new result supports an existing evidence record. <strong>Narrows</strong> means a boundary condition or negative result makes the claim more precise. <strong>New context</strong> extends a known decision problem into a practical setting. <strong>Watch only</strong> means the result is interesting but not ready to become a canonical claim.</p><p>Every item also answers a practical question: what should a reader check differently after seeing this evidence?</p></section><p><a class="button" href="/research/changes/">Open Evidence Change Log</a> <a href="/research/">Back to Research</a></p></article></main>${footer()}</body></html>`;
}

const evidenceChanges = digests.flatMap((digest) => (digest.signals || [])
  .filter((signal) => signal.delta !== "watch only")
  .map((signal) => ({
    id: `${digest.slug}-${signal.id}`,
    digest: digest.slug,
    month: digest.month,
    publishedAt: digest.publishedAt,
    digestUrl: `${SITE}/research/digests/${digest.slug}/`,
    signalId: signal.id,
    title: signal.title,
    changeType: signal.delta,
    confidence: signal.confidence,
    finding: signal.finding,
    whyItMatters: signal.whyItMatters,
    practicalCheck: signal.practicalCheck,
    projectChange: signal.siteAction,
    sourceStatus: signal.sourceStatus,
    source: signal.source
  })))
  .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)) || a.id.localeCompare(b.id));

function changesPage() {
  const canonical = `${SITE}/research/changes/`;
  const counts = Object.fromEntries(["strengthens", "narrows", "new context"].map((type) => [type, evidenceChanges.filter((change) => change.changeType === type).length]));
  const cards = evidenceChanges.map((change) => `<section class="article-section"><p class="eyebrow">${escape(change.month)} · ${escape(deltaLabel(change.changeType))} · ${escape(change.confidence)}</p><h2>${escape(change.title)}</h2><p><strong>Evidence delta.</strong> ${escape(change.finding)}</p><p><strong>Why we changed something.</strong> ${escape(change.whyItMatters)}</p><p><strong>Project change.</strong> ${escape(change.projectChange)}</p><p><strong>Practical check.</strong> ${escape(change.practicalCheck)}</p><p class="fine-print"><a href="${escape(change.source.url)}" rel="external">${escape(change.source.title)}</a> · <a href="/research/digests/${escape(change.digest)}/">monthly review</a></p></section>`).join("");
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Cognitive Bias Evidence Change Log",
    description: "A chronological record of research that strengthened, narrowed, or extended claims in the Cognitive Biases knowledge library.",
    url: canonical,
    isPartOf: { "@type": "WebSite", name: "Cognitive Biases", url: SITE }
  }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>Evidence Change Log | Cognitive Biases</title><meta name="description" content="See which cognitive-bias claims were strengthened, narrowed, or extended by newly reviewed evidence — and what changed in the library."><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="Evidence Change Log"><meta property="og:description" content="A public history of how reviewed evidence changes the library."><meta property="og:url" content="${canonical}"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${jsonLd}</script></head><body><a class="skip" href="#main">Skip to content</a>${header()}<main id="main"><section class="page-hero"><p class="eyebrow">Research · claim history</p><h1>Evidence should be allowed to change the page.</h1><p class="lede">This log records research that actually changed how the library explains a concept or decision context. It is not a list of every paper we read.</p></section><article class="article"><section><h2>What the labels mean</h2><div class="feature-list"><article><strong>Strengthens · ${counts.strengthens}</strong><p>${escape(changeDefinition.strengthens)}</p></article><article><strong>Narrows · ${counts.narrows}</strong><p>${escape(changeDefinition.narrows)}</p></article><article><strong>New context · ${counts["new context"]}</strong><p>${escape(changeDefinition["new context"])}</p></article></div><p>A claim can be well supported overall and still be narrowed by a later boundary condition. That is not a contradiction; it is often what better evidence looks like.</p></section>${cards}<section><h2>Machine-readable history</h2><p>The same records are available as JSON so assistants and research tools can distinguish a current claim from the evidence changes that shaped it.</p><p><a class="button" href="/data/evidence-changes.json">Evidence changes JSON</a> <a href="/research/digests/">Monthly digests</a></p></section></article></main>${footer()}</body></html>`;
}

await emit("/research/digests/", indexPage());
for (const digest of digests) await emit(`/research/digests/${digest.slug}/`, digestPage(digest));
await emit("/research/changes/", changesPage());

const researchPath = join(OUT, "research", "index.html");
let research = await readFile(researchPath, "utf8");
if (!research.includes('href="/research/digests/"')) {
  const latest = digests[0];
  const block = `<section><p class="eyebrow">Monthly research digest</p><h2>What changed this month?</h2><p>We separate useful evidence changes from paper-of-the-week noise. Each digest shows what strengthened, narrowed or opened a new context — and what is still only worth watching.</p>${latest ? `<p><strong>${escape(latest.title)}</strong> · ${(latest.signals || []).length} reviewed signals.</p><p><a class="button" href="/research/digests/${escape(latest.slug)}/">Read the latest digest</a> <a href="/research/digests/">Browse all digests</a> · <a href="/research/changes/">Evidence Change Log</a></p>` : `<p><a class="button" href="/research/digests/">Browse monthly digests</a></p>`}</section>`;
  research = research.replace("</article></main>", `${block}</article></main>`);
  await writeFile(researchPath, research);
} else if (!research.includes('href="/research/changes/"')) {
  research = research.replace('href="/research/digests/">Browse all digests</a>', 'href="/research/digests/">Browse all digests</a> · <a href="/research/changes/">Evidence Change Log</a>');
  await writeFile(researchPath, research);
}

await mkdir(join(OUT, "data"), { recursive: true });
await writeFile(join(OUT, "data", "monthly-research-digests.json"), `${JSON.stringify(data, null, 2)}\n`);
await writeFile(join(OUT, "data", "evidence-changes.json"), `${JSON.stringify({
  version: 1,
  updatedAt: data.updatedAt,
  canonicalUrl: `${SITE}/research/changes/`,
  semantics: changeDefinition,
  changes: evidenceChanges
}, null, 2)}\n`);

const dataPath = join(OUT, "data", "index.html");
let dataHtml = await readFile(dataPath, "utf8");
if (!dataHtml.includes('href="/data/evidence-changes.json"')) {
  dataHtml = dataHtml.replace("</article></main>", `<section><h2>Evidence change history</h2><p>Use the change log when you need to know not only the current claim, but what recent evidence strengthened, narrowed or extended it.</p><p><a href="/data/evidence-changes.json">Evidence changes JSON</a> · <a href="/research/changes/">Readable change log</a></p></section></article></main>`);
  await writeFile(dataPath, dataHtml);
}

const manifestPath = join(OUT, "data", "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.counts = { ...(manifest.counts || {}), monthlyResearchDigests: digests.length, evidenceChanges: evidenceChanges.length };
manifest.files = { ...(manifest.files || {}), monthlyResearchDigests: `${SITE}/data/monthly-research-digests.json`, evidenceChanges: `${SITE}/data/evidence-changes.json` };
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Generated ${digests.length} monthly research digest(s) and ${evidenceChanges.length} evidence-change record(s).`);
