import { readFile, writeFile } from "node:fs/promises";

const topicsData = JSON.parse(await readFile("data/observatory-topics.json", "utf8"));
const snapshotsData = JSON.parse(await readFile("data/observatory-snapshots.json", "utf8"));
const softFail = process.argv.includes("--soft-fail");
const requested = process.argv.find((arg) => arg.startsWith("--topic="))?.split("=")[1] || "all";
const activeTopics = (topicsData.topics || []).filter((topic) => topic.active && (requested === "all" || requested === topic.slug));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const today = new Date().toISOString().slice(0, 10);

function gdeltDate(value) {
  const match = String(value || "").match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;
}
function normalizeArticle(article) {
  const url = String(article?.url || "").trim();
  const title = String(article?.title || "").replace(/\s+/g, " ").trim();
  if (!url || !title) return null;
  let domain = String(article?.domain || "").trim().toLowerCase();
  if (!domain) {
    try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch {}
  }
  return {
    url,
    title,
    domain,
    sourceName: domain || null,
    sourceCountry: String(article?.sourcecountry || "").trim() || null,
    language: String(article?.language || "").trim() || null,
    publishedAt: gdeltDate(article?.seendate),
    providerSeenAt: String(article?.seendate || "").trim() || null
  };
}
async function fetchJson(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "cognitive-bias-observatory/0.1 (+https://cognitive-biases.github.io/observatory/)" } });
      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 180)}`);
      if (!text.trim().startsWith("{")) throw new Error(`Non-JSON response: ${text.slice(0, 180)}`);
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(attempt * 6000);
    }
  }
  throw lastError;
}
async function collect(topic) {
  const params = new URLSearchParams({
    query: topic.gdeltQuery,
    mode: "artlist",
    maxrecords: String(topic.maxRecords || 100),
    timespan: `${topic.windowDays || 7}d`,
    sort: "datedesc",
    format: "json"
  });
  const endpoint = `https://api.gdeltproject.org/api/v2/doc/doc?${params}`;
  const payload = await fetchJson(endpoint);
  const articles = Array.isArray(payload?.articles) ? payload.articles : [];
  const seen = new Set();
  const records = [];
  for (const article of articles) {
    const record = normalizeArticle(article);
    if (!record || seen.has(record.url)) continue;
    seen.add(record.url);
    records.push(record);
  }
  if (!records.length) throw new Error(`${topic.slug}: GDELT returned no usable article metadata`);
  return {
    id: `${topic.slug}-gdelt-${today}`,
    topicSlug: topic.slug,
    title: `${topic.title}: weekly headline snapshot — ${today}`,
    collectedAt: new Date().toISOString(),
    provider: "gdelt-doc-2.0",
    samplingMode: "provider-search-sample",
    window: { start: `P${topic.windowDays || 7}D-before-collection`, end: today },
    query: topic.gdeltQuery,
    language: topic.language || "English",
    limitations: topic.limitations,
    records
  };
}

if (!activeTopics.length) {
  console.log(`No active Observatory topics matched --topic=${requested}.`);
  process.exit(0);
}

let changed = false;
for (const topic of activeTopics) {
  try {
    const snapshot = await collect(topic);
    const others = (snapshotsData.snapshots || []).filter((item) => item.id !== snapshot.id);
    const automated = others.filter((item) => item.topicSlug === topic.slug && item.provider === "gdelt-doc-2.0").sort((a, b) => String(b.collectedAt).localeCompare(String(a.collectedAt))).slice(0, 25);
    const keepAutomatedIds = new Set(automated.map((item) => item.id));
    snapshotsData.snapshots = others.filter((item) => item.provider !== "gdelt-doc-2.0" || item.topicSlug !== topic.slug || keepAutomatedIds.has(item.id));
    snapshotsData.snapshots.push(snapshot);
    snapshotsData.updatedAt = today;
    changed = true;
    console.log(`${topic.slug}: collected ${snapshot.records.length} GDELT headline records.`);
  } catch (error) {
    console.error(`${topic.slug}: collection failed: ${error.message}`);
    if (!softFail) throw error;
  }
  if (activeTopics.length > 1) await sleep(6000);
}

if (changed) {
  snapshotsData.snapshots.sort((a, b) => String(a.collectedAt).localeCompare(String(b.collectedAt)));
  await writeFile("data/observatory-snapshots.json", `${JSON.stringify(snapshotsData, null, 2)}\n`);
  console.log("Observatory snapshot file updated.");
} else {
  console.log("No Observatory data changed.");
}
