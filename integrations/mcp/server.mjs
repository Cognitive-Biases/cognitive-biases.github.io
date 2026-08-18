import http from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const PROTOCOL_VERSION = "2026-07-28";
const DATA_DIR = process.env.COGNITIVE_BIASES_DATA_DIR || "dist/data";
const PORT = Number(process.env.PORT || 3333);
const SITE = "https://cognitive-biases.github.io";

const readJson = async (name) => JSON.parse(await readFile(join(DATA_DIR, name), "utf8"));
const entriesOf = (value, key = "entries") => Array.isArray(value) ? value : Array.isArray(value?.[key]) ? value[key] : [];
const text = (value) => String(value || "").toLowerCase();

const [biases, evidencePayload, contextsPayload, comparisonsPayload, relationsPayload, manifest, metrics] = await Promise.all([
  readJson("biases.json"),
  readJson("evidence.json"),
  readJson("contexts.json"),
  readJson("comparisons.json"),
  readJson("relations.json"),
  readJson("manifest.json"),
  readJson("metrics.json")
]);

const evidence = entriesOf(evidencePayload, "reviews");
const contexts = entriesOf(contextsPayload);
const comparisons = entriesOf(comparisonsPayload);
const relations = entriesOf(relationsPayload, "relations");
const biasBySlug = new Map(biases.map((item) => [item.slug, item]));
const evidenceBySlug = new Map(evidence.map((item) => [item.slug, item]));

const SERVER_INFO = {
  name: "cognitive-biases-reference",
  version: manifest.releaseVersion,
  title: "Cognitive Biases reviewed knowledge"
};
const serverMeta = () => ({
  "io.modelcontextprotocol/serverInfo": SERVER_INFO,
  "org.cognitive-biases/release": {
    releaseVersion: manifest.releaseVersion,
    schemaVersion: manifest.schemaVersion,
    canonicalUrl: `${SITE}/data/`
  }
});

function envelope(extra = {}) {
  return { resultType: "complete", ttlMs: 600000, cacheScope: "public", ...extra, _meta: { ...(extra._meta || {}), ...serverMeta() } };
}
function noMatch(reason, query = null) {
  return { status: "no_match", reason, query, releaseVersion: manifest.releaseVersion };
}
function reviewedConcept(slug) {
  const review = evidenceBySlug.get(slug);
  if (!review) return null;
  const concept = biasBySlug.get(slug) || { slug, title: slug };
  return {
    id: slug,
    title: concept.title || concept.name || slug,
    canonicalUrl: `${SITE}/biases/${slug}/`,
    family: concept.family || concept.typeOfBias || null,
    evidenceClass: review.evidenceClass,
    evidenceStatus: review.evidenceStatus,
    qualification: review.qualification || null,
    mechanism: review.mechanism || null,
    practical: review.practical || null,
    reviewedAt: review.reviewedAt,
    sourceIds: review.sourceIds || [],
    sources: (review.sources || []).map((source) => ({ sourceId: source.sourceId, title: source.title, year: source.year || null, doi: source.doi || null, url: source.url || null }))
  };
}
function scoreConcept(concept, query) {
  const q = text(query).trim();
  if (!q) return 0;
  const tokens = q.split(/\s+/).filter((token) => token.length > 2);
  const haystack = text([concept.id, concept.title, concept.family, concept.evidenceStatus, concept.qualification, concept.mechanism, concept.practical].join(" "));
  let score = haystack.includes(q) ? 20 : 0;
  for (const token of tokens) if (haystack.includes(token)) score += token.length >= 7 ? 3 : 1;
  return score;
}

const TOOLS = [
  {
    name: "search_knowledge",
    title: "Search reviewed cognitive-bias knowledge",
    description: "Search only evidence-reviewed concepts. Returns canonical IDs, URLs and evidence qualifications.",
    inputSchema: { type: "object", required: ["query"], properties: { query: { type: "string", minLength: 1 }, limit: { type: "integer", minimum: 1, maximum: 20, default: 5 } }, additionalProperties: false }
  },
  {
    name: "get_concept",
    title: "Get a reviewed concept",
    description: "Return one reviewed concept with evidence status, qualification and canonical source URL.",
    inputSchema: { type: "object", required: ["slug"], properties: { slug: { type: "string" } }, additionalProperties: false }
  },
  {
    name: "get_evidence",
    title: "Get reviewed evidence",
    description: "Return the evidence review and scholarly source references for one canonical concept.",
    inputSchema: { type: "object", required: ["slug"], properties: { slug: { type: "string" } }, additionalProperties: false }
  },
  {
    name: "list_contexts",
    title: "Find decision guides",
    description: "Find situation-first decision guides instead of guessing a bias label.",
    inputSchema: { type: "object", properties: { query: { type: "string" } }, additionalProperties: false }
  },
  {
    name: "compare_concepts",
    title: "Compare reviewed concepts",
    description: "Return a reviewed comparison when the library has one. Does not invent a distinction when no reviewed comparison exists.",
    inputSchema: { type: "object", required: ["leftSlug", "rightSlug"], properties: { leftSlug: { type: "string" }, rightSlug: { type: "string" } }, additionalProperties: false }
  },
  {
    name: "get_related",
    title: "Get reviewed semantic relations",
    description: "Return typed reviewed relations for one concept. Legacy untyped related links are not promoted here.",
    inputSchema: { type: "object", required: ["slug"], properties: { slug: { type: "string" } }, additionalProperties: false }
  }
];

async function callTool(name, args = {}) {
  switch (name) {
    case "search_knowledge": {
      const limit = Math.min(20, Math.max(1, Number(args.limit || 5)));
      const hits = evidence.map((review) => reviewedConcept(review.slug)).map((concept) => ({ concept, score: scoreConcept(concept, args.query) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.concept.title.localeCompare(b.concept.title)).slice(0, limit).map(({ concept }) => concept);
      return hits.length ? { status: "ok", query: args.query, results: hits } : noMatch("No reviewed concept matched the query. Try a decision guide or a more specific term instead of forcing a label.", args.query);
    }
    case "get_concept": {
      return reviewedConcept(args.slug) || noMatch("This ID is missing or is not evidence-reviewed.", args.slug);
    }
    case "get_evidence": {
      const review = evidenceBySlug.get(args.slug);
      if (!review) return noMatch("No reviewed evidence record exists for this ID.", args.slug);
      return { status: "ok", id: review.slug, canonicalUrl: `${SITE}/biases/${review.slug}/`, evidenceClass: review.evidenceClass, evidenceStatus: review.evidenceStatus, qualification: review.qualification || null, reviewedAt: review.reviewedAt, sourceIds: review.sourceIds || [], sources: review.sources || [] };
    }
    case "list_contexts": {
      const q = text(args.query).trim();
      const rows = contexts.map((context) => ({
        id: context.slug,
        title: context.title,
        summary: context.summary,
        canonicalUrl: `${SITE}/contexts/${context.slug}/`,
        reviewedLensIds: (context.lenses || []).map((lens) => lens.slug)
      })).filter((context) => !q || text(`${context.title} ${context.summary}`).includes(q) || q.split(/\s+/).some((token) => token.length > 3 && text(`${context.title} ${context.summary}`).includes(token)));
      return rows.length ? { status: "ok", results: rows } : noMatch("No reviewed decision guide matched this query.", args.query || null);
    }
    case "compare_concepts": {
      const comparison = comparisons.find((item) => (item.leftSlug === args.leftSlug && item.rightSlug === args.rightSlug) || (item.leftSlug === args.rightSlug && item.rightSlug === args.leftSlug));
      if (!comparison) return noMatch("The library has no reviewed comparison for this pair. Do not invent one from shared keywords.", `${args.leftSlug} / ${args.rightSlug}`);
      return { status: "ok", ...comparison, canonicalUrl: `${SITE}/compare/${comparison.slug}/` };
    }
    case "get_related": {
      if (!evidenceBySlug.has(args.slug)) return noMatch("This ID is missing or is not evidence-reviewed.", args.slug);
      const rows = relations.filter((edge) => edge.leftSlug === args.slug || edge.rightSlug === args.slug).map((edge) => ({ type: edge.type, relatedId: edge.leftSlug === args.slug ? edge.rightSlug : edge.leftSlug, note: edge.note, canonicalUrl: canonicalUrlFor(edge.leftSlug === args.slug ? edge.rightSlug : edge.leftSlug) }));
      return rows.length ? { status: "ok", id: args.slug, relations: rows } : noMatch("No reviewed semantic relation is stored for this concept.", args.slug);
    }
    default:
      return noMatch("Unknown tool.", name);
  }
}

function canonicalUrlFor(id) {
  if (evidenceBySlug.has(id)) return `${SITE}/biases/${id}/`;
  if (contexts.some((item) => item.slug === id)) return `${SITE}/contexts/${id}/`;
  if (comparisons.some((item) => item.slug === id)) return `${SITE}/compare/${id}/`;
  return SITE;
}

const RESOURCE_FILES = new Map([
  ["cognitive-biases://data/manifest", "manifest.json"],
  ["cognitive-biases://data/metrics", "metrics.json"],
  ["cognitive-biases://data/sources", "sources.json"],
  ["cognitive-biases://data/review-queue", "review-queue.json"],
  ["cognitive-biases://data/catalog", "catalog.json"]
]);

function rpcError(id, code, message, data = undefined) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data === undefined ? {} : { data }) } };
}
function rpcResult(id, result) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

async function handleRpc(body, headers) {
  const id = body?.id ?? null;
  const version = headers["mcp-protocol-version"];
  if (version && version !== PROTOCOL_VERSION) return rpcError(id, -32022, "Unsupported MCP protocol version", { supportedVersions: [PROTOCOL_VERSION] });
  if (headers["mcp-method"] && headers["mcp-method"] !== body?.method) return rpcError(id, -32600, "Mcp-Method header does not match JSON-RPC method");

  switch (body?.method) {
    case "server/discover":
      return rpcResult(id, envelope({ supportedVersions: [PROTOCOL_VERSION], capabilities: { tools: {}, resources: {} }, instructions: "Use reviewed concepts and decision guides. Preserve evidence qualifications and canonical citations. Return no_match instead of inventing a bias." }));
    case "tools/list":
      return rpcResult(id, envelope({ tools: TOOLS }));
    case "tools/call": {
      const name = body?.params?.name;
      if (!name || !TOOLS.some((tool) => tool.name === name)) return rpcError(id, -32602, "Unknown or missing tool name");
      if (headers["mcp-name"] && headers["mcp-name"] !== name) return rpcError(id, -32600, "Mcp-Name header does not match tool name");
      const structuredContent = await callTool(name, body?.params?.arguments || {});
      return rpcResult(id, envelope({ content: [{ type: "text", text: JSON.stringify(structuredContent) }], structuredContent, isError: false }));
    }
    case "resources/list":
      return rpcResult(id, envelope({ resources: [...RESOURCE_FILES.keys()].map((uri) => ({ uri, name: uri.split("/").pop(), mimeType: "application/json" })) }));
    case "resources/read": {
      const uri = body?.params?.uri;
      const file = RESOURCE_FILES.get(uri);
      if (!file) return rpcError(id, -32602, "Unknown resource URI");
      const value = await readFile(join(DATA_DIR, file), "utf8");
      return rpcResult(id, envelope({ contents: [{ uri, mimeType: "application/json", text: value }] }));
    }
    default:
      return rpcError(id, -32601, "Method not found");
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader("MCP-Protocol-Version", PROTOCOL_VERSION);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ status: "ok", protocolVersion: PROTOCOL_VERSION, releaseVersion: manifest.releaseVersion, reviewedConcepts: evidence.length, metrics }));
    return;
  }
  if (req.method !== "POST" || req.url !== "/mcp") {
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const response = await handleRpc(body, req.headers);
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(response));
  } catch (error) {
    res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(rpcError(null, -32700, "Invalid request", { message: error.message })));
  }
});

server.listen(PORT, () => {
  console.log(`Cognitive Biases MCP reference adapter listening on http://127.0.0.1:${PORT}/mcp (protocol ${PROTOCOL_VERSION}, release ${manifest.releaseVersion}).`);
});
