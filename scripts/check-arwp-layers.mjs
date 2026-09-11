import { readFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const isHttps = (value) => {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
};

const [site, search, locales, growthReview, history, citations, trust, corrections, graph, critic] = await Promise.all([
  readJson("ai/site-profile.json"),
  readJson("ai/ai-search-profile.json"),
  readJson("ai/locales.json"),
  readJson("ai/growth-review.json"),
  readJson("ai/history.json"),
  readJson("ai/citation-index.json"),
  readJson("ai/trust.json"),
  readJson("ai/corrections.json"),
  readJson("ai/knowledge-graph.json"),
  readJson(".arwp/technical-seo-critic.json")
]);

for (const language of ["en", "de", "ru"]) {
  assert(site.languages?.includes(language), `site profile is missing ${language}`);
  assert(search.site?.languages?.includes(language), `AI search profile is missing ${language}`);
  assert(locales.agentRoutingLanguages?.includes(language), `locale manifest is missing ${language}`);
}

assert(site.$schema?.includes("/v0.1.0/schema/site-profile.schema.json"), "site profile schema must be version-pinned");
assert(site.extensions?.["io.github.dkharlanau/localized-llms"], "localized llms extension is missing");
assert(site.extensions?.["io.github.dkharlanau/ai-search-profile"], "AI search profile extension is missing");
assert(site.extensions?.["io.github.dkharlanau/trust-center"], "trust-center extension is missing");

const requiredModules = [
  "answerPages", "originalResearch", "protocolObservatory", "comparisonPages", "conceptDefinitions",
  "claimsRegistry", "evidenceReceipts", "crawlerMatrix", "agentFetchLab", "knowledgeGraph",
  "citationVisuals", "openReuseAssets", "trustCenter", "correctionsLedger", "softwareProvenance",
  "persistentIdentifiers", "externalTrustSignals", "externalDistribution", "aiVisibility", "localization", "history"
];
for (const moduleName of requiredModules) {
  assert(search.modules?.[moduleName], `AI search profile is missing module ${moduleName}`);
}

for (const [name, value] of Object.entries(search.guardrails ?? {})) {
  assert(value === true, `guardrail ${name} must remain true`);
}
assert(Object.keys(search.guardrails ?? {}).length === 6, "AI search profile must expose all six ARWP guardrails");
assert(search.modules.protocolObservatory.status === "not-applicable", "agentic-web protocol observatory must not be misrepresented as active here");
assert(search.modules.openReuseAssets.status === "not-applicable", "permission-free ARWP media profile must not override this project's licence");
for (const moduleName of ["claimsRegistry", "crawlerMatrix", "softwareProvenance", "persistentIdentifiers", "externalTrustSignals", "aiVisibility"]) {
  assert(search.modules[moduleName].status === "planned", `${moduleName} must remain evidence-gated until observed`);
}

assert(locales.canonicalLanguage === "en" && locales.fallbackLanguage === "en", "locale fallback must remain canonical English");
assert(locales.locales?.some((item) => item.language === "de" && item.llms.endsWith("/de/llms.txt")), "German routing surface is missing");
assert(locales.locales?.some((item) => item.language === "ru" && item.llms.endsWith("/ru/llms.txt")), "Russian routing surface is missing");

assert(growthReview.version === "0.1", "Growth owner review version must remain 0.1");
assert(growthReview.$schema?.includes("growth-owner-review.schema.json"), "Growth owner review schema reference is missing");
assert(growthReview.site === "https://cognitive-biases.github.io/", "Growth owner review must bind to the canonical site");
assert(growthReview.evidenceClass === "owner-controlled", "Growth owner review must remain owner-controlled evidence");
assert(growthReview.guardrails?.notIndependentEvidence === true, "Growth owner review must not claim independent evidence");
assert(growthReview.guardrails?.noRankingClaim === true, "Growth owner review must not claim ranking impact");
assert(growthReview.guardrails?.manualJudgmentPreserved === true, "Growth owner review must preserve manual judgment");
assert(Array.isArray(growthReview.reviews) && growthReview.reviews.length === 2, "Growth owner review must contain the two completed manual reviews");
const expectedManualActions = new Set(["growth:non-commodity-review", "growth:site-reputation-policy"]);
for (const review of growthReview.reviews) {
  assert(expectedManualActions.delete(review.actionId), `unexpected or duplicate Growth owner review action: ${review.actionId}`);
  assert(review.status === "completed" && review.decision === "keep", `${review.actionId} must be a completed keep decision`);
  assert(/^2026-09-06$/.test(review.reviewedAt), `${review.actionId} review date is unexpected`);
  assert(String(review.summary || "").length > 40, `${review.actionId} review summary is too small`);
  assert(Array.isArray(review.scope) && review.scope.length > 0 && review.scope.every(isHttps), `${review.actionId} scope must contain HTTPS URLs`);
  assert(Array.isArray(review.evidence) && review.evidence.length > 0 && review.evidence.every(isHttps), `${review.actionId} evidence must contain HTTPS URLs`);
}
assert(expectedManualActions.size === 0, "Growth owner review is missing a required manual action");

assert(history.status === "active", "history must expose the active project status");
assert(history.startedAt === "2026-07-14", "history origin date changed unexpectedly");
assert(history.events?.length >= 5, "history must retain source-backed milestones");
assert(history.events.every((event) => event.date && event.title && event.summary && Array.isArray(event.evidence)), "history event shape is incomplete");

assert(citations.entries?.length >= 8, "citation index is unexpectedly small");
assert(citations.routingRules?.length >= 4, "citation routing guardrails are missing");
assert(trust.reviewModel?.evidenceStatusPreserved === true, "trust model must preserve evidence status");
assert(trust.security?.referenceMcpReadOnly === true, "trust model must keep MCP read-only");
assert(Array.isArray(trust.boundaries) && trust.boundaries.length >= 4, "trust boundaries are incomplete");
assert(Array.isArray(corrections.entries), "corrections ledger entries must be an array");
assert(corrections.policy?.report?.includes("correction.yml"), "correction reporting route is missing");
assert(Array.isArray(graph["@graph"]) && graph["@graph"].length >= 6, "knowledge graph is unexpectedly small");

assert(critic.version === "0.1", "Technical SEO Critic review version must remain 0.1");
assert(critic.site === "https://cognitive-biases.github.io/", "Technical SEO Critic must bind to the canonical site");
assert(critic.arwpRevision === "28c9cc9b75fa2b17791b7b294b4249fa28496445", "Technical SEO Critic must remain pinned to the reviewed ARWP revision");
assert(Array.isArray(critic.findings) && critic.findings.length === 9, "Technical SEO Critic must record TSC-01 through TSC-09");
const expectedCriticIds = new Set(Array.from({ length: 9 }, (_, index) => `TSC-${String(index + 1).padStart(2, "0")}-${[
  "head-metadata-parser-integrity",
  "search-field-performance",
  "pagination-canonical-independence",
  "crawl-state-space-control",
  "http-revalidation-efficiency",
  "link-follow-and-relationship-integrity",
  "obsolete-and-false-seo-signals",
  "canonical-channel-conflict",
  "unintended-search-serving-restrictions"
][index]}`));
for (const finding of critic.findings) {
  assert(expectedCriticIds.delete(finding.id), `unexpected or duplicate Technical SEO Critic finding: ${finding.id}`);
  assert(String(finding.status || "").length > 3, `${finding.id} needs an explicit status`);
  assert(String(finding.evidence || "").length > 40, `${finding.id} needs bounded evidence`);
}
assert(expectedCriticIds.size === 0, "Technical SEO Critic is missing a required finding");
for (const key of ["noRankingGuarantee", "noFieldDataFabrication", "noPaginationWorkWhenNotApplicable", "noProductionMutationFromOwnerDataUnknown", "finalArtifactBeforeRelease", "liveHeadersAfterDeploy"]) {
  assert(critic.guardrails?.[key] === true, `Technical SEO Critic guardrail ${key} must remain true`);
}

const allText = JSON.stringify({ site, search, locales, growthReview, history, citations, trust, corrections, graph, critic });
for (const forbidden of ["doi-issued", "observed-success", "readinessScore", "commercial-use-allowed", '"evidenceClass":"independent"']) {
  assert(!allText.includes(forbidden), `unsubstantiated or incompatible claim found: ${forbidden}`);
}

console.log("ARWP layer checks passed: profile, localization, owner-controlled Growth review, Technical SEO Critic, history, citation, trust, corrections and knowledge graph are coherent.");
