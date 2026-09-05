import { readFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [site, search, locales, history, citations, trust, corrections, graph] = await Promise.all([
  readJson("ai/site-profile.json"),
  readJson("ai/ai-search-profile.json"),
  readJson("ai/locales.json"),
  readJson("ai/history.json"),
  readJson("ai/citation-index.json"),
  readJson("ai/trust.json"),
  readJson("ai/corrections.json"),
  readJson("ai/knowledge-graph.json")
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

const allText = JSON.stringify({ site, search, locales, history, citations, trust, corrections, graph });
for (const forbidden of ["doi-issued", "observed-success", "readinessScore", "commercial-use-allowed"]) {
  assert(!allText.includes(forbidden), `unsubstantiated or incompatible claim found: ${forbidden}`);
}

console.log("ARWP layer checks passed: profile, localization, history, citation, trust, corrections and knowledge graph are coherent.");
