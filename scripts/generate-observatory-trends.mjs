import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const DATA_OUT = join(OUT, "data");
const MIN_TREND_SNAPSHOTS = 3;
const MIN_SOURCE_HEADLINES = 5;

const methodology = JSON.parse(await readFile("data/observatory-methodology.json", "utf8"));
const topicsData = JSON.parse(await readFile("data/observatory-topics.json", "utf8"));
const snapshotsData = JSON.parse(await readFile("data/observatory-snapshots.json", "utf8"));
const topics = topicsData.topics || [];
const signalById = new Map((methodology.signals || []).map((signal) => [signal.id, signal]));
const lexicalSignalIds = ["gain-frame", "loss-frame", "uncertainty", "certainty", "salience", "authority", "social-proof"];
const rateKeys = ["gainFrame", "lossFrame", "uncertainty", "certainty", "salience", "authority", "socialProof", "numericalEmphasis", "questionForm"];

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);
const round = (value, digits = 3) => Number(Number(value || 0).toFixed(digits));
const perHeadline = (value, count) => count ? round(value / count) : 0;
const comparisonKeyFor = (snapshot) => `${snapshot.provider || "unknown"}::${snapshot.samplingMode || "unknown"}`;

function brand(size, alt) {
  return `<picture class="brand-picture"><source type="image/webp" srcset="/assets/brand.webp"><img src="/assets/biases_icon.png" width="${size}" height="${size}" alt="${escapeHtml(alt)}"></picture>`;
}
function header() {
  return `<header class="site-header"><a class="brand" href="/">${brand(48, "Cognitive Biases icon")}<span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/everyday/">Everyday life</a><a href="/explore/">Explore</a><a href="/experiments/">Experiments</a><a href="/observatory/" aria-current="page">Observatory</a><a href="/research/">Research</a><a class="nav-cta" href="/data/">Data</a></nav></header>`;
}
function footer() {
  return `<footer class="site-footer"><div><a class="brand brand--footer" href="/">${brand(40, "")}<span>Cognitive Biases</span></a><p>A public guide to cognitive biases, evidence and better decisions.</p></div><div class="footer-links"><a href="/observatory/">Observatory</a><a href="/observatory/trends/">Trends</a><a href="/observatory/sources/">Source comparisons</a><a href="/observatory/methodology/">Methodology</a><a href="/research/">Research</a><a href="/data/">Data</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p></footer>`;
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
function analyzeRecord(record) {
  const counts = {};
  for (const id of lexicalSignalIds) counts[id] = countTerms(record.title, signalById.get(id)?.terms || []);
  const numericTokens = String(record.title || "").match(/(?:\d+(?:[.,]\d+)?%?|[$€£]\s*\d+(?:[.,]\d+)?)/g) || [];
  return {
    ...record,
    signals: {
      gainFrame: counts["gain-frame"],
      lossFrame: counts["loss-frame"],
      uncertainty: counts.uncertainty,
      certainty: counts.certainty,
      salience: counts.salience,
      authority: counts.authority,
      socialProof: counts["social-proof"],
      numericalEmphasis: numericTokens.length,
      questionForm: String(record.title || "").trim().endsWith("?") ? 1 : 0
    }
  };
}
function summarizeSnapshot(snapshot) {
  const records = (snapshot.records || []).map(analyzeRecord);
  const totals = Object.fromEntries(rateKeys.map((key) => [key, 0]));
  const domains = new Set();
  for (const record of records) {
    if (record.domain) domains.add(record.domain);
    for (const key of rateKeys) totals[key] += Number(record.signals[key] || 0);
  }
  return {
    snapshotId: snapshot.id,
    topicSlug: snapshot.topicSlug,
    collectedAt: snapshot.collectedAt,
    date: String(snapshot.collectedAt || "").slice(0, 10),
    samplingMode: snapshot.samplingMode,
    provider: snapshot.provider,
    comparisonKey: comparisonKeyFor(snapshot),
    recordCount: records.length,
    uniqueDomains: domains.size,
    sourceDiversity: records.length ? round(domains.size / records.length) : 0,
    rates: Object.fromEntries(rateKeys.map((key) => [key, perHeadline(totals[key], records.length)])),
    records
  };
}
function slope(series, key) {
  if (series.length < MIN_TREND_SNAPSHOTS) return null;
  const values = series.map((point) => Number(point.rates[key] || 0));
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((sum, value) => sum + value, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < n; index += 1) {
    numerator += (index - xMean) * (values[index] - yMean);
    denominator += (index - xMean) ** 2;
  }
  return denominator ? round(numerator / denominator, 4) : 0;
}
function trendLabel(value) {
  if (value === null) return "not-ready";
  if (value > 0.03) return "increasing";
  if (value < -0.03) return "decreasing";
  return "roughly-stable";
}
function pickComparableSeries(allSeries) {
  const groups = new Map();
  for (const point of allSeries) {
    if (!groups.has(point.comparisonKey)) groups.set(point.comparisonKey, []);
    groups.get(point.comparisonKey).push(point);
  }
  const ranked = [...groups.entries()].map(([key, series]) => ({
    key,
    series: [...series].sort((a, b) => String(a.collectedAt).localeCompare(String(b.collectedAt))),
    latestAt: [...series].sort((a, b) => String(b.collectedAt).localeCompare(String(a.collectedAt)))[0]?.collectedAt || ""
  })).sort((a, b) => b.series.length - a.series.length || String(b.latestAt).localeCompare(String(a.latestAt)) || a.key.localeCompare(b.key));
  return { primary: ranked[0] || { key: null, series: [], latestAt: "" }, groups: ranked };
}

const analyzedSnapshots = (snapshotsData.snapshots || []).map(summarizeSnapshot);
const topicSeries = topics.map((topic) => {
  const allSeries = analyzedSnapshots.filter((snapshot) => snapshot.topicSlug === topic.slug)
    .sort((a, b) => String(a.collectedAt).localeCompare(String(b.collectedAt)));
  const { primary, groups } = pickComparableSeries(allSeries);
  const series = primary.series;
  const observationCount = series.reduce((sum, point) => sum + point.recordCount, 0);
  const totalObservationCount = allSeries.reduce((sum, point) => sum + point.recordCount, 0);
  const trendReady = series.length >= MIN_TREND_SNAPSHOTS;
  const slopes = Object.fromEntries(rateKeys.map((key) => [key, slope(series, key)]));
  const [provider = null, samplingMode = null] = String(primary.key || "::").split("::");
  return {
    slug: topic.slug,
    title: topic.title,
    description: topic.description,
    active: topic.active,
    comparisonKey: primary.key,
    comparableProvider: provider || null,
    comparableSamplingMode: samplingMode || null,
    snapshotCount: series.length,
    totalSnapshotCount: allSeries.length,
    excludedSnapshotCount: Math.max(0, allSeries.length - series.length),
    observationCount,
    totalObservationCount,
    trendReady,
    readiness: trendReady ? "ready" : "insufficient-history",
    minimumSnapshotsRequired: MIN_TREND_SNAPSHOTS,
    snapshotsNeeded: Math.max(0, MIN_TREND_SNAPSHOTS - series.length),
    latest: series.at(-1) ? (({ records, ...point }) => point)(series.at(-1)) : null,
    series: series.map(({ records, ...point }) => point),
    excludedSnapshots: allSeries.filter((point) => point.comparisonKey !== primary.key).map(({ records, ...point }) => ({ ...point, reason: "different-provider-or-sampling-mode" })),
    availableSeries: groups.map((group) => ({ comparisonKey: group.key, snapshotCount: group.series.length, latestAt: group.latestAt })),
    trends: Object.fromEntries(rateKeys.map((key) => [key, { slope: slopes[key], direction: trendLabel(slopes[key]) }]))
  };
});

const dedupedByUrl = new Map();
for (const snapshot of analyzedSnapshots) {
  for (const record of snapshot.records) {
    if (!record.url || dedupedByUrl.has(record.url)) continue;
    dedupedByUrl.set(record.url, { ...record, topicSlug: snapshot.topicSlug, snapshotId: snapshot.snapshotId });
  }
}
const sourceMap = new Map();
for (const record of dedupedByUrl.values()) {
  const domain = record.domain || "unknown";
  if (!sourceMap.has(domain)) sourceMap.set(domain, { domain, headlines: [], topics: new Set() });
  const bucket = sourceMap.get(domain);
  bucket.headlines.push(record);
  bucket.topics.add(record.topicSlug);
}
const sourceProfiles = [...sourceMap.values()].map((bucket) => {
  const totals = Object.fromEntries(rateKeys.map((key) => [key, 0]));
  for (const record of bucket.headlines) for (const key of rateKeys) totals[key] += Number(record.signals[key] || 0);
  return {
    domain: bucket.domain,
    headlineCount: bucket.headlines.length,
    topicCount: bucket.topics.size,
    topics: [...bucket.topics].sort(),
    comparisonReady: bucket.headlines.length >= MIN_SOURCE_HEADLINES,
    minimumHeadlinesRequired: MIN_SOURCE_HEADLINES,
    rates: Object.fromEntries(rateKeys.map((key) => [key, perHeadline(totals[key], bucket.headlines.length)]))
  };
}).sort((a, b) => b.headlineCount - a.headlineCount || a.domain.localeCompare(b.domain));

const generatedAt = snapshotsData.updatedAt || topicsData.updatedAt;
const publicPayload = {
  version: 2,
  updatedAt: generatedAt,
  canonicalUrl: `${SITE}/observatory/trends/`,
  methodology: {
    unit: "signal occurrences per observed headline",
    comparabilityRule: "Trend calculations use only one comparable series at a time: the same provider and sampling mode. Other snapshots remain visible but are excluded from the trend calculation.",
    seriesSelectionRule: "Choose the provider-and-sampling-mode series with the most snapshots; break ties by the most recent observation.",
    trendMethod: "ordinary least squares slope across chronological snapshot-level rates within the selected comparable series",
    trendThreshold: 0.03,
    minimumSnapshots: MIN_TREND_SNAPSHOTS,
    sourceComparisonUnit: "signal occurrences per unique headline URL",
    minimumUniqueHeadlinesPerSource: MIN_SOURCE_HEADLINES,
    warning: "These measurements describe visible headline wording in provider samples. They do not measure truth, intent, outlet quality, audience effects or psychological bias."
  },
  topics: topicSeries,
  sources: sourceProfiles
};

await mkdir(DATA_OUT, { recursive: true });
await writeFile(join(DATA_OUT, "observatory-trends.json"), `${JSON.stringify(publicPayload, null, 2)}\n`);
const ndjson = topicSeries.flatMap((topic) => topic.series.map((point) => JSON.stringify({
  type: "observatory-trend-point",
  topicSlug: topic.slug,
  topicTitle: topic.title,
  comparisonKey: topic.comparisonKey,
  trendReady: topic.trendReady,
  ...point
}))).join("\n");
await writeFile(join(DATA_OUT, "observatory-trends.ndjson"), ndjson ? `${ndjson}\n` : "");

async function emit(relativePath, html) {
  const target = join(OUT, relativePath.replace(/^\//, ""), "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}
function baseHead(title, description, canonical, schema) {
  return `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}
function metric(label, value, note) {
  return `<article class="obs-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><p>${escapeHtml(note)}</p></article>`;
}
function rate(value) { return Number(value || 0).toFixed(2); }

const trendsCanonical = `${SITE}/observatory/trends/`;
const trendSchema = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "Cognitive Bias Observatory Trends",
  description: "Time-series measurements of visible framing and cognitive-pressure signals in comparable headline samples.",
  url: trendsCanonical,
  dateModified: generatedAt,
  creator: { "@type": "Organization", name: "Cognitive Biases", url: SITE },
  measurementTechnique: publicPayload.methodology.trendMethod,
  distribution: [
    { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}/data/observatory-trends.json` },
    { "@type": "DataDownload", encodingFormat: "application/x-ndjson", contentUrl: `${SITE}/data/observatory-trends.ndjson` }
  ]
};
const topicCards = topicSeries.map((topic) => `<article class="obs-card"><p class="kicker">${topic.trendReady ? "Trend ready" : "Building comparable history"}</p><h2><a href="/observatory/topics/${topic.slug}/">${escapeHtml(topic.title)}</a></h2><p>${escapeHtml(topic.description)}</p><p><strong>${topic.snapshotCount}</strong> comparable snapshot(s) · <strong>${topic.observationCount}</strong> headline observations</p><p>${topic.excludedSnapshotCount ? `${topic.excludedSnapshotCount} snapshot(s) kept outside the trend because the provider or sampling mode differs. ` : ""}${topic.trendReady ? "Trend slopes are published." : `${topic.snapshotsNeeded} more comparable snapshot(s) required before a direction is reported.`}</p></article>`).join("");
const trendsHtml = `<!doctype html><html lang="en"><head>${baseHead("Cognitive Bias Trends | Observatory", "Track framing, certainty, salience and related headline signals over repeated comparable Observatory snapshots, with minimum-history rules.", trendsCanonical, trendSchema)}</head><body><a class="skip" href="#main">Skip to content</a>${header()}<main id="main"><section class="page-hero obs-hero"><p class="eyebrow">Observatory Trends</p><h1>Compare like with like before calling something a trend.</h1><p class="lede">Each point is normalized per headline. A topic needs at least ${MIN_TREND_SNAPSHOTS} snapshots from the same provider and sampling mode before we publish a direction.</p><p class="obs-warning"><strong>Comparability rule:</strong> Curated demonstrations, provider search samples and other collection modes are not merged into one trend line. A rising cue rate still describes only the selected provider sample, not a change in society or psychological bias.</p></section><section class="section"><p class="kicker">Tracked topics</p><div class="obs-grid">${topicCards}</div></section><section class="section section--ink"><p class="kicker">Compare sources carefully</p><h2>Source profiles have an even higher minimum.</h2><p class="lede">A domain needs at least ${MIN_SOURCE_HEADLINES} unique observed headlines before we publish its descriptive signal rates.</p><p><a class="button" href="/observatory/sources/">Open source comparisons</a> <a class="button" href="/data/observatory-trends.json">Open trend data</a></p></section></main>${footer()}</body></html>`;
await emit("/observatory/trends/", trendsHtml);

for (const topic of topicSeries) {
  const canonical = `${SITE}/observatory/topics/${topic.slug}/`;
  const schema = { "@context": "https://schema.org", "@type": "Dataset", name: `${topic.title} Observatory trend series`, description: topic.description, url: canonical, dateModified: generatedAt, creator: { "@type": "Organization", name: "Cognitive Biases", url: SITE } };
  const rows = topic.series.length ? topic.series.map((point) => `<tr><td><a href="/observatory/${point.snapshotId}/">${escapeHtml(point.date)}</a></td><td>${point.recordCount}</td><td>${rate(point.rates.gainFrame)}</td><td>${rate(point.rates.lossFrame)}</td><td>${rate(point.rates.uncertainty)}</td><td>${rate(point.rates.certainty)}</td><td>${rate(point.rates.salience)}</td><td>${rate(point.sourceDiversity)}</td></tr>`).join("") : `<tr><td colspan="8">No comparable snapshots collected yet.</td></tr>`;
  const trendBlock = topic.trendReady ? `<div class="obs-metrics">${metric("Gain cues", topic.trends.gainFrame.direction, `slope ${topic.trends.gainFrame.slope}`)}${metric("Loss cues", topic.trends.lossFrame.direction, `slope ${topic.trends.lossFrame.slope}`)}${metric("Uncertainty", topic.trends.uncertainty.direction, `slope ${topic.trends.uncertainty.slope}`)}${metric("Salience", topic.trends.salience.direction, `slope ${topic.trends.salience.slope}`)}</div>` : `<p class="obs-warning"><strong>Trend status: insufficient comparable history.</strong> ${topic.snapshotCount} of ${MIN_TREND_SNAPSHOTS} required snapshots are available in the selected provider + sampling-mode series. No direction is reported yet.</p>`;
  const excludedNote = topic.excludedSnapshotCount ? `<p class="obs-warning"><strong>${topic.excludedSnapshotCount} snapshot(s) excluded from this trend.</strong> They remain in the Observatory dataset, but use a different provider or sampling mode and are not mathematically merged into this series.</p>` : "";
  const html = `<!doctype html><html lang="en"><head>${baseHead(`${topic.title} Trends | Cognitive Bias Observatory`, `Follow headline-level framing and cognitive-pressure signals over time for ${topic.title}, using comparable provider samples and transparent minimum-history rules.`, canonical, schema)}</head><body><a class="skip" href="#main">Skip to content</a>${header()}<main id="main"><section class="page-hero obs-hero"><p class="eyebrow"><a href="/observatory/trends/">Observatory Trends</a></p><h1>${escapeHtml(topic.title)}</h1><p class="lede">${escapeHtml(topic.description)}</p>${trendBlock}${excludedNote}</section><section class="section"><p class="kicker">Comparable time series</p><h2>Rates per observed headline</h2><p>Raw counts are not compared across weeks because snapshot sizes can differ. This table uses only <strong>${escapeHtml(topic.comparableProvider || "no provider yet")}</strong> with sampling mode <strong>${escapeHtml(topic.comparableSamplingMode || "not available")}</strong>.</p><div class="obs-table-wrap"><table class="obs-table"><thead><tr><th>Date</th><th>Headlines</th><th>Gain</th><th>Loss</th><th>Uncertainty</th><th>Certainty</th><th>Salience</th><th>Source diversity</th></tr></thead><tbody>${rows}</tbody></table></div></section><section class="section section--ink"><p class="kicker">Method</p><h2>Trend direction uses the whole comparable series.</h2><p class="lede">Once ${MIN_TREND_SNAPSHOTS} comparable snapshots exist, direction is based on the ordinary least squares slope across chronological snapshot rates, not just the first and last week.</p><p><a class="button" href="/observatory/methodology/">Measurement methodology</a></p></section></main>${footer()}</body></html>`;
  await emit(`/observatory/topics/${topic.slug}/`, html);
}

const readySources = sourceProfiles.filter((source) => source.comparisonReady);
const sourcesCanonical = `${SITE}/observatory/sources/`;
const sourceSchema = { "@context": "https://schema.org", "@type": "Dataset", name: "Cognitive Bias Observatory source comparisons", description: "Descriptive headline-signal rates for sources with enough unique observed headlines.", url: sourcesCanonical, dateModified: generatedAt, creator: { "@type": "Organization", name: "Cognitive Biases", url: SITE } };
const sourceRows = readySources.length ? readySources.map((source) => `<tr><td>${escapeHtml(source.domain)}</td><td>${source.headlineCount}</td><td>${source.topicCount}</td><td>${rate(source.rates.gainFrame)}</td><td>${rate(source.rates.lossFrame)}</td><td>${rate(source.rates.uncertainty)}</td><td>${rate(source.rates.salience)}</td></tr>`).join("") : `<tr><td colspan="7">No source has reached the ${MIN_SOURCE_HEADLINES}-headline publication threshold yet.</td></tr>`;
const sourceHtml = `<!doctype html><html lang="en"><head>${baseHead("Source Comparisons | Cognitive Bias Observatory", "Compare descriptive headline-signal rates only after a source reaches a minimum number of unique observed headlines.", sourcesCanonical, sourceSchema)}</head><body><a class="skip" href="#main">Skip to content</a>${header()}<main id="main"><section class="page-hero obs-hero"><p class="eyebrow">Observatory Sources</p><h1>Compare wording patterns only when there is enough material.</h1><p class="lede">A source profile appears only after at least ${MIN_SOURCE_HEADLINES} unique headline URLs have been observed. The rates describe this dataset, not an outlet's overall quality, ideology, truthfulness or psychology.</p></section><section class="section"><p class="kicker">Eligible source profiles</p><div class="obs-table-wrap"><table class="obs-table"><thead><tr><th>Domain</th><th>Headlines</th><th>Topics</th><th>Gain</th><th>Loss</th><th>Uncertainty</th><th>Salience</th></tr></thead><tbody>${sourceRows}</tbody></table></div><p>${sourceProfiles.length} domain(s) have been observed in total; ${readySources.length} currently meet the publication threshold.</p></section><section class="section section--ink"><p class="kicker">Do not turn this into a league table</p><h2>Different topics produce different language.</h2><p class="lede">A source can look different because it covered different events. Cross-source differences are descriptive leads for further analysis, not rankings.</p><p><a class="button" href="/observatory/trends/">Back to Trends</a></p></section></main>${footer()}</body></html>`;
await emit("/observatory/sources/", sourceHtml);

const observatoryHubPath = join(OUT, "observatory", "index.html");
let observatoryHub = await readFile(observatoryHubPath, "utf8");
if (!observatoryHub.includes("observatory-trends-entry")) {
  const block = `<section class="section observatory-trends-entry"><p class="kicker">Longitudinal layer</p><h2>From snapshots to comparable trends.</h2><p class="lede">Follow the same measurement rules over repeated samples from the same provider and sampling mode. The Trends layer normalizes signals per headline and refuses to publish a direction before enough comparable history exists.</p><div class="obs-grid"><article class="obs-card"><h3><a href="/observatory/trends/">Trend dashboard</a></h3><p>${topics.length} tracked topics with minimum-history and comparability rules.</p></article><article class="obs-card"><h3><a href="/observatory/sources/">Source comparisons</a></h3><p>Descriptive source profiles appear only after ${MIN_SOURCE_HEADLINES} unique headlines.</p></article></div></section>`;
  observatoryHub = observatoryHub.replace("</main>", `${block}</main>`);
  await writeFile(observatoryHubPath, observatoryHub);
}

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".obs-table-wrap{")) {
  styles += `\n.obs-table-wrap{overflow-x:auto;margin-top:1.5rem;border:var(--line);background:#fff}.obs-table{width:100%;border-collapse:collapse;min-width:720px}.obs-table th,.obs-table td{padding:.8rem .9rem;border-bottom:1px solid #d7d7d7;text-align:left;vertical-align:top}.obs-table th{font-weight:900;text-transform:uppercase;font-size:.72rem;letter-spacing:.05em;background:#f4f2eb}.obs-table tbody tr:last-child td{border-bottom:0}.observatory-trends-entry h3{font:1.05rem/1.2 Archivo Black,sans-serif;margin:.25rem 0 .6rem}\n`;
  await writeFile(stylesPath, styles);
}

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
const urls = [`${SITE}/observatory/trends/`, `${SITE}/observatory/sources/`, ...topics.map((topic) => `${SITE}/observatory/topics/${topic.slug}/`)];
for (const url of urls) {
  if (sitemap.includes(`<loc>${url}</loc>`)) continue;
  const entry = `<url><loc>${url}</loc>${generatedAt ? `<lastmod>${String(generatedAt).slice(0, 10)}</lastmod>` : ""}</url>`;
  sitemap = sitemap.replace("</urlset>", `${entry}</urlset>`);
}
await writeFile(sitemapPath, sitemap);

console.log(`Observatory Trends generated: ${topics.length} topic series, ${topicSeries.filter((topic) => topic.trendReady).length} trend-ready, ${readySources.length} source profiles ready; provider/sampling comparability enforced.`);
