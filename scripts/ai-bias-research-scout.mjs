import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const CONFIG_PATH = "data/ai-bias-research-config.json";
const INBOX_PATH = "data/ai-bias-research-inbox.json";
const USER_AGENT = "CognitiveBiasesAIBiasScout/1.0 (https://cognitive-biases.github.io/)";
const compact = (value = "") => String(value).replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const today = () => new Date().toISOString().slice(0, 10);
const normalizeDoi = (value = "") => compact(value).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").toLowerCase() || null;
const slug = (value = "") => value.toLowerCase().replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
const decodeXml = (value = "") => compact(String(value).replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#39;", "'"));
const tag = (xml, name) => decodeXml(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"))?.[1] || "");

function classify(candidate) {
  const text = `${candidate.title} ${candidate.summary || ""}`.toLowerCase();
  const tags = [];
  if (/sycophan|agreeableness|people pleaser|agreement pressure/.test(text)) tags.push("sycophancy");
  if (/llm-as-a-judge|language model.*judge|judge.*language model|evaluator bias|evaluation bias/.test(text)) tags.push("llm-as-a-judge");
  if (/position bias|positional bias|option order|order of options|order sensitivity|primacy|recency/.test(text)) tags.push("position-and-order");
  if (/verbosity|superficial quality|style bias|fluency bias/.test(text)) tags.push("surface-quality");
  if (/anchoring|framing effect|confirmation bias|sunk cost|decoy effect|planning fallacy|cognitive bias/.test(text)) tags.push("cognitive-analogy");
  if (/knowledge conflict|document assertion|user assertion|retrieval augmented|\brag\b|source preference|source reliability/.test(text)) tags.push("rag-source-conflict");
  if (/long context|lost in the middle|context position|context placement|middle.*context/.test(text)) tags.push("long-context");
  if (/summari[sz]|causal overreach|narrative license|scientific communication|rhetorical confidence/.test(text)) tags.push("summarization-integrity");
  if (/agentic|ai agent|language model agent|agent evaluation/.test(text)) tags.push("agents");
  return [...new Set(tags)];
}

function score(candidate) {
  const text = `${candidate.title} ${candidate.summary || ""}`.toLowerCase();
  const tags = classify(candidate);
  let value = tags.length * 2;
  if (/systematic study|benchmark|controlled|experiment|quantif|evaluation|measurement|replicat/.test(text)) value += 2;
  if (/large language model|\bllms?\b|language model/.test(text)) value += 2;
  if (/peer reviewed|journal|proceedings|transactions|conference/.test(String(candidate.sourceType || "").toLowerCase())) value += 1;
  if (/survey|systematic review|meta-analysis|meta analysis/.test(text)) value += 2;
  if (/image generation|diffusion|medical image|computer vision|bias correction circuit|estimator bias/.test(text) && !/language model|\bllm\b/.test(text)) value -= 6;
  return value;
}

function why(candidate) {
  const tags = classify(candidate);
  if (tags.includes("sycophancy")) return "Potential update to the sycophancy evidence track or its mitigation boundary.";
  if (tags.includes("llm-as-a-judge")) return "Potential update to evaluator reliability, position, verbosity or judge-bias evidence.";
  if (tags.includes("rag-source-conflict")) return "Potential update to RAG source-conflict and external-assertion susceptibility evidence.";
  if (tags.includes("long-context") || tags.includes("position-and-order")) return "Potential update to context or option-position sensitivity; useful for deciding whether older snapshots need retesting.";
  if (tags.includes("cognitive-analogy")) return "Potential controlled test of a human-bias analogue in LLM outputs.";
  if (tags.includes("summarization-integrity")) return "Potential evidence about epistemic distortion in AI research or document summaries.";
  return "Potential AI systematic-bias evidence candidate. Review methodology before promoting it to the public catalog.";
}

function parseArxiv(xml) {
  return xml.split("<entry>").slice(1).map((chunk) => chunk.split("</entry>")[0]).map((entry) => {
    const rawId = tag(entry, "id");
    const arxivId = rawId.split("/abs/").pop()?.replace(/v\d+$/, "") || slug(rawId);
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

function parseOpenAlex(payload = {}) {
  return (payload.results || []).map((work) => {
    const id = String(work.id || "").split("/").pop() || slug(work.title || "work");
    const doi = normalizeDoi(work.doi || work.ids?.doi || "");
    const venue = compact(work.primary_location?.source?.display_name || "");
    const url = doi ? `https://doi.org/${doi}` : work.primary_location?.landing_page_url || work.best_oa_location?.landing_page_url || work.id;
    const type = String(work.type || "").toLowerCase();
    return {
      id: `openalex-${id.toLowerCase()}`,
      source: "OpenAlex",
      sourceType: type === "preprint" ? "preprint" : type === "review" ? "peer reviewed review" : "peer reviewed journal or proceedings",
      title: compact(work.title || work.display_name || ""),
      summary: "",
      publishedAt: work.publication_date || String(work.publication_year || ""),
      ...(venue ? { venue } : {}),
      ...(doi ? { doi } : {}),
      url
    };
  }).filter((item) => item.title && item.url);
}

async function fetchJson(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
    if (response.ok) return response.json();
    if (attempt === retries || (response.status !== 429 && response.status < 500)) throw new Error(`${response.status} ${response.statusText} for ${url}`);
    await sleep(800 * (attempt + 1));
  }
}

async function collectArxiv(query) {
  const params = new URLSearchParams({ search_query: query, start: "0", max_results: "15", sortBy: "submittedDate", sortOrder: "descending" });
  const response = await fetch(`https://export.arxiv.org/api/query?${params}`, { headers: { "User-Agent": USER_AGENT, Accept: "application/atom+xml" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for arXiv`);
  return parseArxiv(await response.text());
}

async function collectOpenAlex(query, lookbackDays) {
  const from = new Date(Date.now() - lookbackDays * 86400000).toISOString().slice(0, 10);
  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("search", query);
  url.searchParams.set("filter", `from_publication_date:${from},to_publication_date:${today()}`);
  url.searchParams.set("sort", "publication_date:desc,relevance_score:desc");
  url.searchParams.set("per_page", "20");
  return parseOpenAlex(await fetchJson(url));
}

function dedupe(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = candidate.doi ? `doi:${normalizeDoi(candidate.doi)}` : `title:${slug(candidate.title)}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function withinLookback(candidate, days) {
  const parsed = Date.parse(candidate.publishedAt || "");
  return !Number.isFinite(parsed) || parsed >= Date.now() - days * 86400000;
}

function selfTest() {
  const syc = { title: "Benchmarking sycophancy in large language models", summary: "A controlled evaluation of LLM agreement pressure.", sourceType: "conference" };
  const irrelevant = { title: "Bias correction for a temperature estimator", summary: "A statistical estimator for sensors.", sourceType: "journal" };
  assert(classify(syc).includes("sycophancy"));
  assert(score(syc) >= 6);
  assert(score(irrelevant) < 6);
  assert(why(syc).includes("sycophancy"));
  console.log("AI bias research scout self-test passed.");
}

if (process.argv.includes("--self-test")) {
  selfTest();
  process.exit(0);
}

const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
const inbox = JSON.parse(await readFile(INBOX_PATH, "utf8"));
const candidates = [];
const failures = [];

for (const query of config.openAlexQueries || []) {
  try {
    candidates.push(...await collectOpenAlex(query, config.lookbackDays));
  } catch (error) {
    failures.push(`OpenAlex: ${query}: ${error.message}`);
  }
}
for (const query of config.arxivQueries || []) {
  try {
    candidates.push(...await collectArxiv(query));
    await sleep(350);
  } catch (error) {
    failures.push(`arXiv: ${query}: ${error.message}`);
  }
}

const existingKeys = new Set((inbox.entries || []).map((item) => item.doi ? `doi:${normalizeDoi(item.doi)}` : `title:${slug(item.title)}`));
const selected = dedupe(candidates)
  .filter((candidate) => withinLookback(candidate, config.lookbackDays))
  .map((candidate) => ({ ...candidate, tags: classify(candidate), score: score(candidate), whyItMatters: why(candidate), discoveredAt: today(), status: "candidate-needs-review" }))
  .filter((candidate) => candidate.tags.length && candidate.score >= config.scoreThreshold)
  .filter((candidate) => !existingKeys.has(candidate.doi ? `doi:${normalizeDoi(candidate.doi)}` : `title:${slug(candidate.title)}`))
  .sort((a, b) => b.score - a.score || String(b.publishedAt).localeCompare(String(a.publishedAt)))
  .slice(0, config.maxNewItems);

const next = {
  ...inbox,
  updatedAt: today(),
  scout: {
    configVersion: config.version,
    lookbackDays: config.lookbackDays,
    tracks: config.tracks,
    lastRunFailures: failures
  },
  entries: [...selected, ...(inbox.entries || [])]
};
await writeFile(INBOX_PATH, `${JSON.stringify(next, null, 2)}\n`);
console.log(`AI bias research scout: ${selected.length} new candidate(s), ${failures.length} source failure(s).`);
