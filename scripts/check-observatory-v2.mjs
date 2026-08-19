import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const method = JSON.parse(await readFile("data/observatory-methodology.json", "utf8"));
const topics = JSON.parse(await readFile("data/observatory-topics.json", "utf8"));
const source = JSON.parse(await readFile("data/observatory-snapshots.json", "utf8"));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert((method.signals || []).length >= 8, "Observatory needs at least eight explicit signal definitions");
assert(String(method.interpretationRule || "").toLowerCase().includes("do not infer"), "Observatory methodology must preserve the non-diagnostic interpretation boundary");
assert((topics.topics || []).some((topic) => topic.active), "Observatory needs at least one active topic");
assert((source.snapshots || []).length >= 1, "Observatory needs at least one public snapshot");

const ids = new Set();
let sourceRecords = 0;
for (const snapshot of source.snapshots || []) {
  assert(snapshot.id && !ids.has(snapshot.id), `duplicate Observatory snapshot id: ${snapshot.id}`);
  ids.add(snapshot.id);
  assert(snapshot.topicSlug && snapshot.provider && snapshot.samplingMode, `${snapshot.id}: missing provenance metadata`);
  assert(String(snapshot.limitations || "").length >= 40, `${snapshot.id}: sampling limitations are too weak`);
  if (snapshot.samplingMode === "curated-demonstration") assert(/not a representative sample/i.test(snapshot.limitations), `${snapshot.id}: curated pilot must explicitly reject representativeness`);
  assert((snapshot.records || []).length >= 1, `${snapshot.id}: no source records`);
  for (const record of snapshot.records || []) {
    assert(/^https:\/\//.test(String(record.url || "")), `${snapshot.id}: record URL must be HTTPS`);
    assert(String(record.title || "").trim(), `${snapshot.id}: record title missing`);
    assert(String(record.domain || "").trim(), `${snapshot.id}: record domain missing`);
    sourceRecords += 1;
  }
}

for (const file of [
  join(OUT, "observatory", "index.html"),
  join(OUT, "observatory", "methodology", "index.html"),
  join(OUT, "data", "observatory.json"),
  join(OUT, "data", "observatory-observations.ndjson"),
  join(OUT, "data", "observatory-methodology.json")
]) await access(file);

const publicData = JSON.parse(await readFile(join(OUT, "data", "observatory.json"), "utf8"));
assert(publicData.canonicalUrl === `${SITE}/observatory/`, "Observatory public canonical URL drift");
assert((publicData.snapshots || []).length === (source.snapshots || []).length, "Observatory public snapshot count drift");
const publicRecords = (publicData.snapshots || []).reduce((sum, snapshot) => sum + (snapshot.records || []).length, 0);
assert(publicRecords === sourceRecords, "Observatory public observation count drift");
for (const snapshot of publicData.snapshots || []) {
  assert(snapshot.summary && Number.isFinite(snapshot.summary.sourceDiversity), `${snapshot.id}: summary missing source diversity`);
  for (const record of snapshot.records || []) {
    assert(record.signals && record.derived, `${snapshot.id}: generated signals missing`);
    assert(["gain-leaning", "loss-leaning", "mixed-or-neutral"].includes(record.derived.frameDirection), `${snapshot.id}: invalid frame direction`);
    assert(["certainty-leaning", "uncertainty-leaning", "mixed-or-neutral"].includes(record.derived.certaintyDirection), `${snapshot.id}: invalid certainty direction`);
  }
}

const ndjsonText = (await readFile(join(OUT, "data", "observatory-observations.ndjson"), "utf8")).trim();
const ndjsonRows = ndjsonText ? ndjsonText.split(/\n+/).map((line) => JSON.parse(line)) : [];
assert(ndjsonRows.length === sourceRecords, "Observatory NDJSON count drift");

const hub = await readFile(join(OUT, "observatory", "index.html"), "utf8");
assert(hub.includes("Measure the information environment, not the person."), "Observatory positioning headline missing");
assert(hub.includes('"@type":"DataCatalog"'), "Observatory DataCatalog structured data missing");
assert(!/bias score|biased outlet|biased author/i.test(hub), "Observatory must not publish diagnostic outlet or author scores");

const methodPage = await readFile(join(OUT, "observatory", "methodology", "index.html"), "utf8");
assert(methodPage.includes("What the Observatory can and cannot say."), "Observatory methodology page missing interpretation boundary");
for (const signal of method.signals || []) assert(methodPage.includes(signal.label), `Methodology page missing signal ${signal.id}`);

const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
assert(sitemap.includes(`<loc>${SITE}/observatory/</loc>`), "sitemap missing Observatory hub");
assert(sitemap.includes(`<loc>${SITE}/observatory/methodology/</loc>`), "sitemap missing Observatory methodology");
for (const snapshot of source.snapshots || []) assert(sitemap.includes(`<loc>${SITE}/observatory/${snapshot.id}/</loc>`), `sitemap missing Observatory snapshot ${snapshot.id}`);

const homepage = await readFile(join(OUT, "index.html"), "utf8");
assert(homepage.includes('class="section observatory-home"') && homepage.includes('href="/observatory/"'), "homepage does not surface Observatory");
const llms = await readFile(join(OUT, "llms.txt"), "utf8");
assert(llms.includes("https://cognitive-biases.github.io/observatory/"), "llms.txt does not expose Observatory");
assert(llms.includes("https://cognitive-biases.github.io/data/observatory.json"), "llms.txt does not expose Observatory data");

const release = JSON.parse(await readFile("data/release.json", "utf8"));
const rootManifest = await readFile(join(OUT, "data", "manifest.json"), "utf8");
const pinnedManifest = await readFile(join(OUT, "data", "releases", release.releaseVersion, "manifest.json"), "utf8");
assert(rootManifest === pinnedManifest, "Observatory generation must not alter the immutable knowledge release manifest");

const workflow = await readFile(".github/workflows/observatory-scout.yml", "utf8");
assert(workflow.includes("schedule:"), "Observatory workflow needs a schedule");
assert(workflow.includes("npm run observatory:collect"), "Observatory workflow does not run collector");
assert(workflow.includes("npm run check"), "Observatory workflow must validate before committing data");
assert(workflow.indexOf("npm run check") < workflow.indexOf("git push"), "Observatory workflow must validate before git push");

console.log(`Observatory check passed: ${source.snapshots.length} snapshot(s), ${sourceRecords} observations, ${method.signals.length} transparent signals.`);
