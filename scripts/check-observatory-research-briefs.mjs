import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const SITE = "https://cognitive-biases.github.io";
const MIN_BRIEF_SNAPSHOTS = 6;
const MIN_BRIEF_HEADLINES = 120;
const MIN_HEADLINES_PER_SNAPSHOT = 10;
const MIN_MEDIAN_DOMAINS = 5;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const trends = JSON.parse(await readFile(join(OUT, "data", "observatory-trends.json"), "utf8"));
const briefs = JSON.parse(await readFile(join(OUT, "data", "observatory-research-briefs.json"), "utf8"));
assert(briefs.version === 1, "unexpected Observatory research brief version");
assert(briefs.canonicalUrl === `${SITE}/research/observatory/`, "research brief canonical drift");
assert(briefs.methodology?.minimumComparableSnapshots === MIN_BRIEF_SNAPSHOTS, "brief snapshot threshold drift");
assert(briefs.methodology?.minimumTotalHeadlines === MIN_BRIEF_HEADLINES, "brief headline threshold drift");
assert(briefs.methodology?.minimumHeadlinesPerSnapshot === MIN_HEADLINES_PER_SNAPSHOT, "brief per-snapshot threshold drift");
assert(briefs.methodology?.minimumMedianUniqueDomains === MIN_MEDIAN_DOMAINS, "brief source-breadth threshold drift");
assert(/not a statistical significance test/i.test(briefs.methodology?.warning || ""), "brief methodology must reject significance overclaiming");
assert(Array.isArray(briefs.topics) && briefs.topics.length === (trends.topics || []).length, "brief readiness must cover every trend topic");

const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
let readyCount = 0;
for (const topic of briefs.topics) {
  const trend = trends.topics.find((item) => item.slug === topic.slug);
  assert(trend, `${topic.slug}: missing source trend`);
  assert(topic.comparisonKey === trend.comparisonKey, `${topic.slug}: brief comparison key drift`);
  const expectedReady = topic.requirements.comparableSnapshots.met && topic.requirements.totalHeadlines.met && topic.requirements.headlinesPerSnapshot.met && topic.requirements.medianUniqueDomains.met;
  assert(topic.briefReady === expectedReady, `${topic.slug}: brief readiness rule violated`);
  if (!topic.briefReady) {
    assert(topic.readiness === "insufficient-evidence-window", `${topic.slug}: non-ready state must be explicit`);
    assert(topic.findings.length === 0, `${topic.slug}: findings must not publish before readiness`);
    assert(Object.keys(topic.metrics || {}).length === 0, `${topic.slug}: metric conclusions must not publish before readiness`);
    assert(topic.canonicalUrl === null, `${topic.slug}: non-ready topic must not claim a brief canonical`);
    assert(!sitemap.includes(`<loc>${SITE}/research/observatory/${topic.slug}/</loc>`), `${topic.slug}: non-ready brief must not enter sitemap`);
  } else {
    readyCount += 1;
    assert(topic.coverage.snapshotCount >= MIN_BRIEF_SNAPSHOTS, `${topic.slug}: ready brief lacks history`);
    assert(topic.coverage.totalHeadlines >= MIN_BRIEF_HEADLINES, `${topic.slug}: ready brief lacks volume`);
    const path = join(OUT, "research", "observatory", topic.slug, "index.html");
    await access(path);
    const html = await readFile(path, "utf8");
    assert(html.includes(`<link rel="canonical" href="${topic.canonicalUrl}">`), `${topic.slug}: brief canonical missing`);
    assert(html.includes('"@type":"Article"'), `${topic.slug}: Article structured data missing`);
    assert(html.includes("Interpretation boundary"), `${topic.slug}: interpretation boundary missing`);
    assert(html.includes("brief-spark") || /roughly stable/i.test(html), `${topic.slug}: brief must show chart or stable-result explanation`);
    assert(sitemap.includes(`<loc>${topic.canonicalUrl}</loc>`), `${topic.slug}: ready brief missing from sitemap`);
  }
}

const hub = await readFile(join(OUT, "research", "observatory", "index.html"), "utf8");
assert(hub.includes(`<link rel="canonical" href="${SITE}/research/observatory/">`), "brief hub canonical missing");
assert(hub.includes("not a statistical significance test"), "brief hub must explain readiness boundary");
assert(hub.includes(`${MIN_BRIEF_SNAPSHOTS} comparable snapshots`), "brief hub must show snapshot threshold");
assert(hub.includes(`${MIN_BRIEF_HEADLINES} headlines`), "brief hub must show headline threshold");
assert(sitemap.includes(`<loc>${SITE}/research/observatory/</loc>`), "brief hub missing from sitemap");
const researchHub = await readFile(join(OUT, "research", "index.html"), "utf8");
const observatoryHub = await readFile(join(OUT, "observatory", "index.html"), "utf8");
assert(researchHub.includes("observatory-briefs-entry"), "Research hub must surface Observatory briefs");
assert(observatoryHub.includes("observatory-briefs-entry"), "Observatory hub must surface research briefs");

const ndjson = (await readFile(join(OUT, "data", "observatory-research-briefs.ndjson"), "utf8")).trim().split("\n").filter(Boolean);
assert(ndjson.length === briefs.topics.length, "brief NDJSON must include one readiness record per topic");
for (const line of ndjson) assert(JSON.parse(line).type === "observatory-research-brief-readiness", "invalid brief NDJSON record type");

const llms = await readFile("llms.txt", "utf8");
assert(llms.includes(`${SITE}/research/observatory/`), "llms.txt must expose Observatory research briefs");
assert(llms.includes(`${SITE}/data/observatory-research-briefs.json`), "llms.txt must expose research brief data");
assert(llms.includes("minimum of 6 comparable snapshots"), "llms.txt must preserve brief snapshot threshold");
assert(llms.includes("not a statistical significance test"), "llms.txt must preserve brief inference boundary");

console.log(`Observatory Research Briefs check passed: ${briefs.topics.length} topics tracked, ${readyCount} brief(s) ready.`);
