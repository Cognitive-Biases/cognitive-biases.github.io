import { createHash } from "node:crypto";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const DATA = join(OUT, "data");
const SITE = "https://cognitive-biases.github.io";
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const hashFile = async (path) => createHash("sha256").update(await readFile(path)).digest("hex");
const entriesOf = (value, key = "entries") => Array.isArray(value) ? value : Array.isArray(value?.[key]) ? value[key] : [];
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const required = [
  "manifest.json", "release-notes.json", "catalog.json", "sources.json", "provenance.json", "metrics.json", "review-queue.json",
  "rag.ndjson", "rag-manifest.json", "translations.json", "search-intents.json", "evals/retrieval-citation.json"
];
for (const file of required) await access(join(DATA, file));
for (const page of ["methodology/index.html", "quality/index.html", "partners/index.html", "research/state-of-evidence-2026/index.html"]) await access(join(OUT, page));
await access("integrations/mcp/server.mjs");
await access("CONTRIBUTING.md");
await access("CITATION.cff");

const release = await readJson("data/release.json");
const manifest = await readJson(join(DATA, "manifest.json"));
const evidencePayload = await readJson(join(DATA, "evidence.json"));
const evidence = entriesOf(evidencePayload, "reviews");
const sourcesPayload = await readJson(join(DATA, "sources.json"));
const sources = entriesOf(sourcesPayload, "sources");
const sourceIds = new Set(sources.map((source) => source.sourceId));
const queuePayload = await readJson(join(DATA, "review-queue.json"));
const queue = entriesOf(queuePayload);
const metrics = await readJson(join(DATA, "metrics.json"));
const translationsPayload = await readJson(join(DATA, "translations.json"));
const translations = entriesOf(translationsPayload);
const guidesPayload = await readJson(join(DATA, "search-intents.json"));
const benchmark = await readJson(join(DATA, "evals/retrieval-citation.json"));
const validClasses = new Set(["established", "supported", "mixed", "contested", "domain-specific", "concept"]);
const validFreshness = new Set(["current", "due", "stale", "unreviewed"]);
const validTranslation = new Set(["missing", "draft", "reviewed", "stale"]);

assert(manifest.releaseVersion === release.releaseVersion, "manifest releaseVersion drift");
assert(manifest.schemaVersion === release.schemaVersion, "manifest schemaVersion drift");
assert(manifest.releaseDate === release.releaseDate, "manifest releaseDate drift");
assert(Array.isArray(manifest.files) && manifest.files.length >= 12, "manifest must enumerate public distributions");
for (const file of manifest.files) {
  const local = join(DATA, file.path);
  await access(local);
  assert(await hashFile(local) === file.sha256, `checksum mismatch: ${file.path}`);
  const pinned = join(DATA, "releases", release.releaseVersion, file.path);
  await access(pinned);
  assert(await hashFile(pinned) === file.sha256, `pinned release mismatch: ${file.path}`);
}
await access(join(DATA, "releases", release.releaseVersion, "manifest.json"));
await access(join(DATA, "releases", release.releaseVersion, "release-notes.json"));

assert(evidence.length > 0, "public evidence release is empty");
const evidenceIds = new Set();
for (const review of evidence) {
  assert(review.slug && !evidenceIds.has(review.slug), `duplicate evidence slug: ${review.slug}`);
  evidenceIds.add(review.slug);
  assert(validClasses.has(review.evidenceClass), `unknown evidence class for ${review.slug}`);
  assert(/^\d{4}-\d{2}-\d{2}/.test(String(review.reviewedAt || "")), `missing/invalid reviewedAt for ${review.slug}`);
  assert(Array.isArray(review.sourceIds) && review.sourceIds.length > 0, `review has no source IDs: ${review.slug}`);
  for (const sourceId of review.sourceIds) assert(sourceIds.has(sourceId), `unknown source ${sourceId} used by ${review.slug}`);
  for (const source of review.sources || []) assert(source.sourceId && sourceIds.has(source.sourceId), `source object missing canonical identity for ${review.slug}`);
}
assert(sourceIds.size === sources.length, "duplicate source IDs");
for (const source of sources) {
  assert(source.title && Array.isArray(source.usedBy) && source.usedBy.length > 0, `invalid source record ${source.sourceId}`);
  for (const slug of source.usedBy) assert(evidenceIds.has(slug), `source ${source.sourceId} points to unknown review ${slug}`);
}

assert(queue.length === evidence.length, "review queue must cover every evidence review");
const queueIds = new Set();
for (const row of queue) {
  assert(evidenceIds.has(row.slug), `review queue has unknown slug ${row.slug}`);
  assert(!queueIds.has(row.slug), `duplicate review queue slug ${row.slug}`);
  queueIds.add(row.slug);
  assert(validFreshness.has(row.state), `invalid freshness state for ${row.slug}`);
}
assert(metrics.evidenceReviewedConcepts === evidence.length, "metrics evidence count drift");
assert(metrics.uniqueSources === sources.length, "metrics source count drift");
assert(Object.values(metrics.freshness || {}).reduce((sum, value) => sum + value, 0) === evidence.length, "freshness metrics do not add up");

const ragLines = (await readFile(join(DATA, "rag.ndjson"), "utf8")).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
const ragIds = new Set();
for (const chunk of ragLines) {
  assert(chunk.chunkId && !ragIds.has(chunk.chunkId), `duplicate RAG chunk ID: ${chunk.chunkId}`);
  ragIds.add(chunk.chunkId);
  assert(chunk.canonicalId && chunk.canonicalUrl?.startsWith(SITE), `bad canonical target in RAG chunk ${chunk.chunkId}`);
  assert(chunk.contentHash === createHash("sha256").update(chunk.text).digest("hex"), `RAG content hash mismatch: ${chunk.chunkId}`);
  if (chunk.resourceType === "concept") assert(evidenceIds.has(chunk.canonicalId), `unreviewed concept leaked into trusted RAG distribution: ${chunk.canonicalId}`);
}
const ragManifest = await readJson(join(DATA, "rag-manifest.json"));
assert(ragManifest.chunkCount === ragLines.length, "RAG manifest count drift");
assert(ragManifest.contentSha256 === await hashFile(join(DATA, "rag.ndjson")), "RAG manifest checksum drift");

assert(Array.isArray(benchmark.cases) && benchmark.cases.length >= 50, `retrieval benchmark needs at least 50 cases, found ${benchmark.cases?.length || 0}`);
const caseIds = new Set();
for (const testCase of benchmark.cases) {
  assert(testCase.id && !caseIds.has(testCase.id), `duplicate eval case ID: ${testCase.id}`);
  caseIds.add(testCase.id);
  if (testCase.expectedIds) for (const id of testCase.expectedIds) assert(evidenceIds.has(id), `eval case ${testCase.id} trusts unreviewed/unknown concept ${id}`);
  if (testCase.expectedNoMatch) assert(!testCase.expectedIds?.length, `no-match eval ${testCase.id} must not have expected IDs`);
}

assert(Array.isArray(guidesPayload.generatedGuides) && guidesPayload.generatedGuides.length >= 3, `expected at least 3 evidence-led search guides, found ${guidesPayload.generatedGuides?.length || 0}`);
for (const guide of guidesPayload.generatedGuides) for (const id of guide.matchedConcepts || []) assert(evidenceIds.has(id), `guide ${guide.slug} contains unreviewed concept ${id}`);

const translationKeys = new Set();
for (const row of translations) {
  assert(validTranslation.has(row.state), `invalid translation state: ${row.locale}/${row.canonicalId}`);
  assert(evidenceIds.has(row.canonicalId), `translation points to unreviewed/unknown canonical ID ${row.canonicalId}`);
  const key = `${row.locale}:${row.canonicalId}`;
  assert(!translationKeys.has(key), `duplicate translation status ${key}`);
  translationKeys.add(key);
  if (row.state === "reviewed") assert(row.sourceRelease === release.releaseVersion, `reviewed translation is not aligned to current release: ${key}`);
}

const schemaNames = ["bias.schema.json","evidence.schema.json","context.schema.json","comparison.schema.json","relation.schema.json","research-note.schema.json","source.schema.json","rag-chunk.schema.json","manifest.schema.json","metrics.schema.json","translation-status.schema.json"];
for (const name of schemaNames) {
  const schema = await readJson(join(OUT, "schemas", name));
  assert(schema.$schema === "https://json-schema.org/draft/2020-12/schema", `schema dialect drift: ${name}`);
  assert(schema.$id === `${SITE}/schemas/${name}`, `schema ID drift: ${name}`);
}

const dataPage = await readFile(join(OUT, "data", "index.html"), "utf8");
assert(dataPage.includes('"@type":"Dataset"'), "Data page is missing Dataset structured data");
assert(dataPage.includes('"@type":"DataCatalog"'), "Data page is missing DataCatalog structured data");
assert(dataPage.includes("/data/catalog.json") && dataPage.includes("/data/rag.ndjson"), "Data page is missing integration links");

const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
for (const path of ["/methodology/", "/quality/", "/research/state-of-evidence-2026/", ...(guidesPayload.generatedGuides || []).map((guide) => `/guides/${guide.slug}/`)]) {
  assert(sitemap.includes(`<loc>${SITE}${path}</loc>`), `sitemap missing ${path}`);
}

async function inspectHtml(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await inspectHtml(path);
    else if (entry.isFile() && entry.name.endsWith(".html")) {
      const html = await readFile(path, "utf8");
      assert(!html.includes('<img src="/assets/icon2.png" width="48"'), `oversized brand asset still rendered in header: ${path}`);
      assert(!html.includes('<img src="/assets/icon2.png" width="40"'), `oversized brand asset still rendered in footer: ${path}`);
    }
  }
}
await inspectHtml(OUT);
const smallBrand = await stat(join(OUT, "assets", "biases_icon.png"));
assert(smallBrand.size <= 50000, `header brand asset is unexpectedly large: ${smallBrand.size} bytes`);

console.log(`Knowledge infrastructure check passed: release ${release.releaseVersion}, ${evidence.length} reviewed concepts, ${sources.length} sources, ${ragLines.length} RAG chunks, ${benchmark.cases.length} evals, ${guidesPayload.generatedGuides.length} guides.`);
