import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const SITE = "https://cognitive-biases.github.io";
const MIN_TREND_SNAPSHOTS = 3;
const MIN_SOURCE_HEADLINES = 5;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const topicsData = JSON.parse(await readFile("data/observatory-topics.json", "utf8"));
const snapshotsData = JSON.parse(await readFile("data/observatory-snapshots.json", "utf8"));
const trends = JSON.parse(await readFile(join(OUT, "data", "observatory-trends.json"), "utf8"));
const topics = topicsData.topics || [];
const snapshots = snapshotsData.snapshots || [];

assert(topicsData.version >= 2, "Observatory topic config must use the multi-topic version");
assert(topics.length >= 4, "Observatory Trends requires at least four tracked topics");
const slugs = new Set();
const queries = new Set();
for (const topic of topics) {
  assert(topic.slug && !slugs.has(topic.slug), `duplicate topic slug: ${topic.slug}`);
  slugs.add(topic.slug);
  assert(topic.title && topic.description, `${topic.slug}: missing human-readable metadata`);
  assert(topic.active === true, `${topic.slug}: launch topics must be active`);
  assert(topic.gdeltQuery && !queries.has(topic.gdeltQuery), `${topic.slug}: missing or duplicate provider query`);
  queries.add(topic.gdeltQuery);
  assert(topic.limitations && /sample/i.test(topic.limitations), `${topic.slug}: limitations must describe sampling`);
}
for (const snapshot of snapshots) assert(slugs.has(snapshot.topicSlug), `${snapshot.id}: snapshot references unknown topic`);

assert(trends.version === 1, "unexpected Observatory Trends version");
assert(trends.canonicalUrl === `${SITE}/observatory/trends/`, "trend canonical URL drift");
assert(trends.methodology?.minimumSnapshots === MIN_TREND_SNAPSHOTS, "trend minimum-history threshold drift");
assert(trends.methodology?.minimumUniqueHeadlinesPerSource === MIN_SOURCE_HEADLINES, "source comparison threshold drift");
assert(/do not measure truth/i.test(trends.methodology?.warning || ""), "trend data must preserve interpretation boundary");
assert(Array.isArray(trends.topics) && trends.topics.length === topics.length, "public trend data must cover every configured topic");

let expectedTrendPoints = 0;
for (const topic of trends.topics) {
  const source = topics.find((item) => item.slug === topic.slug);
  assert(source, `public trend data has unknown topic ${topic.slug}`);
  const expectedSnapshots = snapshots.filter((snapshot) => snapshot.topicSlug === topic.slug).length;
  assert(topic.snapshotCount === expectedSnapshots, `${topic.slug}: snapshot count drift`);
  assert(topic.series.length === expectedSnapshots, `${topic.slug}: series count drift`);
  expectedTrendPoints += topic.series.length;
  assert(topic.trendReady === (expectedSnapshots >= MIN_TREND_SNAPSHOTS), `${topic.slug}: trend readiness threshold violated`);
  if (!topic.trendReady) {
    assert(topic.readiness === "insufficient-history", `${topic.slug}: insufficient history must be explicit`);
    for (const result of Object.values(topic.trends || {})) {
      assert(result.slope === null && result.direction === "not-ready", `${topic.slug}: must not publish a direction before ${MIN_TREND_SNAPSHOTS} snapshots`);
    }
  }
  for (const point of topic.series) {
    assert(point.recordCount >= 0, `${topic.slug}: invalid record count`);
    assert(point.rates && typeof point.rates.gainFrame === "number", `${topic.slug}: missing normalized rates`);
    assert(point.sourceDiversity >= 0 && point.sourceDiversity <= 1, `${topic.slug}: invalid source diversity`);
  }
  const pagePath = join(OUT, "observatory", "topics", topic.slug, "index.html");
  await access(pagePath);
  const page = await readFile(pagePath, "utf8");
  assert(page.includes(`<link rel="canonical" href="${SITE}/observatory/topics/${topic.slug}/">`), `${topic.slug}: canonical missing`);
  assert(page.includes('application/ld+json'), `${topic.slug}: Dataset structured data missing`);
  assert(page.includes("Rates per observed headline"), `${topic.slug}: normalized-rate explanation missing`);
  if (!topic.trendReady) assert(page.includes("insufficient history"), `${topic.slug}: page must show insufficient-history state`);
}

const ndjson = (await readFile(join(OUT, "data", "observatory-trends.ndjson"), "utf8")).trim();
const lines = ndjson ? ndjson.split("\n") : [];
assert(lines.length === expectedTrendPoints, "trend NDJSON line count drift");
for (const line of lines) assert(JSON.parse(line).type === "observatory-trend-point", "invalid trend NDJSON record type");

for (const source of trends.sources || []) {
  assert(source.comparisonReady === (source.headlineCount >= MIN_SOURCE_HEADLINES), `${source.domain}: source readiness threshold violated`);
  assert(source.rates && typeof source.rates.lossFrame === "number", `${source.domain}: source rates missing`);
}

const trendsPage = await readFile(join(OUT, "observatory", "trends", "index.html"), "utf8");
const sourcesPage = await readFile(join(OUT, "observatory", "sources", "index.html"), "utf8");
const observatoryHub = await readFile(join(OUT, "observatory", "index.html"), "utf8");
const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
const llms = await readFile("llms.txt", "utf8");
for (const [name, html, canonical] of [
  ["Trends", trendsPage, `${SITE}/observatory/trends/`],
  ["Sources", sourcesPage, `${SITE}/observatory/sources/`]
]) {
  assert(html.includes(`<link rel="canonical" href="${canonical}">`), `${name}: canonical missing`);
  assert(html.includes('application/ld+json'), `${name}: structured data missing`);
  assert(!/most biased|bias ranking|bias score/i.test(html), `${name}: diagnostic/ranking language leaked`);
  assert(sitemap.includes(`<loc>${canonical}</loc>`), `${name}: sitemap entry missing`);
}
assert(observatoryHub.includes("observatory-trends-entry"), "Observatory hub must surface Trends");
assert(observatoryHub.includes('/observatory/sources/'), "Observatory hub must surface source comparisons");
for (const topic of topics) assert(sitemap.includes(`<loc>${SITE}/observatory/topics/${topic.slug}/</loc>`), `${topic.slug}: topic page missing from sitemap`);
assert(llms.includes(`${SITE}/observatory/trends/`), "llms.txt must expose Observatory Trends");
assert(llms.includes(`${SITE}/data/observatory-trends.json`), "llms.txt must expose trend data");
assert(llms.includes("minimum of 3 snapshots"), "llms.txt must preserve trend readiness rule");
assert(llms.includes("minimum of 5 unique headlines"), "llms.txt must preserve source comparison rule");

console.log(`Observatory Trends check passed: ${topics.length} topics, ${expectedTrendPoints} trend point(s), ${(trends.sources || []).filter((source) => source.comparisonReady).length} source profile(s) ready.`);
