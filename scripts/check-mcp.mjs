import { spawn } from "node:child_process";

const PORT = 3397;
const endpoint = `http://127.0.0.1:${PORT}/mcp`;
const child = spawn(process.execPath, ["integrations/mcp/server.mjs"], {
  env: { ...process.env, PORT: String(PORT), COGNITIVE_BIASES_DATA_DIR: "dist/data" },
  stdio: ["ignore", "pipe", "pipe"]
});
let stderr = "";
child.stderr.on("data", (chunk) => { stderr += chunk; });
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function rpc(id, method, params = {}, name = null) {
  const headers = { "content-type": "application/json", "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": method };
  if (name) headers["Mcp-Name"] = name;
  const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
  assert(response.status === 200, `MCP HTTP status ${response.status} for ${method}`);
  assert(response.headers.get("mcp-protocol-version") === "2026-07-28", "MCP protocol response header missing");
  assert(!response.headers.has("mcp-session-id"), "stateless adapter must not create Mcp-Session-Id");
  return response.json();
}

try {
  let healthy = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (response.ok) { healthy = true; break; }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert(healthy, `MCP adapter did not start. ${stderr}`);

  const discovery = await rpc(1, "server/discover", { _meta: { "io.modelcontextprotocol/clientInfo": { name: "ci-check", version: "1.0" } } });
  assert(discovery.result?.supportedVersions?.includes("2026-07-28"), "server/discover missing supported version");
  assert(discovery.result?._meta?.["io.modelcontextprotocol/serverInfo"]?.name === "cognitive-biases-reference", "server identity missing from discovery metadata");

  const list = await rpc(2, "tools/list");
  const toolNames = new Set((list.result?.tools || []).map((tool) => tool.name));
  for (const name of ["search_knowledge", "get_concept", "get_evidence", "list_contexts", "compare_concepts", "get_related"]) assert(toolNames.has(name), `missing MCP tool ${name}`);

  const search = await rpc(3, "tools/call", { name: "search_knowledge", arguments: { query: "confirmation bias" } }, "search_knowledge");
  assert(["ok", "no_match"].includes(search.result?.structuredContent?.status), "search_knowledge returned invalid status");

  const missing = await rpc(4, "tools/call", { name: "get_concept", arguments: { slug: "definitely-not-a-canonical-bias" } }, "get_concept");
  assert(missing.result?.structuredContent?.status === "no_match", "missing concept must return explicit no_match");

  const resources = await rpc(5, "resources/list");
  assert((resources.result?.resources || []).some((resource) => resource.uri === "cognitive-biases://data/manifest"), "manifest MCP resource missing");

  const legacy = await rpc(6, "initialize", {});
  assert(legacy.error?.code === -32601, "2026-07-28 stateless adapter must not expose legacy initialize method");

  console.log("MCP integration check passed for protocol 2026-07-28.");
} finally {
  child.kill("SIGTERM");
}
