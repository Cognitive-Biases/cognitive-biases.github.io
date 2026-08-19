import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_OUT, OUT, SITE, readJson, writeJson, hashFile, hashText, slugify } from "./lib/knowledge.mjs";

const release = await readJson("data/release.json");
const skillsPayload = await readJson(join(DATA_OUT, "skills.json"));
const skills = skillsPayload.skills || [];

if (!skills.length) throw new Error("No generated decision skills found in dist/data/skills.json.");

await writeJson(join(OUT, "schemas", "skill.schema.json"), {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": `${SITE}/schemas/skill.schema.json`,
  type: "object",
  title: "Decision skill",
  additionalProperties: true,
  required: ["slug", "title", "summary", "outcome", "contexts", "lenses", "canonicalUrl"],
  properties: {
    slug: { type: "string" },
    title: { type: "string" },
    summary: { type: "string" },
    outcome: { type: "string" },
    whenToUse: { type: "array", items: { type: "string" } },
    actions: { type: "array", items: { type: "string" } },
    contexts: { type: "array" },
    lenses: { type: "array" },
    canonicalUrl: { type: "string" }
  }
});

const cataloguePath = join(DATA_OUT, "catalog.json");
const catalogue = await readJson(cataloguePath);
if (!catalogue.distributions.some((item) => item.id === "skills")) {
  catalogue.distributions.splice(3, 0, {
    id: "skills",
    format: "application/json",
    url: `${SITE}/data/skills.json`,
    schema: `${SITE}/schemas/skill.schema.json`
  });
  await writeJson(cataloguePath, catalogue);
}

const metricsPath = join(DATA_OUT, "metrics.json");
const metrics = await readJson(metricsPath);
metrics.skills = skills.length;
await writeJson(metricsPath, metrics);

const ragPath = join(DATA_OUT, "rag.ndjson");
let rag = await readFile(ragPath, "utf8");
const existingIds = new Set(rag.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line).chunkId));
const newChunks = [];
for (const skill of skills) {
  const chunkId = `cb-skill-${slugify(skill.slug)}-guide`;
  if (existingIds.has(chunkId)) continue;
  const text = [
    skill.summary,
    `Learning outcome: ${skill.outcome}`,
    ...(skill.whenToUse || []).map((item) => `Use when: ${item}`),
    ...(skill.actions || []).map((item) => `Action: ${item}`),
    ...(skill.lenses || []).map((lens) => `Reviewed lens: ${lens.title}. ${lens.qualification || ""}`)
  ].join(" ").replace(/\s+/g, " ").trim();
  newChunks.push({
    chunkId,
    canonicalId: skill.slug,
    canonicalUrl: skill.canonicalUrl,
    resourceType: "skill",
    section: "guide",
    title: skill.title,
    text,
    reviewState: "reviewed-links",
    sourceIds: [],
    releaseVersion: release.releaseVersion,
    schemaVersion: release.schemaVersion,
    contentHash: hashText(text)
  });
}
if (newChunks.length) {
  rag = `${rag.trimEnd()}\n${newChunks.map((item) => JSON.stringify(item)).join("\n")}\n`;
  await writeFile(ragPath, rag);
}
const ragManifestPath = join(DATA_OUT, "rag-manifest.json");
const ragManifest = await readJson(ragManifestPath);
ragManifest.chunkCount = rag.trim().split("\n").filter(Boolean).length;
ragManifest.contentSha256 = await hashFile(ragPath);
await writeJson(ragManifestPath, ragManifest);

const dataPagePath = join(OUT, "data", "index.html");
let dataPage = await readFile(dataPagePath, "utf8");
if (!dataPage.includes('/data/skills.json')) {
  dataPage = dataPage.replace(
    "</article>",
    `<h2>Decision skills</h2><p>The skills layer connects practical capabilities with reviewed bias lenses, decision contexts and exercises. <a href="/data/skills.json">Download decision skills</a> or <a href="/skills/">browse the human-readable skill guides</a>.</p></article>`
  );
  await writeFile(dataPagePath, dataPage);
}

console.log(`Added ${skills.length} decision skills to catalogue, metrics, RAG and data discovery.`);
