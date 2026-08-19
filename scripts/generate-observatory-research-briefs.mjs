import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const DATA_OUT = join(OUT, "data");
const MIN_BRIEF_SNAPSHOTS = 6;
const MIN_BRIEF_HEADLINES = 120;
const MIN_HEADLINES_PER_SNAPSHOT = 10;
const MIN_MEDIAN_DOMAINS = 5;
const DIRECTION_THRESHOLD = 0.03;

const trends = JSON.parse(await readFile(join(DATA_OUT, "observatory-trends.json"), "utf8"));
const observatory = JSON.parse(await readFile(join(DATA_OUT, "observatory.json"), "utf8"));
const topics = trends.topics || [];
const snapshotById = new Map((observatory.snapshots || []).map((snapshot) => [snapshot.id, snapshot]));
const updatedAt = trends.updatedAt || observatory.updatedAt;
const rateLabels = {
  gainFrame: "gain-frame cues",
  lossFrame: "loss-frame cues",
  uncertainty: "uncertainty cues",
  certainty: "certainty cues",
  salience: "salience cues",
  authority: "authority cues",
  socialProof: "social-proof cues",
  numericalEmphasis: "numerical emphasis",
  questionForm: "question-form headlines"
};
const rateKeys = Object.keys(rateLabels);

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);
const round = (value, digits = 3) => Number(Number(value || 0).toFixed(digits));
const rate = (value) => Number(value || 0).toFixed(2);
const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
function slope(values) {
  if (values.length < 2) return null;
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
function direction(value) {
  if (value === null) return "not-ready";
  if (value > DIRECTION_THRESHOLD) return "increasing";
  if (value < -DIRECTION_THRESHOLD) return "decreasing";
  return "roughly-stable";
}
function brand(size, alt) {
  return `<picture class="brand-picture"><source type="image/webp" srcset="/assets/brand.webp"><img src="/assets/biases_icon.png" width="${size}" height="${size}" alt="${escapeHtml(alt)}"></picture>`;
}
function header() {
  return `<header class="site-header"><a class="brand" href="/">${brand(48, "Cognitive Biases icon")}<span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/everyday/">Everyday life</a><a href="/explore/">Explore</a><a href="/experiments/">Experiments</a><a href="/observatory/">Observatory</a><a href="/research/" aria-current="page">Research</a><a class="nav-cta" href="/data/">Data</a></nav></header>`;
}
function footer() {
  return `<footer class="site-footer"><div><a class="brand brand--footer" href="/">${brand(40, "")}<span>Cognitive Biases</span></a><p>A public guide to cognitive biases, evidence and better decisions.</p></div><div class="footer-links"><a href="/research/observatory/">Observatory research briefs</a><a href="/observatory/trends/">Trends</a><a href="/observatory/methodology/">Observatory methodology</a><a href="/research/">Research</a><a href="/data/">Data</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p></footer>`;
}
function baseHead(title, description, canonical, schema, robots = "index,follow,max-image-preview:large,max-snippet:-1") {
  return `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><meta name="robots" content="${robots}"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}
async function emit(relativePath, html) {
  const target = join(OUT, relativePath.replace(/^\//, ""), "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}
function sparkline(values, label) {
  const width = 360;
  const height = 110;
  const pad = 14;
  if (!values.length) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : pad + (index / (values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((value - min) / span) * (height - pad * 2);
    return `${round(x, 1)},${round(y, 1)}`;
  }).join(" ");
  const last = points.split(" ").at(-1).split(",");
  return `<svg class="brief-spark" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(label)}"><line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" class="brief-axis"></line><polyline points="${points}" class="brief-line" fill="none"></polyline><circle cx="${last[0]}" cy="${last[1]}" r="4" class="brief-dot"></circle></svg>`;
}
function nearDuplicateRate(topic) {
  const rates = [];
  for (const point of topic.series || []) {
    const snapshot = snapshotById.get(point.snapshotId);
    const pairs = snapshot?.summary?.nearDuplicatePairs?.length || 0;
    rates.push(point.recordCount ? round(pairs / point.recordCount) : 0);
  }
  return rates;
}

const briefTopics = topics.map((topic) => {
  const series = topic.series || [];
  const totalHeadlines = series.reduce((sum, point) => sum + Number(point.recordCount || 0), 0);
  const medianDomains = round(median(series.map((point) => Number(point.uniqueDomains || 0))), 1);
  const everySnapshotHasVolume = series.length > 0 && series.every((point) => Number(point.recordCount || 0) >= MIN_HEADLINES_PER_SNAPSHOT);
  const requirements = {
    comparableSnapshots: { required: MIN_BRIEF_SNAPSHOTS, actual: series.length, met: series.length >= MIN_BRIEF_SNAPSHOTS },
    totalHeadlines: { required: MIN_BRIEF_HEADLINES, actual: totalHeadlines, met: totalHeadlines >= MIN_BRIEF_HEADLINES },
    headlinesPerSnapshot: { required: MIN_HEADLINES_PER_SNAPSHOT, met: everySnapshotHasVolume },
    medianUniqueDomains: { required: MIN_MEDIAN_DOMAINS, actual: medianDomains, met: medianDomains >= MIN_MEDIAN_DOMAINS }
  };
  const briefReady = Object.values(requirements).every((item) => item.met === true);
  const reasons = Object.entries(requirements).filter(([, value]) => !value.met).map(([key]) => key);
  const first = series[0] || null;
  const latest = series.at(-1) || null;
  const metricDetails = Object.fromEntries(rateKeys.map((key) => {
    const values = series.map((point) => Number(point.rates?.[key] || 0));
    const metricSlope = topic.trends?.[key]?.slope ?? slope(values);
    return [key, {
      label: rateLabels[key],
      startRate: first ? round(first.rates?.[key] || 0) : null,
      latestRate: latest ? round(latest.rates?.[key] || 0) : null,
      delta: first && latest ? round((latest.rates?.[key] || 0) - (first.rates?.[key] || 0)) : null,
      slope: metricSlope,
      direction: briefReady ? direction(metricSlope) : "not-published"
    }];
  }));
  const diversityValues = series.map((point) => Number(point.sourceDiversity || 0));
  const repetitionValues = nearDuplicateRate(topic);
  const rankedFindings = briefReady ? Object.entries(metricDetails)
    .filter(([, detail]) => detail.direction !== "roughly-stable")
    .sort((a, b) => Math.abs(b[1].slope || 0) - Math.abs(a[1].slope || 0))
    .slice(0, 3)
    .map(([key, detail]) => ({
      metric: key,
      label: detail.label,
      direction: detail.direction,
      slopePerSnapshot: detail.slope,
      startRate: detail.startRate,
      latestRate: detail.latestRate,
      delta: detail.delta,
      statement: `Within the selected comparable provider series, ${detail.label} were ${detail.direction} across the observed snapshots. This is a descriptive pattern in the sample, not evidence of audience effects or psychological bias.`
    })) : [];
  return {
    slug: topic.slug,
    title: topic.title,
    description: topic.description,
    comparisonKey: topic.comparisonKey,
    provider: topic.comparableProvider,
    samplingMode: topic.comparableSamplingMode,
    briefReady,
    readiness: briefReady ? "ready" : "insufficient-evidence-window",
    requirements,
    reasons,
    coverage: {
      firstDate: first?.date || null,
      latestDate: latest?.date || null,
      snapshotCount: series.length,
      totalHeadlines,
      medianUniqueDomains: medianDomains,
      sourceDiversityStart: first ? first.sourceDiversity : null,
      sourceDiversityLatest: latest ? latest.sourceDiversity : null,
      sourceDiversitySlope: briefReady ? slope(diversityValues) : null,
      nearDuplicatePairsPerHeadlineStart: first ? repetitionValues[0] : null,
      nearDuplicatePairsPerHeadlineLatest: latest ? repetitionValues.at(-1) : null
    },
    findings: rankedFindings,
    metrics: briefReady ? metricDetails : {},
    canonicalUrl: briefReady ? `${SITE}/research/observatory/${topic.slug}/` : null,
    trendUrl: `${SITE}/observatory/topics/${topic.slug}/`
  };
});

const publicPayload = {
  version: 1,
  updatedAt,
  canonicalUrl: `${SITE}/research/observatory/`,
  methodology: {
    purpose: "Generate descriptive research briefs only after a topic has enough comparable repeated observations for a useful longitudinal summary.",
    comparableSeriesRule: trends.methodology?.comparabilityRule,
    minimumComparableSnapshots: MIN_BRIEF_SNAPSHOTS,
    minimumTotalHeadlines: MIN_BRIEF_HEADLINES,
    minimumHeadlinesPerSnapshot: MIN_HEADLINES_PER_SNAPSHOT,
    minimumMedianUniqueDomains: MIN_MEDIAN_DOMAINS,
    directionThreshold: DIRECTION_THRESHOLD,
    warning: "Brief readiness is a publication rule, not a statistical significance test. Observatory samples are provider search samples rather than probability samples, so the briefs report descriptive changes and do not infer population effects, causality, intent or psychological bias."
  },
  topics: briefTopics
};

await mkdir(DATA_OUT, { recursive: true });
await writeFile(join(DATA_OUT, "observatory-research-briefs.json"), `${JSON.stringify(publicPayload, null, 2)}\n`);
await writeFile(join(DATA_OUT, "observatory-research-briefs.ndjson"), `${briefTopics.map((topic) => JSON.stringify({ type: "observatory-research-brief-readiness", ...topic })).join("\n")}\n`);

const readyBriefs = briefTopics.filter((topic) => topic.briefReady);
const hubCanonical = `${SITE}/research/observatory/`;
const hubSchema = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "CollectionPage", name: "Cognitive Bias Observatory Research Briefs", url: hubCanonical, description: "Longitudinal research briefs generated only after comparable Observatory samples meet published readiness thresholds." },
    { "@type": "ItemList", itemListElement: readyBriefs.map((topic, index) => ({ "@type": "ListItem", position: index + 1, url: topic.canonicalUrl, name: topic.title })) }
  ]
};
const cards = briefTopics.map((topic) => `<article class="obs-card"><p class="kicker">${topic.briefReady ? "Brief ready" : "Building evidence window"}</p><h2>${topic.briefReady ? `<a href="/research/observatory/${topic.slug}/">${escapeHtml(topic.title)}</a>` : escapeHtml(topic.title)}</h2><p>${escapeHtml(topic.description)}</p><p><strong>${topic.coverage.snapshotCount}</strong> / ${MIN_BRIEF_SNAPSHOTS} comparable snapshots · <strong>${topic.coverage.totalHeadlines}</strong> / ${MIN_BRIEF_HEADLINES} headlines</p><p>${topic.briefReady ? "A descriptive research brief is published." : `Waiting on: ${topic.reasons.map((reason) => reason.replace(/([A-Z])/g, " $1").toLowerCase()).join(", ")}.`}</p></article>`).join("");
const hubHtml = `<!doctype html><html lang="en"><head>${baseHead("Observatory Research Briefs | Cognitive Biases", "Evidence-gated longitudinal briefs from the Cognitive Bias Observatory, with comparable sampling, public thresholds and machine-readable outputs.", hubCanonical, hubSchema)}</head><body><a class="skip" href="#main">Skip to content</a>${header()}<main id="main"><section class="page-hero"><p class="eyebrow">Observatory Research Briefs</p><h1>Publish a finding only after the evidence window is useful.</h1><p class="lede">These briefs turn repeated Observatory snapshots into readable summaries. A topic needs at least ${MIN_BRIEF_SNAPSHOTS} comparable snapshots, ${MIN_BRIEF_HEADLINES} headlines in total, ${MIN_HEADLINES_PER_SNAPSHOT} headlines in every included snapshot and a median of ${MIN_MEDIAN_DOMAINS} unique domains.</p><p class="obs-warning"><strong>Important:</strong> This is a publication-readiness rule, not a statistical significance test. The data are provider search samples, so briefs describe the observed information environment and do not estimate population effects.</p></section><section class="section"><p class="kicker">Current readiness</p><div class="obs-grid">${cards}</div></section><section class="section section--ink"><p class="kicker">Open research data</p><h2>Every brief has a machine-readable twin.</h2><p class="lede">Agents can inspect readiness, thresholds, coverage, comparison keys and findings without scraping the page.</p><p><a class="button" href="/data/observatory-research-briefs.json">Open brief data</a> <a class="button" href="/observatory/trends/">Open Trends</a></p></section></main>${footer()}</body></html>`;
await emit("/research/observatory/", hubHtml);

for (const topic of readyBriefs) {
  const canonical = topic.canonicalUrl;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Article", headline: `${topic.title}: Observatory research brief`, description: topic.description, url: canonical, dateModified: updatedAt, author: { "@type": "Organization", name: "Cognitive Biases", url: SITE }, about: { "@type": "Thing", name: topic.title } },
      { "@type": "Dataset", name: `${topic.title} comparable Observatory series`, url: topic.trendUrl, measurementTechnique: trends.methodology?.trendMethod }
    ]
  };
  const trendTopic = topics.find((item) => item.slug === topic.slug);
  const findings = topic.findings.length ? topic.findings.map((finding) => `<article class="brief-finding"><p class="kicker">${escapeHtml(finding.direction)}</p><h2>${escapeHtml(finding.label)}</h2><p>${escapeHtml(finding.statement)}</p><p><strong>Start:</strong> ${rate(finding.startRate)} · <strong>Latest:</strong> ${rate(finding.latestRate)} · <strong>OLS slope:</strong> ${finding.slopePerSnapshot}</p>${sparkline((trendTopic?.series || []).map((point) => Number(point.rates?.[finding.metric] || 0)), `${finding.label} across ${topic.coverage.snapshotCount} comparable snapshots`)}</article>`).join("") : `<p>No measured cue exceeded the published direction threshold. That is still a result: the observed rates were roughly stable under this descriptive rule.</p>`;
  const html = `<!doctype html><html lang="en"><head>${baseHead(`${topic.title}: Observatory Research Brief | Cognitive Biases`, `A descriptive longitudinal research brief about ${topic.title}, based only on comparable Observatory provider samples that meet published readiness thresholds.`, canonical, graph)}</head><body><a class="skip" href="#main">Skip to content</a>${header()}<main id="main"><section class="page-hero"><p class="eyebrow"><a href="/research/observatory/">Observatory Research Briefs</a></p><h1>${escapeHtml(topic.title)}: what changed in the observed headline sample?</h1><p class="lede">This brief covers ${topic.coverage.snapshotCount} comparable snapshots and ${topic.coverage.totalHeadlines} headlines from ${escapeHtml(topic.provider || "the selected provider")}, using sampling mode ${escapeHtml(topic.samplingMode || "unknown")}.</p><p class="obs-warning"><strong>Interpretation boundary:</strong> The findings describe visible wording in this provider series. They do not show causality, audience effects, author intent, outlet quality or a cognitive bias in people.</p></section><section class="section"><p class="kicker">Coverage</p><div class="obs-metrics"><article class="obs-metric"><span>Period</span><strong>${escapeHtml(topic.coverage.firstDate)} → ${escapeHtml(topic.coverage.latestDate)}</strong><p>Comparable series only</p></article><article class="obs-metric"><span>Headlines</span><strong>${topic.coverage.totalHeadlines}</strong><p>Across ${topic.coverage.snapshotCount} snapshots</p></article><article class="obs-metric"><span>Median domains</span><strong>${topic.coverage.medianUniqueDomains}</strong><p>Unique domains per snapshot</p></article><article class="obs-metric"><span>Comparison key</span><strong>${escapeHtml(topic.comparisonKey)}</strong><p>Provider + sampling mode</p></article></div></section><section class="section"><p class="kicker">Descriptive findings</p>${findings}</section><section class="section"><p class="kicker">Coverage diagnostics</p><h2>Did source breadth or repeated wording move too?</h2><p>Source diversity changed from <strong>${rate(topic.coverage.sourceDiversityStart)}</strong> to <strong>${rate(topic.coverage.sourceDiversityLatest)}</strong>. Near-duplicate pairs per headline changed from <strong>${rate(topic.coverage.nearDuplicatePairsPerHeadlineStart)}</strong> to <strong>${rate(topic.coverage.nearDuplicatePairsPerHeadlineLatest)}</strong>. These are descriptive diagnostics, not quality scores.</p></section><section class="section section--ink"><p class="kicker">Reproduce it</p><h2>Start from the series, not this prose.</h2><p class="lede">The brief is a readable layer over public trend points, raw snapshots and explicit measurement rules.</p><p><a class="button" href="/observatory/topics/${topic.slug}/">Open topic series</a> <a class="button" href="/data/observatory-research-briefs.json">Open brief data</a></p></section></main>${footer()}</body></html>`;
  await emit(`/research/observatory/${topic.slug}/`, html);
}

for (const [target, block] of [
  [join(OUT, "research", "index.html"), `<section class="section observatory-briefs-entry"><p class="kicker">Longitudinal research</p><h2>Observatory Research Briefs</h2><p>Evidence-gated summaries turn comparable weekly headline samples into readable research only after the public readiness thresholds are met.</p><p><a href="/research/observatory/">See brief readiness →</a></p></section>`],
  [join(OUT, "observatory", "index.html"), `<section class="section observatory-briefs-entry"><p class="kicker">Research briefs</p><h2>When repeated snapshots become useful evidence.</h2><p>The research layer waits for six comparable snapshots and enough source breadth before publishing a longitudinal summary.</p><p><a href="/research/observatory/">See research brief readiness →</a></p></section>`]
]) {
  let html = await readFile(target, "utf8");
  if (!html.includes("observatory-briefs-entry")) {
    html = html.replace("</main>", `${block}</main>`);
    await writeFile(target, html);
  }
}

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".brief-finding{")) {
  styles += `\n.brief-finding{border-top:var(--line);padding:1.5rem 0}.brief-finding h2{margin:.25rem 0 .7rem}.brief-spark{display:block;width:min(100%,520px);height:auto;margin-top:1rem;border:1px solid #d7d7d7;background:#fff}.brief-axis{stroke:currentColor;stroke-width:1;opacity:.25}.brief-line{stroke:currentColor;stroke-width:3}.brief-dot{fill:currentColor}.observatory-briefs-entry{border-top:var(--line)}\n`;
  await writeFile(stylesPath, styles);
}

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
for (const url of [hubCanonical, ...readyBriefs.map((topic) => topic.canonicalUrl)]) {
  if (sitemap.includes(`<loc>${url}</loc>`)) continue;
  sitemap = sitemap.replace("</urlset>", `<url><loc>${url}</loc>${updatedAt ? `<lastmod>${String(updatedAt).slice(0, 10)}</lastmod>` : ""}</url></urlset>`);
}
await writeFile(sitemapPath, sitemap);

console.log(`Observatory Research Briefs generated: ${briefTopics.length} topics tracked, ${readyBriefs.length} brief(s) ready; readiness is descriptive, not a significance test.`);
