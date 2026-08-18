import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const CONFIG_PATH = "data/research-scout-config.json";
const INBOX_PATH = "data/research-inbox.json";
const USER_AGENT = "CognitiveBiasesResearchScout/1.0 (https://cognitive-biases.github.io/)";

const compact = (value = "") => String(value).replace(/\s+/g, " ").trim();
const decodeXml = (value = "") => compact(String(value)
  .replaceAll("&amp;", "&")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">")
  .replaceAll("&quot;", '"')
  .replaceAll("&#39;", "'"));
const tag = (xml, name) => decodeXml(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"))?.[1] || "");
const today = () => new Date().toISOString().slice(0, 10);
const slugPart = (value = "") => value.toLowerCase().replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(-90);

function relatedConcepts(candidate) {
  const text = `${candidate.title} ${candidate.summary || ""}`.toLowerCase();
  const related = new Set();
  if (/large language model|\bllm\b|artificial intelligence|\bai\b|agentic|ai agent/.test(text)) related.add("ai-assisted-decisions");
  if (/automation bias|automation reliance|decision aid/.test(text)) related.add("false-priors-automation-bias");
  if (/anthropomorph|humanlike|human-like|human robot|human-robot/.test(text)) related.add("availability-heuristic-anthropomorphism");
  if (/confirmation bias/.test(text)) related.add("cognitive-bias-confirmation-bias");
  if (/forecast|prediction|prospection/.test(text)) related.add("forecasting-future-choices");
  return [...related];
}

function scoreCandidate(candidate) {
  const text = `${candidate.title} ${candidate.summary || ""}`.toLowerCase();
  let score = 0;
  if (/cognitive bias|cognitive biases|decision bias|judgment bias|judgement bias/.test(text)) score += 3;
  if (/systematic review|meta-analysis|meta analysis|replication|registered report/.test(text)) score += 4;
  if (/large language model|\bllm\b|artificial intelligence|agentic|ai agent/.test(text)) score += 3;
  if (/decision making|decision-making|forecast|judgment|judgement|human-robot|automation bias|anthropomorph/.test(text)) score += 2;
  if (/benchmark|dataset|evaluation/.test(text)) score += 1;
  if (/editorial|opinion|commentary/.test(text)) score -= 2;
  return score;
}

function whyItMatters(candidate) {
  const text = `${candidate.title} ${candidate.summary || ""}`.toLowerCase();
  if (/systematic review|meta-analysis|meta analysis/.test(text)) return "Potentially high-signal review that may confirm, narrow, or challenge claims already in the library.";
  if (/replication|registered report/.test(text)) return "Potential replication evidence worth comparing with the current evidence status and qualifications.";
  if (/large language model|\bllm\b|artificial intelligence|agentic|ai agent/.test(text)) return "Potential update for the AI-assisted decisions research track; needs source review before changing any canonical claim.";
  if (/forecast|decision making|decision-making|judgment|judgement/.test(text)) return "Potentially relevant to practical decision contexts and evidence-reviewed bias entries.";
  return "Potential research update that passed the scout relevance threshold and needs editorial review.";
}

function parseArxiv(xml) {
  return xml.split("<entry>").slice(1).map((chunk) => chunk.split("</entry>")[0]).map((entry) => {
    const rawId = tag(entry, "id");
    const arxivId = rawId.split("/abs/").pop()?.replace(/v\d+$/, "") || slugPart(rawId);
    return {
      id: `arxiv-${arxivId}`,
      source: "arXiv",
      sourceType: "preprint",
      title: tag(entry, "title"),
      summary: tag(entry, "summary"),
      publishedAt: tag(entry, "published").slice(0, 10),
      url: `https://arxiv.org/abs/${arxivId}`
    };
  }).filter((item) => item.title && item.url);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.json();
}

async function collectArxiv(query) {
  const params = new URLSearchParams({ search_query: query, start: "0", max_results: "15", sortBy: "submittedDate", sortOrder: "descending" });
  const url = `https://export.arxiv.org/api/query?${params}`;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/atom+xml" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for arXiv query`);
  return parseArxiv(await response.text());
}

async function collectPubMed(query) {
  const search = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
  search.searchParams.set("db", "pubmed");
  search.searchParams.set("retmode", "json");
  search.searchParams.set("retmax", "20");
  search.searchParams.set("sort", "pub date");
  search.searchParams.set("term", query);
  search.searchParams.set("tool", "cognitive_biases_research_scout");
  const searchJson = await fetchJson(search);
  const ids = searchJson.esearchresult?.idlist || [];
  if (!ids.length) return [];

  const summary = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi");
  summary.searchParams.set("db", "pubmed");
  summary.searchParams.set("retmode", "json");
  summary.searchParams.set("id", ids.join(","));
  summary.searchParams.set("tool", "cognitive_biases_research_scout");
  const payload = await fetchJson(summary);
  return (payload.result?.uids || []).map((uid) => {
    const record = payload.result?.[uid] || {};
    const articleIds = record.articleids || [];
    const doi = articleIds.find((item) => item.idtype === "doi")?.value || null;
    return {
      id: `pubmed-${uid}`,
      source: "PubMed",
      sourceType: record.pubtype?.some((type) => /meta-analysis|systematic review/i.test(type)) ? "review" : "journal article",
      title: compact(record.title || ""),
      summary: "",
      publishedAt: compact(record.pubdate || ""),
      journal: compact(record.fulljournalname || ""),
      doi,
      url: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`
    };
  }).filter((item) => item.title);
}

function withinLookback(candidate, days) {
  const parsed = Date.parse(candidate.publishedAt || "");
  if (!Number.isFinite(parsed)) return true;
  return parsed >= Date.now() - days * 86400000;
}

function normalizeCandidate(candidate) {
  const related = relatedConcepts(candidate);
  return {
    id: candidate.id || `${candidate.source?.toLowerCase() || "source"}-${slugPart(candidate.url || candidate.title)}`,
    discoveredAt: today(),
    title: compact(candidate.title),
    url: candidate.url,
    source: candidate.source,
    sourceType: candidate.sourceType || "research",
    publishedAt: candidate.publishedAt || null,
    ...(candidate.journal ? { journal: candidate.journal } : {}),
    ...(candidate.doi ? { doi: candidate.doi } : {}),
    relatedConcepts: related,
    whyItMatters: whyItMatters(candidate),
    score: scoreCandidate(candidate),
    status: "new"
  };
}

function selfTest() {
  const sample = { title: "A systematic review of cognitive bias in large language models", summary: "A benchmark of decision making and automation bias." };
  assert.ok(scoreCandidate(sample) >= 10);
  assert.ok(relatedConcepts(sample).includes("ai-assisted-decisions"));
  assert.ok(relatedConcepts(sample).includes("false-priors-automation-bias"));
  const parsed = parseArxiv(`<feed><entry><id>http://arxiv.org/abs/2608.12345v2</id><published>2026-08-17T00:00:00Z</published><title> Cognitive bias in agents </title><summary> Test summary. </summary></entry></feed>`);
  assert.equal(parsed[0].id, "arxiv-2608.12345");
  assert.equal(parsed[0].url, "https://arxiv.org/abs/2608.12345");
  console.log("Research scout self-test passed.");
}

if (process.argv.includes("--self-test")) {
  selfTest();
  process.exit(0);
}

const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
const inbox = JSON.parse(await readFile(INBOX_PATH, "utf8"));
const collected = [];
let successfulSources = 0;

for (const query of config.arxivQueries || []) {
  try {
    collected.push(...await collectArxiv(query));
    successfulSources += 1;
  } catch (error) {
    console.warn(`arXiv scout warning: ${error.message}`);
  }
}
for (const query of config.pubmedQueries || []) {
  try {
    collected.push(...await collectPubMed(query));
    successfulSources += 1;
  } catch (error) {
    console.warn(`PubMed scout warning: ${error.message}`);
  }
}
if (!successfulSources) throw new Error("Research scout could not reach any configured source.");

const existingKeys = new Set((inbox.items || []).flatMap((item) => [item.id, item.url, item.doi].filter(Boolean).map((value) => String(value).toLowerCase())));
const candidateMap = new Map();
for (const raw of collected) {
  if (!withinLookback(raw, config.lookbackDays || 45)) continue;
  const candidate = normalizeCandidate(raw);
  if (candidate.score < (config.scoreThreshold || 5)) continue;
  const keys = [candidate.id, candidate.url, candidate.doi].filter(Boolean).map((value) => String(value).toLowerCase());
  if (keys.some((key) => existingKeys.has(key))) continue;
  const key = candidate.url.toLowerCase();
  const previous = candidateMap.get(key);
  if (!previous || candidate.score > previous.score) candidateMap.set(key, candidate);
}

const additions = [...candidateMap.values()]
  .sort((a, b) => b.score - a.score || String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")))
  .slice(0, config.maxNewItems || 12);

if (!additions.length) {
  console.log(`Research scout found no new candidates above threshold. Sources checked: ${successfulSources}.`);
  process.exit(0);
}

inbox.version = inbox.version || 1;
inbox.updatedAt = today();
inbox.items = [...additions, ...(inbox.items || [])];
await writeFile(INBOX_PATH, `${JSON.stringify(inbox, null, 2)}\n`);
console.log(`Research scout added ${additions.length} candidates from ${successfulSources} successful source queries.`);
for (const item of additions) console.log(`- [${item.score}] ${item.title} (${item.source})`);
