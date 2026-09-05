import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const CONFIG_PATH = "data/research-scout-config.json";
const INBOX_PATH = "data/research-inbox.json";
const USER_AGENT = "CognitiveBiasesResearchScout/1.3 (https://cognitive-biases.github.io/)";

const compact = (value = "") => String(value).replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const decodeXml = (value = "") => compact(String(value)
  .replaceAll("&amp;", "&")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">")
  .replaceAll("&quot;", '"')
  .replaceAll("&#39;", "'"));
const tag = (xml, name) => decodeXml(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"))?.[1] || "");
const today = () => new Date().toISOString().slice(0, 10);
const slugPart = (value = "") => value.toLowerCase().replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(-90);
const normalizeDoi = (value = "") => compact(value).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").toLowerCase() || null;

function relatedConcepts(candidate) {
  const text = `${candidate.title} ${candidate.summary || ""}`.toLowerCase();
  const related = new Set();
  if (/large language model|\bllm\b|artificial intelligence|\bai\b|agentic|ai agent|ai-assisted/.test(text)) related.add("ai-assisted-decisions");
  if (/automation bias|automation reliance|decision aid|appropriate reliance/.test(text)) related.add("false-priors-automation-bias");
  if (/anthropomorph|humanlike|human-like|human robot|human-robot/.test(text)) related.add("availability-heuristic-anthropomorphism");
  if (/confirmation bias/.test(text)) related.add("cognitive-bias-confirmation-bias");
  if (/anchor|anchoring/.test(text)) related.add("cognitive-bias-anchoring-effect");
  if (/illusory truth|repetition[- ]based truth/.test(text)) related.add("truth-judgment-illusory-truth-effect");
  if (/hindsight bias/.test(text)) related.add("cognitive-bias-hindsight-bias");
  if (/outcome bias/.test(text)) related.add("cognitive-bias-outcome-bias");
  if (/sunk cost|escalation of commitment/.test(text)) related.add("cognitive-bias-sunk-cost-effect");
  if (/planning fallacy/.test(text)) related.add("egocentric-bias-planning-fallacy");
  if (/forecast|prediction|prospection/.test(text)) related.add("forecasting-future-choices");
  return [...related];
}

function isCoreRelevant(candidate) {
  const title = String(candidate.title || "").toLowerCase();
  if (/bit[- ]flip|hijack|adversarial attack|fault injection|weight attack/.test(title)) return false;
  if (/cognitive bias|cognitive biases|decision bias|judgment bias|judgement bias|automation bias|confirmation bias|anchoring|anchor effect|framing effect|hindsight bias|outcome bias|sunk cost|escalation of commitment|planning fallacy|illusory truth|continued influence|backfire effect|loss aversion|decoy effect|default effect|overconfidence|base[- ]rate|availability heuristic|anthropomorph/.test(title)) return true;
  const ai = /large language model|\bllm\b|artificial intelligence|\bai[- ]assisted\b|agentic/.test(title);
  const decision = /decision|judgment|judgement|reasoning|reliance|trust|heuristic|bias/.test(title);
  return ai && decision;
}

function scoreCandidate(candidate) {
  const text = `${candidate.title} ${candidate.summary || ""}`.toLowerCase();
  const sourceType = String(candidate.sourceType || "").toLowerCase();
  const related = relatedConcepts(candidate);
  const directConceptMatches = related.filter((slug) => !["ai-assisted-decisions", "forecasting-future-choices"].includes(slug));
  let score = 0;
  if (/cognitive bias|cognitive biases|decision bias|judgment bias|judgement bias|anchoring effect|illusory truth|hindsight bias|outcome bias|sunk cost|planning fallacy|loss aversion|confirmation bias/.test(text)) score += 3;
  if (/systematic review|structured review|scoping review|meta-analysis|meta analysis|replication|registered report/.test(text)) score += 4;
  if (/large language model|\bllm\b|artificial intelligence|agentic|ai agent|ai-assisted/.test(text)) score += 3;
  if (/decision making|decision-making|forecast|judgment|judgement|human-robot|automation bias|anthropomorph|anchoring/.test(text)) score += 2;
  if (/debias|calibrat|intervention|benchmark|dataset|evaluation/.test(text)) score += 1;
  if (/preregister|pre-registered|equivalence test|boundary condition|limits of|failed to replicate|failure to replicate|null result|no effect/.test(text)) score += 2;
  if (directConceptMatches.length) score += 2;
  if (/journal article|review/.test(sourceType)) score += 1;
  if (/editorial|commentary|opinion article|letter to the editor/.test(sourceType)) score -= 2;
  if (/case report|single case/.test(text)) score -= 1;
  if (/bit[- ]flip|hijack|adversarial attack|fault injection|weight attack/.test(text)) score -= 5;
  return score;
}

function rankingReasons(candidate) {
  const text = `${candidate.title} ${candidate.summary || ""}`.toLowerCase();
  const sourceType = String(candidate.sourceType || "").toLowerCase();
  const reasons = [];
  const direct = relatedConcepts(candidate).filter((slug) => !["ai-assisted-decisions", "forecasting-future-choices"].includes(slug));
  if (direct.length) reasons.push("direct canonical concept match");
  if (/systematic review|structured review|scoping review|meta-analysis|meta analysis|replication|registered report/.test(text)) reasons.push("review, replication, or registered evidence");
  if (/preregister|pre-registered|equivalence test|boundary condition|limits of|failed to replicate|failure to replicate|null result|no effect/.test(text)) reasons.push("boundary, null, or preregistered evidence");
  if (/journal article|review/.test(sourceType)) reasons.push("journal or review source type");
  if (/large language model|\bllm\b|artificial intelligence|agentic|ai agent|ai-assisted/.test(text)) reasons.push("human-AI decision relevance");
  return reasons;
}

function whyItMatters(candidate) {
  const text = `${candidate.title} ${candidate.summary || ""}`.toLowerCase();
  if (/preregister|pre-registered|equivalence test|boundary condition|limits of|failed to replicate|failure to replicate|null result|no effect/.test(text) && relatedConcepts(candidate).length) return "Potential boundary or null evidence that may narrow an existing claim. Negative results are useful when they test a concept directly rather than merely failing to mention an effect.";
  if (/systematic review|structured review|scoping review|meta-analysis|meta analysis/.test(text)) return "Potentially high-signal review that may confirm, narrow, or challenge claims already in the library.";
  if (/replication|registered report/.test(text)) return "Potential replication evidence worth comparing with the current evidence status and qualifications.";
  if (/debias|calibrat|intervention/.test(text)) return "Potential evidence about whether a decision-improvement technique works, for whom, and under what conditions.";
  if (/large language model|\bllm\b|artificial intelligence|agentic|ai agent|ai-assisted/.test(text)) return "Potential update for the AI-assisted decisions research track; needs source review before changing any canonical claim.";
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

function parseOpenAlex(payload = {}) {
  return (payload.results || []).map((work) => {
    const openAlexId = String(work.id || "").split("/").pop() || slugPart(work.title || "work");
    const doi = normalizeDoi(work.doi || work.ids?.doi || "");
    const journal = compact(work.primary_location?.source?.display_name || "");
    const landingPage = work.primary_location?.landing_page_url || work.best_oa_location?.landing_page_url || null;
    const url = doi ? `https://doi.org/${doi}` : landingPage || work.id;
    const type = String(work.type || "").toLowerCase();
    const sourceType = type === "preprint" ? "preprint" : type === "review" ? "review" : type === "article" ? "journal article" : type || "research work";
    return {
      id: `openalex-${openAlexId.toLowerCase()}`,
      source: "OpenAlex",
      sourceType,
      title: compact(work.title || work.display_name || ""),
      summary: "",
      publishedAt: work.publication_date || String(work.publication_year || ""),
      ...(journal ? { journal } : {}),
      ...(doi ? { doi } : {}),
      url
    };
  }).filter((item) => item.title && item.url);
}

async function fetchJson(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
    if (response.ok) return response.json();
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === retries) throw new Error(`${response.status} ${response.statusText} for ${url}`);
    const retryAfter = Number(response.headers.get("retry-after"));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 700 * (attempt + 1));
  }
  throw new Error(`Could not fetch ${url}`);
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

  await sleep(450);
  const summary = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi");
  summary.searchParams.set("db", "pubmed");
  summary.searchParams.set("retmode", "json");
  summary.searchParams.set("id", ids.join(","));
  summary.searchParams.set("tool", "cognitive_biases_research_scout");
  const payload = await fetchJson(summary);
  return (payload.result?.uids || []).map((uid) => {
    const record = payload.result?.[uid] || {};
    const articleIds = record.articleids || [];
    const doi = normalizeDoi(articleIds.find((item) => item.idtype === "doi")?.value || "");
    return {
      id: `pubmed-${uid}`,
      source: "PubMed",
      sourceType: record.pubtype?.some((type) => /meta-analysis|systematic review|review/i.test(type)) ? "review" : "journal article",
      title: compact(record.title || ""),
      summary: "",
      publishedAt: compact(record.pubdate || ""),
      journal: compact(record.fulljournalname || ""),
      ...(doi ? { doi } : {}),
      url: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`
    };
  }).filter((item) => item.title);
}

async function collectOpenAlex(query, lookbackDays) {
  const from = new Date(Date.now() - lookbackDays * 86400000).toISOString().slice(0, 10);
  const search = new URL("https://api.openalex.org/works");
  search.searchParams.set("search", query);
  search.searchParams.set("filter", `from_publication_date:${from},to_publication_date:${today()}`);
  search.searchParams.set("sort", "publication_date:desc,relevance_score:desc");
  search.searchParams.set("per_page", "20");
  return parseOpenAlex(await fetchJson(search));
}

function withinLookback(candidate, days) {
  const parsed = Date.parse(candidate.publishedAt || "");
  if (!Number.isFinite(parsed)) return true;
  return parsed >= Date.now() - days * 86400000;
}

function normalizeCandidate(candidate) {
  const related = relatedConcepts(candidate);
  const doi = normalizeDoi(candidate.doi || "");
  return {
    id: candidate.id || `${candidate.source?.toLowerCase() || "source"}-${slugPart(candidate.url || candidate.title)}`,
    discoveredAt: today(),
    title: compact(candidate.title),
    url: candidate.url,
    source: candidate.source,
    sourceType: candidate.sourceType || "research",
    publishedAt: candidate.publishedAt || null,
    ...(candidate.journal ? { journal: candidate.journal } : {}),
    ...(doi ? { doi } : {}),
    relatedConcepts: related,
    whyItMatters: whyItMatters(candidate),
    score: scoreCandidate(candidate),
    rankingReasons: rankingReasons(candidate),
    status: "new"
  };
}

function selfTest() {
  const sample = { title: "A systematic review of cognitive bias in large language models", summary: "A benchmark of decision making and automation bias.", sourceType: "review" };
  assert.ok(scoreCandidate(sample) >= 10);
  assert.equal(isCoreRelevant(sample), true);
  assert.ok(relatedConcepts(sample).includes("ai-assisted-decisions"));
  assert.ok(relatedConcepts(sample).includes("false-priors-automation-bias"));

  const anchor = { title: "AnchorBench: A Multi-Pathway Benchmark for the Anchoring Effect in LLMs", summary: "Controlled anchoring tests.", sourceType: "preprint" };
  assert.equal(isCoreRelevant(anchor), true);
  assert.ok(relatedConcepts(anchor).includes("cognitive-bias-anchoring-effect"));

  const truth = { title: "The illusory truth effect in social media", summary: "Repeated claims and truth judgments.", sourceType: "journal article" };
  assert.equal(isCoreRelevant(truth), true);
  assert.ok(relatedConcepts(truth).includes("truth-judgment-illusory-truth-effect"));

  const opinionBoundary = { title: "Limits of the illusory truth effect for social-political opinions: Evidence from two experiments and a mini meta-analysis", summary: "Two preregistered experiments report no effect under the tested conditions and use equivalence tests.", sourceType: "journal article" };
  assert.equal(isCoreRelevant(opinionBoundary), true);
  assert.ok(scoreCandidate(opinionBoundary) >= 10, "A scientific paper about opinions must not be penalized as an opinion article.");
  assert.ok(rankingReasons(opinionBoundary).includes("boundary, null, or preregistered evidence"));

  const editorial = { title: "Commentary on cognitive bias research", summary: "An invited perspective.", sourceType: "commentary" };
  assert.ok(scoreCandidate(editorial) < scoreCandidate({ ...editorial, sourceType: "journal article" }), "Low-signal publication penalties must come from source type, not topic words.");

  const vrFalsePositive = { title: "Quality Action Assurance: Multimodal Verification of Examiner Claims in VR OSCEs", summary: "Examiner subjectivity, cognitive bias and an LLM verifier." };
  assert.equal(isCoreRelevant(vrFalsePositive), false);

  const attack = { title: "Decision-Level Hijacking: Injecting Cognitive Bias into Large Language Models via Bit-Flip Attacks", summary: "Adversarial weight manipulation." };
  assert.equal(isCoreRelevant(attack), false);

  const parsed = parseArxiv(`<feed><entry><id>http://arxiv.org/abs/2608.12345v2</id><published>2026-08-17T00:00:00Z</published><title> Cognitive bias in agents </title><summary> Test summary. </summary></entry></feed>`);
  assert.equal(parsed[0].id, "arxiv-2608.12345");
  assert.equal(parsed[0].url, "https://arxiv.org/abs/2608.12345");

  const openAlex = parseOpenAlex({ results: [{ id: "https://openalex.org/W123", doi: "https://doi.org/10.1234/TEST", title: "Anchoring effect in judgment", publication_date: "2026-08-20", type: "article", primary_location: { source: { display_name: "Journal of Judgment" } } }] });
  assert.equal(openAlex[0].id, "openalex-w123");
  assert.equal(openAlex[0].doi, "10.1234/test");
  assert.equal(openAlex[0].url, "https://doi.org/10.1234/test");
  assert.equal(openAlex[0].journal, "Journal of Judgment");
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
  await sleep(500);
}
for (const query of config.openAlexQueries || []) {
  try {
    collected.push(...await collectOpenAlex(query, config.lookbackDays || 45));
    successfulSources += 1;
  } catch (error) {
    console.warn(`OpenAlex scout warning: ${error.message}`);
  }
  await sleep(1100);
}
if (!successfulSources) throw new Error("Research scout could not reach any configured source.");

const existingKeys = new Set((inbox.items || []).flatMap((item) => [item.id, item.url, item.doi].filter(Boolean).map((value) => String(value).toLowerCase())));
const candidateMap = new Map();
for (const raw of collected) {
  if (!withinLookback(raw, config.lookbackDays || 45)) continue;
  if (!isCoreRelevant(raw)) continue;
  const candidate = normalizeCandidate(raw);
  if (candidate.score < (config.scoreThreshold || 5)) continue;
  const keys = [candidate.id, candidate.url, candidate.doi].filter(Boolean).map((value) => String(value).toLowerCase());
  if (keys.some((key) => existingKeys.has(key))) continue;
  const key = String(candidate.doi ? `doi:${candidate.doi}` : candidate.url).toLowerCase();
  const previous = candidateMap.get(key);
  if (!previous || candidate.score > previous.score) candidateMap.set(key, candidate);
}

const additions = [...candidateMap.values()]
  .sort((a, b) => b.score - a.score || String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")))
  .slice(0, config.maxNewItems || 12);

if (!additions.length) {
  console.log(`Research scout found no new candidates above threshold. Source queries checked: ${successfulSources}.`);
  process.exit(0);
}

inbox.version = inbox.version || 1;
inbox.updatedAt = today();
inbox.items = [...additions, ...(inbox.items || [])];
await writeFile(INBOX_PATH, `${JSON.stringify(inbox, null, 2)}\n`);
console.log(`Research scout added ${additions.length} candidates from ${successfulSources} successful source queries.`);
for (const item of additions) console.log(`- [${item.score}] ${item.title} (${item.source})`);
