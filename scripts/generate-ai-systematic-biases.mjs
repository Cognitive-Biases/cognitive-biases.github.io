import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const catalog = JSON.parse(await readFile("data/ai-systematic-biases.json", "utf8"));
const DAY = 86400000;
const AS_OF = new Date(`${catalog.updatedAt}T00:00:00Z`);

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character]);
const brand = (size, alt) => `<picture class="brand-picture"><source type="image/webp" srcset="/assets/brand.webp"><img src="/assets/biases_icon.png" width="${size}" height="${size}" alt="${escapeHtml(alt)}"></picture>`;
const header = (current = "") => {
  const link = (href, label, id) => `<a href="${href}"${current === id ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<header class="site-header"><a class="brand" href="/">${brand(48, "Cognitive Biases icon")}<span>Cognitive<br>Biases</span></a><nav aria-label="Primary">${link("/everyday/", "Human biases", "human")}${link("/ai-biases/", "AI biases", "ai")}${link("/observatory/", "Observatory", "observatory")}${link("/experiments/", "Experiments", "experiments")}${link("/research/", "Research", "research")}<a class="nav-cta" href="/data/">Data</a></nav></header>`;
};
const footer = () => `<footer class="site-footer"><div><a class="brand brand--footer" href="/">${brand(40, "")}<span>Cognitive Biases</span></a><p>Evidence, tests and practical tools for human and AI decision bias.</p></div><div class="footer-links"><a href="/everyday/">Human biases</a><a href="/ai-biases/">AI biases</a><a href="/ai-benchmark/">AI Bias Benchmark</a><a href="/observatory/">Observatory</a><a href="/research/">Research</a><a href="/data/">Data</a></div><p class="fine-print">Educational information. AI findings are dated evidence snapshots, not permanent properties of a model family.</p></footer>`;

function freshness(snapshot) {
  if (String(snapshot.status || "").includes("historical")) return { key: "historical", label: "Historical snapshot" };
  const observed = Date.parse(`${snapshot.observedAt}T00:00:00Z`);
  if (!Number.isFinite(observed)) return { key: "unknown", label: "Date unknown" };
  const age = Math.max(0, Math.floor((AS_OF.getTime() - observed) / DAY));
  if (age <= catalog.reviewPolicy.volatileModelSnapshotDays) return { key: "current", label: "Recent evidence snapshot" };
  if (age <= catalog.reviewPolicy.defaultReviewDays) return { key: "watch", label: "Review window approaching" };
  return { key: "due", label: "Retest on current models" };
}
function latestSnapshot(entry) {
  return [...(entry.modelSnapshots || [])].sort((a, b) => String(b.observedAt).localeCompare(String(a.observedAt)))[0] || null;
}
function list(items = []) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}
function sourceList(entry) {
  return `<ol class="ai-source-list">${(entry.sources || []).map((source) => `<li><a href="${escapeHtml(source.url)}" rel="external">${escapeHtml(source.title)}</a><br><span>${escapeHtml(source.venue)} · ${escapeHtml(source.year)}${source.doi ? ` · DOI ${escapeHtml(source.doi)}` : ""} · ${escapeHtml(source.kind)}</span></li>`).join("")}</ol>`;
}
async function emit(relativePath, html) {
  const target = join(OUT, relativePath.replace(/^\//, ""), "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}
function pageHead({ title, description, canonical, schema }) {
  return `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(schema)}</script></head>`;
}

const catalogCanonical = `${SITE}/ai-biases/`;
const catalogSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": `${catalogCanonical}#page`,
      url: catalogCanonical,
      name: "AI Systematic Biases",
      description: catalog.description,
      dateModified: catalog.updatedAt,
      inLanguage: "en"
    },
    {
      "@type": "Dataset",
      "@id": `${catalogCanonical}#dataset`,
      name: "AI Systematic Biases evidence catalog",
      description: catalog.description,
      dateModified: catalog.updatedAt,
      version: String(catalog.version),
      creator: { "@type": "Organization", name: "Cognitive Biases", url: SITE },
      distribution: [{ "@type": "DataDownload", contentUrl: `${SITE}/data/ai-systematic-biases.json`, encodingFormat: "application/json" }]
    },
    {
      "@type": "ItemList",
      itemListElement: catalog.entries.map((entry, index) => ({ "@type": "ListItem", position: index + 1, url: `${SITE}/ai-biases/${entry.slug}/`, name: entry.name }))
    }
  ]
};

const catalogCards = catalog.entries.map((entry) => {
  const snapshot = latestSnapshot(entry);
  const state = snapshot ? freshness(snapshot) : { key: "unknown", label: "No model snapshot" };
  return `<article class="ai-bias-card" data-category="${escapeHtml(entry.category)}" data-contexts="${escapeHtml(entry.contexts.join(" "))}"><div class="ai-bias-card__meta"><span class="ai-badge">${escapeHtml(entry.category.replaceAll("-", " "))}</span><span class="ai-fresh ai-fresh--${state.key}">${escapeHtml(state.label)}</span></div><h2><a href="/ai-biases/${escapeHtml(entry.slug)}/">${escapeHtml(entry.name)}</a></h2><p>${escapeHtml(entry.definition)}</p><p class="ai-evidence"><strong>Evidence:</strong> ${escapeHtml(entry.evidenceStatus)}</p><p class="ai-contexts"><strong>Useful for:</strong> ${entry.contexts.map((context) => escapeHtml(context.replaceAll("-", " "))).join(" · ")}</p><p><a href="/ai-biases/${escapeHtml(entry.slug)}/">Evidence, self-test and mitigations →</a></p></article>`;
}).join("");

const contextOptions = catalog.contexts.map((context) => `<option value="${escapeHtml(context)}">${escapeHtml(context.replaceAll("-", " "))}</option>`).join("");
const catalogPage = `<!doctype html><html lang="en">${pageHead({ title: "AI Biases | Evidence, Model Snapshots & Self-Tests", description: "Evidence-backed AI bias catalog with dated model findings, practical tests and mitigations for chat, agents, RAG and LLM-as-a-judge systems.", canonical: catalogCanonical, schema: catalogSchema })}<body><a class="skip" href="#main">Skip to content</a>${header("ai")}<main id="main"><section class="page-hero ai-bias-hero"><p class="eyebrow">AI Systematic Biases · evidence catalog v${escapeHtml(catalog.version)}</p><h1>Models can be systematically wrong without thinking like humans.</h1><p class="lede">${escapeHtml(catalog.description)}</p><p class="ai-boundary"><strong>Terminology rule.</strong> ${escapeHtml(catalog.terminologyBoundary)}</p></section><section class="section ai-pillar-map"><p class="kicker">The project now has three layers</p><div class="ai-three-layer"><article><span>01</span><h2>Human biases</h2><p>Psychology, evidence, examples and practical decision tools for people.</p><a href="/everyday/">Explore human biases →</a></article><article><span>02</span><h2>AI biases</h2><p>Measured model sensitivities, evaluator distortions and dated model snapshots.</p><a href="/ai-biases/">You are here</a></article><article><span>03</span><h2>Human–AI patterns</h2><p>What happens when people, model behaviour and information environments interact.</p><a href="/observatory/">Open the Observatory →</a></article></div></section><section class="section"><p class="kicker">Find the failure mode you actually use</p><h2>Filter by system context.</h2><label class="ai-filter-label" for="ai-context-filter">System context</label><select id="ai-context-filter" class="ai-filter"><option value="all">All contexts</option>${contextOptions}</select><p id="ai-filter-count" class="ai-filter-count">${catalog.entries.length} evidence-backed entries</p><div class="ai-bias-grid" id="ai-bias-grid">${catalogCards}</div></section><section class="section section--ink"><p class="kicker">Self-test before trust</p><h2>Use controlled pairs, not vibes.</h2><p class="lede">A good AI bias test changes one variable at a time, uses fresh contexts, records the exact model and date, and repeats stochastic cases. The existing AI Bias Benchmark provides reusable paired tests for anchoring, framing, decoy, escalation, outcome and planning effects.</p><div class="ai-action-row"><a class="button" href="/ai-benchmark/">Run the AI Bias Benchmark</a><a class="button button--ghost" href="/ai-biases/methodology/">Read the methodology</a></div></section><section class="section"><p class="kicker">For agents and researchers</p><h2>The catalog is machine-readable.</h2><p class="lede">Each record includes contexts, evidence strength, practical signals, mitigations, sources and dated model snapshots. Historical findings stay visible, but they are not silently presented as properties of today's models.</p><p><a href="/data/ai-systematic-biases.json">Open the JSON catalog →</a></p></section></main>${footer()}<script>const select=document.querySelector('#ai-context-filter');const cards=[...document.querySelectorAll('.ai-bias-card')];const count=document.querySelector('#ai-filter-count');select?.addEventListener('change',()=>{let visible=0;for(const card of cards){const show=select.value==='all'||card.dataset.contexts.split(' ').includes(select.value);card.hidden=!show;if(show)visible+=1;}count.textContent=visible+' evidence-backed '+(visible===1?'entry':'entries');});</script></body></html>`;
await emit("/ai-biases/", catalogPage);

for (const entry of catalog.entries) {
  const canonical = `${SITE}/ai-biases/${entry.slug}/`;
  const snapshotBlocks = (entry.modelSnapshots || []).map((snapshot) => {
    const state = freshness(snapshot);
    return `<article class="ai-snapshot"><div><span class="ai-fresh ai-fresh--${state.key}">${escapeHtml(state.label)}</span><h3>${escapeHtml(snapshot.scope)}</h3></div><dl><div><dt>Evidence date</dt><dd>${escapeHtml(snapshot.observedAt)}</dd></div><div><dt>Status</dt><dd>${escapeHtml(snapshot.status.replaceAll("-", " "))}</dd></div></dl><p>${escapeHtml(snapshot.finding)}</p><p><a href="${escapeHtml(snapshot.source)}" rel="external">Open source →</a></p></article>`;
  }).join("");
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebPage", "@id": `${canonical}#page`, url: canonical, name: entry.name, description: entry.definition, dateModified: catalog.updatedAt, inLanguage: "en" },
      { "@type": "DefinedTerm", "@id": `${canonical}#term`, name: entry.name, description: entry.definition, inDefinedTermSet: `${SITE}/ai-biases/` }
    ]
  };
  const page = `<!doctype html><html lang="en">${pageHead({ title: `${entry.name} in AI Systems | Evidence & Test`, description: `${entry.definition} Evidence, dated model snapshots, a practical self-test and mitigations.`, canonical, schema })}<body><a class="skip" href="#main">Skip to content</a>${header("ai")}<main id="main"><section class="page-hero ai-bias-detail"><p class="eyebrow"><a href="/ai-biases/">AI Systematic Biases</a> · ${escapeHtml(entry.category.replaceAll("-", " "))}</p><h1>${escapeHtml(entry.name)}</h1><p class="lede">${escapeHtml(entry.definition)}</p><p class="ai-boundary"><strong>Human analogy:</strong> ${escapeHtml(entry.humanAnalogy)}. This is a behavioural analogy, not a claim that the model has the same mental mechanism.</p></section><section class="section ai-detail-grid"><article><p class="kicker">Why it matters</p><h2>Where this breaks real systems</h2><p>${escapeHtml(entry.whyItMatters)}</p><p><strong>Evidence status:</strong> ${escapeHtml(entry.evidenceStatus)}</p><p><strong>Evidence level:</strong> ${escapeHtml(entry.evidenceLevel.replaceAll("-", " "))}</p></article><article><p class="kicker">Signals</p><h2>What to look for</h2>${list(entry.signals)}</article></section><section class="section section--ink"><p class="kicker">Self-test</p><h2>Test it in your own model or workflow.</h2><p class="lede">${escapeHtml(entry.selfTest)}</p><p class="fine-print">Record the exact model identifier, surface, system prompt, relevant settings and run date. A single surprising answer is an anecdote, not a bias measurement.</p></section><section class="section ai-detail-grid"><article><p class="kicker">Mitigation</p><h2>Make the workflow harder to fool.</h2>${list(entry.mitigations)}</article><article><p class="kicker">Applies to</p><h2>System contexts</h2><p>${entry.contexts.map((context) => `<span class="ai-badge">${escapeHtml(context.replaceAll("-", " "))}</span>`).join(" ")}</p></article></section><section class="section"><p class="kicker">Dated model evidence</p><h2>Snapshots, not permanent labels.</h2><p class="lede">These findings describe the model or model set tested at the stated time. A newer release needs new evidence.</p><div class="ai-snapshot-grid">${snapshotBlocks}</div></section><section class="section"><p class="kicker">Sources</p><h2>Evidence behind this entry</h2>${sourceList(entry)}</section></main>${footer()}</body></html>`;
  await emit(`/ai-biases/${entry.slug}/`, page);
}

const methodologyCanonical = `${SITE}/ai-biases/methodology/`;
const methodologySchema = { "@context": "https://schema.org", "@type": "WebPage", url: methodologyCanonical, name: "AI Bias Catalog Methodology", description: "Rules for evidence, terminology, freshness and model-specific claims in the Cognitive Biases AI catalog.", dateModified: catalog.updatedAt };
const methodologyPage = `<!doctype html><html lang="en">${pageHead({ title: "AI Bias Catalog Methodology | Evidence & Freshness", description: "How Cognitive Biases separates human psychology from AI behaviour, grades evidence and keeps model-specific claims time-bounded.", canonical: methodologyCanonical, schema: methodologySchema })}<body><a class="skip" href="#main">Skip to content</a>${header("ai")}<main id="main"><section class="page-hero"><p class="eyebrow">AI Biases · methodology</p><h1>A model finding expires faster than a psychology textbook.</h1><p class="lede">This catalog is designed for a moving target. Model behaviour can change with a checkpoint, post-training recipe, system prompt, product surface or silent serving update.</p></section><section class="section ai-detail-grid"><article><p class="kicker">Terminology</p><h2>Behaviour first.</h2><p>${escapeHtml(catalog.terminologyBoundary)}</p></article><article><p class="kicker">Evidence</p><h2>Prefer measurements over screenshots.</h2><p>We prioritize peer-reviewed controlled studies, multi-model benchmarks and provider incident reports. Preprints can enter the research inbox, but they do not silently become established facts.</p></article></section><section class="section section--ink"><p class="kicker">Freshness contract</p><h2>Keep history. Retest the present.</h2>${list(catalog.reviewPolicy.rules)}<p>Model-specific snapshots enter a fast review window after ${catalog.reviewPolicy.volatileModelSnapshotDays} days. The default catalog review interval is ${catalog.reviewPolicy.defaultReviewDays} days.</p></section><section class="section"><p class="kicker">Minimum experiment</p><h2>One changed variable, fresh contexts, repeated runs.</h2><ol><li>Write a neutral control and one treatment that changes only the suspected bias trigger.</li><li>Run conditions in fresh contexts so the model cannot carry state between them.</li><li>Record the exact model, product/API surface, system prompt, date and relevant sampling settings.</li><li>Repeat stochastic tests and report distributions or consistency, not one convenient example.</li><li>Retest after material model or system changes. Preserve old results as historical snapshots.</li></ol><p><a class="button" href="/ai-benchmark/">Use the existing benchmark protocol</a></p></section></main>${footer()}</body></html>`;
await emit("/ai-biases/methodology/", methodologyPage);

await mkdir(join(OUT, "data"), { recursive: true });
await mkdir(join(OUT, "ai"), { recursive: true });
const publicCatalog = { ...catalog, canonicalUrl: catalogCanonical, methodologyUrl: methodologyCanonical };
await writeFile(join(OUT, "data", "ai-systematic-biases.json"), `${JSON.stringify(publicCatalog, null, 2)}\n`);
await writeFile(join(OUT, "ai", "ai-systematic-biases.json"), `${JSON.stringify(publicCatalog, null, 2)}\n`);

const teaser = `<section class="section ai-bias-teaser" data-ai-bias-pillar><p class="kicker">Human biases · AI biases · interaction effects</p><h2>Bias is no longer only a human problem.</h2><p class="lede">Explore systematic model sensitivities with dated evidence, practical self-tests and model snapshots — without pretending that an LLM has a human mind.</p><div class="ai-action-row"><a class="button" href="/ai-biases/">Explore AI biases</a><a class="button button--ghost" href="/ai-benchmark/">Run model tests</a></div></section>`;
for (const path of [join(OUT, "index.html"), join(OUT, "research", "index.html"), join(OUT, "data", "index.html"), join(OUT, "ai-benchmark", "index.html")]) {
  try {
    let html = await readFile(path, "utf8");
    if (!html.includes("data-ai-bias-pillar") && html.includes("</main>")) {
      html = html.replace("</main>", `${teaser}</main>`);
      await writeFile(path, html);
    }
  } catch {
    // Some builds may not emit every optional hub. The catalog itself remains canonical.
  }
}

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
const urls = [catalogCanonical, methodologyCanonical, ...catalog.entries.map((entry) => `${SITE}/ai-biases/${entry.slug}/`)];
for (const url of urls) {
  if (!sitemap.includes(`<loc>${url}</loc>`)) sitemap = sitemap.replace("</urlset>", `<url><loc>${url}</loc><lastmod>${catalog.updatedAt}</lastmod></url></urlset>`);
}
await writeFile(sitemapPath, sitemap);

try {
  const llmsPath = join(OUT, "llms.txt");
  let llms = await readFile(llmsPath, "utf8");
  if (!llms.includes("/ai-biases/")) {
    llms += `\n## AI systematic biases\n- ${catalogCanonical} — evidence-backed catalog of systematic LLM behaviour with dated model snapshots\n- ${methodologyCanonical} — terminology, evidence and freshness rules\n- ${SITE}/data/ai-systematic-biases.json — machine-readable catalog\n`;
    await writeFile(llmsPath, llms);
  }
} catch {
  // llms.txt is optional for local partial builds.
}

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".ai-bias-grid{")) {
  styles += `
.ai-bias-grid,.ai-snapshot-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-left:var(--line);border-top:var(--line);margin-top:1.5rem}.ai-bias-card,.ai-snapshot{padding:1.35rem;border-right:var(--line);border-bottom:var(--line);background:#fff;color:var(--ink)}.ai-bias-card h2,.ai-snapshot h3{margin:.6rem 0 .7rem}.ai-bias-card__meta{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}.ai-badge,.ai-fresh{display:inline-block;padding:.32rem .55rem;border:1px solid currentColor;border-radius:999px;font-size:.74rem;font-weight:800;text-transform:uppercase;letter-spacing:.035em}.ai-fresh--current{background:#eef9ef}.ai-fresh--watch{background:#fff7df}.ai-fresh--due,.ai-fresh--historical{background:#f3f3f3}.ai-boundary{max-width:900px;padding:1rem 1.1rem;border-left:4px solid currentColor;background:rgba(255,255,255,.72)}.ai-three-layer{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-left:var(--line);border-top:var(--line)}.ai-three-layer article{padding:1.35rem;border-right:var(--line);border-bottom:var(--line)}.ai-three-layer span{font-weight:900}.ai-filter-label{display:block;font-weight:800;margin-top:1rem}.ai-filter{margin:.4rem 0 .5rem;max-width:420px;width:100%;padding:.75rem;background:#fff;border:var(--line);font:inherit}.ai-filter-count{font-weight:800}.ai-action-row{display:flex;gap:.75rem;flex-wrap:wrap}.button--ghost{background:transparent!important;color:inherit!important;border:1px solid currentColor!important}.ai-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2rem}.ai-snapshot dl{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}.ai-snapshot dt{font-weight:800}.ai-source-list li{margin:0 0 1rem}.ai-source-list span{opacity:.72}.ai-bias-card[hidden]{display:none}.ai-bias-teaser{border-top:var(--line)}@media(max-width:760px){.ai-bias-grid,.ai-snapshot-grid,.ai-three-layer,.ai-detail-grid{grid-template-columns:1fr}.ai-snapshot dl{grid-template-columns:1fr}}
`;
  await writeFile(stylesPath, styles);
}

console.log(`Generated AI systematic bias catalog v${catalog.version}: ${catalog.entries.length} entries, ${catalog.entries.length + 2} pages.`);
