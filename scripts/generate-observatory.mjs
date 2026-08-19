import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const DATA_OUT = join(OUT, "data");
const methodology = JSON.parse(await readFile("data/observatory-methodology.json", "utf8"));
const topicsData = JSON.parse(await readFile("data/observatory-topics.json", "utf8"));
const snapshotsData = JSON.parse(await readFile("data/observatory-snapshots.json", "utf8"));
const topics = new Map((topicsData.topics || []).map((topic) => [topic.slug, topic]));

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character]);
const round = (value, digits = 3) => Number(Number(value || 0).toFixed(digits));
const signalById = new Map((methodology.signals || []).map((signal) => [signal.id, signal]));
const lexicalSignalIds = ["gain-frame", "loss-frame", "uncertainty", "certainty", "salience", "authority", "social-proof"];
const stopWords = new Set("a an and are as at be but by for from has have how in into is it its of on or our that the their this to was were what when where which who why will with you your ai artificial intelligence job jobs work workforce labor labour market markets".split(/\s+/));

function brand(size, alt) {
  return `<picture class="brand-picture"><source type="image/webp" srcset="/assets/brand.webp"><img src="/assets/biases_icon.png" width="${size}" height="${size}" alt="${escapeHtml(alt)}"></picture>`;
}
function header(current = "") {
  const link = (href, label, id) => `<a href="${href}"${current === id ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<header class="site-header"><a class="brand" href="/">${brand(48, "Cognitive Biases icon")}<span>Cognitive<br>Biases</span></a><nav aria-label="Primary">${link("/everyday/", "Everyday life", "everyday")}${link("/explore/", "Explore", "explore")}${link("/experiments/", "Experiments", "experiments")}${link("/observatory/", "Observatory", "observatory")}${link("/research/", "Research", "research")}<a class="nav-cta" href="/data/">Data</a></nav></header>`;
}
function footer() {
  return `<footer class="site-footer"><div><a class="brand brand--footer" href="/">${brand(40, "")}<span>Cognitive Biases</span></a><p>A public guide to cognitive biases, evidence and better decisions.</p></div><div class="footer-links"><a href="/observatory/">Observatory</a><a href="/experiments/">Experiments Lab</a><a href="/ai-benchmark/">AI Bias Benchmark</a><a href="/research/">Research</a><a href="/methodology/">Methodology</a><a href="/data/">Data</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p></footer>`;
}
function normalizeText(value = "") {
  return ` ${String(value).toLowerCase().normalize("NFKD").replace(/[’']/g, "'").replace(/[^a-z0-9%€$£'?]+/g, " ").replace(/\s+/g, " ").trim()} `;
}
function countTerms(text, terms = []) {
  const normalized = normalizeText(text);
  return terms.reduce((total, term) => {
    const needle = ` ${String(term).toLowerCase()} `;
    let cursor = 0;
    let count = 0;
    while ((cursor = normalized.indexOf(needle, cursor)) !== -1) {
      count += 1;
      cursor += needle.length;
    }
    return total + count;
  }, 0);
}
function contentWords(text = "") {
  return new Set(normalizeText(text).trim().split(/\s+/).filter((token) => token.length > 2 && !stopWords.has(token)));
}
function jaccard(left, right) {
  const union = new Set([...left, ...right]);
  if (!union.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / union.size;
}
function analyzeRecord(record) {
  const counts = {};
  for (const id of lexicalSignalIds) counts[id] = countTerms(record.title, signalById.get(id)?.terms || []);
  const numericTokens = record.title.match(/(?:\d+(?:[.,]\d+)?%?|[$€£]\s*\d+(?:[.,]\d+)?)/g) || [];
  const gain = counts["gain-frame"];
  const loss = counts["loss-frame"];
  const uncertainty = counts.uncertainty;
  const certainty = counts.certainty;
  return {
    ...record,
    signals: {
      gainFrame: gain,
      lossFrame: loss,
      uncertainty,
      certainty,
      salience: counts.salience,
      authority: counts.authority,
      socialProof: counts["social-proof"],
      numericalEmphasis: numericTokens.length,
      questionForm: record.title.trim().endsWith("?")
    },
    derived: {
      frameDirection: gain > loss ? "gain-leaning" : loss > gain ? "loss-leaning" : "mixed-or-neutral",
      certaintyDirection: certainty > uncertainty ? "certainty-leaning" : uncertainty > certainty ? "uncertainty-leaning" : "mixed-or-neutral"
    }
  };
}
function repetitionPairs(records) {
  const pairs = [];
  for (let i = 0; i < records.length; i += 1) {
    for (let j = i + 1; j < records.length; j += 1) {
      const similarity = jaccard(contentWords(records[i].title), contentWords(records[j].title));
      if (similarity >= 0.62) pairs.push({ leftUrl: records[i].url, rightUrl: records[j].url, similarity: round(similarity) });
    }
  }
  return pairs;
}
function summarize(records) {
  const domains = new Set(records.map((record) => record.domain).filter(Boolean));
  const countries = new Set(records.map((record) => record.sourceCountry).filter(Boolean));
  const cueTotals = {
    gainFrame: 0, lossFrame: 0, uncertainty: 0, certainty: 0, salience: 0, authority: 0, socialProof: 0, numericalEmphasis: 0, questionForm: 0
  };
  const frames = { "gain-leaning": 0, "loss-leaning": 0, "mixed-or-neutral": 0 };
  const certainty = { "certainty-leaning": 0, "uncertainty-leaning": 0, "mixed-or-neutral": 0 };
  for (const record of records) {
    for (const key of Object.keys(cueTotals)) cueTotals[key] += record.signals[key] === true ? 1 : Number(record.signals[key] || 0);
    frames[record.derived.frameDirection] += 1;
    certainty[record.derived.certaintyDirection] += 1;
  }
  const repeats = repetitionPairs(records);
  return {
    recordCount: records.length,
    uniqueDomains: domains.size,
    uniqueCountries: countries.size,
    sourceDiversity: records.length ? round(domains.size / records.length) : 0,
    countryDiversity: records.length ? round(countries.size / records.length) : 0,
    cueTotals,
    frameDirections: frames,
    certaintyDirections: certainty,
    nearDuplicatePairs: repeats
  };
}

const snapshots = (snapshotsData.snapshots || []).map((snapshot) => {
  const topic = topics.get(snapshot.topicSlug);
  if (!topic) throw new Error(`${snapshot.id}: unknown topic ${snapshot.topicSlug}`);
  const records = (snapshot.records || []).map(analyzeRecord);
  return { ...snapshot, topic, records, summary: summarize(records) };
}).sort((a, b) => String(b.collectedAt).localeCompare(String(a.collectedAt)));

async function emit(relativePath, content) {
  const target = join(OUT, relativePath.replace(/^\//, ""), "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}
function signalChips(record) {
  const chips = [];
  if (record.derived.frameDirection !== "mixed-or-neutral") chips.push(record.derived.frameDirection);
  if (record.derived.certaintyDirection !== "mixed-or-neutral") chips.push(record.derived.certaintyDirection);
  if (record.signals.salience) chips.push(`salience ${record.signals.salience}`);
  if (record.signals.authority) chips.push(`authority ${record.signals.authority}`);
  if (record.signals.socialProof) chips.push(`social proof ${record.signals.socialProof}`);
  if (record.signals.numericalEmphasis) chips.push(`numbers ${record.signals.numericalEmphasis}`);
  if (record.signals.questionForm) chips.push("question form");
  if (!chips.length) chips.push("no listed cue detected");
  return chips.map((chip) => `<span class="obs-chip">${escapeHtml(chip)}</span>`).join("");
}
function metric(label, value, note) {
  return `<article class="obs-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><p>${escapeHtml(note)}</p></article>`;
}
function snapshotPage(snapshot) {
  const canonical = `${SITE}/observatory/${snapshot.id}/`;
  const datasetSchema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: snapshot.title,
    description: `${snapshot.topic.description} ${snapshot.limitations}`,
    url: canonical,
    dateModified: snapshot.collectedAt.slice(0, 10),
    creator: { "@type": "Organization", name: "Cognitive Biases", url: SITE },
    measurementTechnique: "Transparent headline-level lexical and structural signal rules",
    variableMeasured: methodology.signals.map((signal) => signal.label),
    distribution: [
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}/data/observatory.json` },
      { "@type": "DataDownload", encodingFormat: "application/x-ndjson", contentUrl: `${SITE}/data/observatory-observations.ndjson` }
    ]
  };
  const rows = snapshot.records.map((record) => `<article class="obs-record"><div><p class="kicker">${escapeHtml(record.sourceName || record.domain || "Source")}${record.publishedAt ? ` · ${escapeHtml(record.publishedAt)}` : ""}</p><h2><a href="${escapeHtml(record.url)}" rel="external nofollow">${escapeHtml(record.title)}</a></h2><p>${signalChips(record)}</p></div><dl><div><dt>Frame cues</dt><dd>${record.signals.gainFrame} gain · ${record.signals.lossFrame} loss</dd></div><div><dt>Certainty cues</dt><dd>${record.signals.certainty} certainty · ${record.signals.uncertainty} uncertainty</dd></div><div><dt>Source</dt><dd>${escapeHtml(record.domain || "unknown")}${record.sourceCountry ? ` · ${escapeHtml(record.sourceCountry)}` : ""}</dd></div></dl></article>`).join("");
  const repeats = snapshot.summary.nearDuplicatePairs.length ? `${snapshot.summary.nearDuplicatePairs.length} near-duplicate pair(s)` : "No near-duplicate pairs";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1"><title>${escapeHtml(snapshot.title)} | Cognitive Bias Observatory</title><meta name="description" content="${escapeHtml(snapshot.topic.description)}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(datasetSchema)}</script></head><body><a class="skip" href="#main">Skip to content</a>${header("observatory")}<main id="main"><section class="page-hero obs-hero"><p class="eyebrow">Cognitive Bias Observatory · ${escapeHtml(snapshot.samplingMode)}</p><h1>${escapeHtml(snapshot.title)}</h1><p class="lede">${escapeHtml(snapshot.topic.description)}</p><p class="obs-warning"><strong>Sampling note:</strong> ${escapeHtml(snapshot.limitations)}</p></section><section class="section"><p class="kicker">Snapshot at a glance</p><div class="obs-metrics">${metric("Records", snapshot.summary.recordCount, "Headlines measured")}${metric("Unique domains", snapshot.summary.uniqueDomains, `Diversity ratio ${snapshot.summary.sourceDiversity}`)}${metric("Gain / loss leaning", `${snapshot.summary.frameDirections["gain-leaning"]} / ${snapshot.summary.frameDirections["loss-leaning"]}`, "A lexical view, not sentiment")}${metric("Repeated wording", repeats, "Jaccard threshold ≥ 0.62")}</div></section><section class="section"><p class="kicker">Observed headlines</p><h2>Signals, not diagnoses.</h2><p class="lede">The rules count visible wording and structure. They do not decide whether a story is true, fair, manipulative or psychologically biased.</p><div class="obs-records">${rows}</div></section><section class="section section--ink"><p class="kicker">Method</p><h2>Every label should be inspectable.</h2><p class="lede">Open the methodology to see the exact lexicons, thresholds and limitations behind these measurements.</p><p><a class="button" href="/observatory/methodology/">Read the Observatory methodology</a></p></section></main>${footer()}</body></html>`;
}

for (const snapshot of snapshots) await emit(`/observatory/${snapshot.id}/`, snapshotPage(snapshot));

const latest = snapshots[0];
const snapshotCards = snapshots.map((snapshot) => `<article class="obs-card"><p class="kicker">${escapeHtml(snapshot.topic.title)} · ${escapeHtml(snapshot.collectedAt.slice(0, 10))}</p><h2><a href="/observatory/${snapshot.id}/">${escapeHtml(snapshot.title)}</a></h2><p>${escapeHtml(snapshot.limitations)}</p><p><strong>${snapshot.summary.recordCount}</strong> records · <strong>${snapshot.summary.uniqueDomains}</strong> domains</p><p><a href="/observatory/${snapshot.id}/">Explore snapshot →</a></p></article>`).join("");
const hubSchema = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "CollectionPage", url: `${SITE}/observatory/`, name: "Cognitive Bias Observatory", description: "Open measurements of framing and cognitive-pressure signals in public information environments." },
    { "@type": "DataCatalog", name: "Cognitive Bias Observatory datasets", url: `${SITE}/observatory/`, dataset: snapshots.map((snapshot) => ({ "@type": "Dataset", name: snapshot.title, url: `${SITE}/observatory/${snapshot.id}/` })) }
  ]
};
const hub = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1"><title>Cognitive Bias Observatory | Framing & Information Signals</title><meta name="description" content="Track framing, certainty, salience, authority, social-proof and repetition signals in public information without pretending to diagnose bias."><link rel="canonical" href="${SITE}/observatory/"><link rel="icon" href="/favicon.png"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(hubSchema)}</script></head><body><a class="skip" href="#main">Skip to content</a>${header("observatory")}<main id="main"><section class="page-hero obs-hero"><p class="eyebrow">Cognitive Bias Observatory</p><h1>Measure the information environment, not the person.</h1><p class="lede">The Observatory tracks visible cognitive-pressure signals in headlines: gain and loss framing, certainty, salience, authority cues, social proof, numerical emphasis and repeated wording. It does not label an outlet or author as biased.</p></section><section class="section"><p class="kicker">What we measure</p><h2>Small signals with explicit rules.</h2><div class="obs-signal-grid">${methodology.signals.map((signal) => `<article><strong>${escapeHtml(signal.label)}</strong><p>${escapeHtml(signal.description)}</p></article>`).join("")}</div><p><a href="/observatory/methodology/">See every lexicon and rule →</a></p></section><section class="section"><p class="kicker">Snapshots</p><h2>Public observations with provenance.</h2><p class="lede">Each snapshot records the query, provider, time window and limitations. The launch snapshot is a curated method demonstration; scheduled GDELT snapshots can follow without changing the analysis contract.</p><div class="obs-grid">${snapshotCards}</div></section>${latest ? `<section class="section section--ink"><p class="kicker">Latest snapshot</p><h2>${escapeHtml(latest.title)}</h2><p class="lede">${escapeHtml(latest.limitations)}</p><p><a class="button" href="/observatory/${latest.id}/">Open latest snapshot</a></p></section>` : ""}<section class="section"><p class="kicker">Open data</p><h2>Built for people, researchers and agents.</h2><p>Download the normalized observations as JSON or NDJSON. Each row keeps source provenance and the raw cue counts so another system can reproduce or challenge the derived labels.</p><p><a href="/data/observatory.json">JSON dataset</a> · <a href="/data/observatory-observations.ndjson">NDJSON observations</a></p></section></main>${footer()}</body></html>`;
await emit("/observatory/", hub);

const methodCanonical = `${SITE}/observatory/methodology/`;
const methodRows = methodology.signals.map((signal) => `<article class="obs-method"><h2>${escapeHtml(signal.label)}</h2><p>${escapeHtml(signal.description)}</p>${signal.terms ? `<p><strong>Current lexicon:</strong> ${signal.terms.map(escapeHtml).join(", ")}</p>` : ""}${signal.rule ? `<p><strong>Rule:</strong> ${escapeHtml(signal.rule)}</p>` : ""}</article>`).join("");
const methodPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>Observatory Methodology | Cognitive Biases</title><meta name="description" content="Transparent rules, lexicons, sampling limits and interpretation boundaries for the Cognitive Bias Observatory."><link rel="canonical" href="${methodCanonical}"><link rel="icon" href="/favicon.png"><link rel="stylesheet" href="/styles.css"></head><body><a class="skip" href="#main">Skip to content</a>${header("observatory")}<main id="main"><section class="page-hero"><p class="eyebrow">Observatory methodology · v${methodology.version}</p><h1>What the Observatory can and cannot say.</h1><p class="lede">${escapeHtml(methodology.scope)}</p></section><article class="article"><h2>Unit of analysis</h2><p>${escapeHtml(methodology.unitOfAnalysis)}</p><h2>Interpretation boundary</h2><p>${escapeHtml(methodology.interpretationRule)}</p><h2>Sampling boundary</h2><p>${escapeHtml(methodology.samplingRule)}</p>${methodRows}<h2>Derived views</h2><ul>${Object.entries(methodology.derivedViews || {}).map(([name, description]) => `<li><strong>${escapeHtml(name)}</strong>: ${escapeHtml(description)}</li>`).join("")}</ul><h2>Source infrastructure</h2><ul>${(methodology.provenanceSources || []).map((source) => `<li><a href="${escapeHtml(source.url)}" rel="external">${escapeHtml(source.name)}</a>: ${escapeHtml(source.role)}</li>`).join("")}</ul><p><a class="button" href="/observatory/">Back to Observatory</a></p></article></main>${footer()}</body></html>`;
await emit("/observatory/methodology/", methodPage);

await mkdir(DATA_OUT, { recursive: true });
const publicPayload = {
  version: snapshotsData.version,
  updatedAt: snapshotsData.updatedAt,
  methodologyVersion: methodology.version,
  canonicalUrl: `${SITE}/observatory/`,
  interpretationRule: methodology.interpretationRule,
  topics: topicsData.topics,
  snapshots: snapshots.map((snapshot) => ({
    id: snapshot.id,
    topicSlug: snapshot.topicSlug,
    title: snapshot.title,
    canonicalUrl: `${SITE}/observatory/${snapshot.id}/`,
    collectedAt: snapshot.collectedAt,
    provider: snapshot.provider,
    samplingMode: snapshot.samplingMode,
    window: snapshot.window,
    query: snapshot.query,
    language: snapshot.language,
    limitations: snapshot.limitations,
    summary: snapshot.summary,
    records: snapshot.records
  }))
};
await writeFile(join(DATA_OUT, "observatory.json"), `${JSON.stringify(publicPayload, null, 2)}\n`);
await writeFile(join(DATA_OUT, "observatory-methodology.json"), `${JSON.stringify(methodology, null, 2)}\n`);
await writeFile(join(DATA_OUT, "observatory-topics.json"), `${JSON.stringify(topicsData, null, 2)}\n`);
const ndjson = snapshots.flatMap((snapshot) => snapshot.records.map((record) => JSON.stringify({ snapshotId: snapshot.id, topicSlug: snapshot.topicSlug, collectedAt: snapshot.collectedAt, provider: snapshot.provider, samplingMode: snapshot.samplingMode, limitations: snapshot.limitations, ...record }))).join("\n");
await writeFile(join(DATA_OUT, "observatory-observations.ndjson"), `${ndjson}${ndjson ? "\n" : ""}`);

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
for (const [path, date] of [["/observatory/", snapshotsData.updatedAt], ["/observatory/methodology/", methodology.updatedAt], ...snapshots.map((snapshot) => [`/observatory/${snapshot.id}/`, snapshot.collectedAt.slice(0, 10)])]) {
  const url = `${SITE}${path}`;
  if (!sitemap.includes(`<loc>${url}</loc>`)) sitemap = sitemap.replace("</urlset>", `<url><loc>${url}</loc><lastmod>${date}</lastmod></url></urlset>`);
}
await writeFile(sitemapPath, sitemap);

const homepagePath = join(OUT, "index.html");
let homepage = await readFile(homepagePath, "utf8");
if (!homepage.includes('class="observatory-home"')) {
  const section = `<section class="section observatory-home"><p class="kicker">Cognitive Bias Observatory</p><h2>How is the information environment framing the same topic?</h2><p class="lede">Track gain and loss frames, certainty, salience, authority cues and repeated wording with transparent rules and source provenance.</p><p><a class="button" href="/observatory/">Explore the Observatory</a></p></section>`;
  homepage = homepage.replace("</main>", `${section}</main>`);
  await writeFile(homepagePath, homepage);
}
for (const resource of ["research", "experiments"]) {
  const path = join(OUT, resource, "index.html");
  try {
    let html = await readFile(path, "utf8");
    if (!html.includes('href="/observatory/"')) {
      const block = `<section class="section observatory-crosslink"><p class="kicker">Observatory</p><h2>Move from controlled examples to public information.</h2><p>The Cognitive Bias Observatory measures transparent headline-level framing and attention signals while preserving source provenance and sampling limits.</p><p><a href="/observatory/">Explore Observatory data →</a></p></section>`;
      html = html.replace("</main>", `${block}</main>`);
      await writeFile(path, html);
    }
  } catch {}
}

async function walkHtml(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walkHtml(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}
let navUpdated = 0;
for (const path of await walkHtml(OUT)) {
  let html = await readFile(path, "utf8");
  const primary = html.match(/<nav aria-label="Primary">([\s\S]*?)<\/nav>/i);
  if (!primary || primary[1].includes('href="/observatory/"')) continue;
  html = html.replace('<nav aria-label="Primary">', '<nav aria-label="Primary"><a href="/observatory/">Observatory</a>');
  await writeFile(path, html);
  navUpdated += 1;
}

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".obs-grid{")) {
  styles += `\n.obs-warning{border:var(--line);background:var(--yellow);padding:1rem 1.2rem;max-width:900px}.obs-grid,.obs-signal-grid,.obs-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-left:var(--line);border-top:var(--line);margin-top:2rem}.obs-card,.obs-signal-grid article,.obs-metric{padding:1.35rem;border-right:var(--line);border-bottom:var(--line);background:#fff}.obs-metric span{font-weight:900;text-transform:uppercase;font-size:.75rem;letter-spacing:.06em}.obs-metric strong{display:block;font:1.5rem Archivo Black,sans-serif;margin:.35rem 0}.obs-records{border-top:var(--line);margin-top:2rem}.obs-record{display:grid;grid-template-columns:minmax(0,2fr) minmax(220px,1fr);gap:2rem;padding:1.5rem 0;border-bottom:var(--line)}.obs-record h2{font:1.35rem/1.15 Archivo Black,sans-serif;letter-spacing:-.03em;margin:.35rem 0}.obs-record dl{margin:0}.obs-record dl div{border-bottom:1px solid #d7d7d7;padding:.45rem 0}.obs-record dt{font-weight:900;font-size:.75rem;text-transform:uppercase}.obs-record dd{margin:.15rem 0 0}.obs-chip{display:inline-block;border:1px solid var(--ink);padding:.22rem .42rem;margin:.2rem .22rem .2rem 0;font-size:.76rem;font-weight:800;background:#fff}.obs-method{border-top:var(--line);padding:1.2rem 0}.obs-method h2{margin-bottom:.5rem}@media(max-width:760px){.obs-grid,.obs-signal-grid,.obs-metrics{grid-template-columns:1fr}.obs-record{grid-template-columns:1fr}}\n`;
  await writeFile(stylesPath, styles);
}

const manifestPath = join(DATA_OUT, "manifest.json");
try {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.counts = { ...(manifest.counts || {}), observatorySnapshots: snapshots.length, observatoryObservations: snapshots.reduce((sum, snapshot) => sum + snapshot.records.length, 0) };
  manifest.files = { ...(manifest.files || {}), observatory: `${SITE}/data/observatory.json`, observatoryObservations: `${SITE}/data/observatory-observations.ndjson`, observatoryMethodology: `${SITE}/data/observatory-methodology.json` };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
} catch {}

console.log(`Observatory generated: ${snapshots.length} snapshot(s), ${snapshots.reduce((sum, snapshot) => sum + snapshot.records.length, 0)} observations, navigation added to ${navUpdated} pages.`);
