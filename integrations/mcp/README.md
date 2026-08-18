# Cognitive Biases MCP reference adapter

This small read-only adapter exposes the reviewed public knowledge through MCP. It is not a second database. It reads the same files generated into `dist/data/` and returns the same canonical IDs, evidence qualifications and source links.

## Run locally

```bash
npm run build
node integrations/mcp/server.mjs
```

The default endpoint is `http://127.0.0.1:3333/mcp`. Set `PORT` to change the port, or `COGNITIVE_BIASES_DATA_DIR` to point at a pinned public data release.

The adapter targets MCP `2026-07-28` and follows its stateless core. It supports `server/discover`, `tools/list`, `tools/call`, `resources/list` and `resources/read` without creating a server session.

## Tools

- `search_knowledge` searches evidence-reviewed concepts only.
- `get_concept` returns one reviewed concept and its qualification.
- `get_evidence` returns the evidence record and sources.
- `list_contexts` starts from a real decision situation.
- `compare_concepts` returns a stored reviewed comparison or `no_match`.
- `get_related` returns only reviewed typed semantic relations.

A missing or unreviewed record produces an explicit `no_match`. The adapter should not infer a diagnosis, invent a bias label, or silently drop uncertainty.

## Example discovery request

```bash
curl -s http://127.0.0.1:3333/mcp \
  -H 'content-type: application/json' \
  -H 'MCP-Protocol-Version: 2026-07-28' \
  -H 'Mcp-Method: server/discover' \
  --data '{"jsonrpc":"2.0","id":1,"method":"server/discover","params":{"_meta":{"io.modelcontextprotocol/clientInfo":{"name":"example","version":"1.0"}}}}'
```

## Example tool call

```bash
curl -s http://127.0.0.1:3333/mcp \
  -H 'content-type: application/json' \
  -H 'MCP-Protocol-Version: 2026-07-28' \
  -H 'Mcp-Method: tools/call' \
  -H 'Mcp-Name: search_knowledge' \
  --data '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_knowledge","arguments":{"query":"repeated claim feels true"}}}'
```

## Deployment

The adapter can run as a separate stateless service while the main site stays on GitHub Pages. For production use, pin `COGNITIVE_BIASES_DATA_DIR` to a known release and apply the normal network/auth controls of the hosting environment. The public website remains the canonical human-readable source.
