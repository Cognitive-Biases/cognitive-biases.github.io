import { readFile } from "node:fs/promises";

const SITE = "https://cognitive-biases.github.io";
const catalog = JSON.parse(await readFile("data/ai-systematic-biases.json", "utf8"));
const publicCatalog = JSON.parse(await readFile("dist/data/ai-systematic-biases.json", "utf8"));

if (!catalog.version || !catalog.updatedAt) throw new Error("AI bias catalog version or updatedAt is missing.");
if (!/not human mental states/i.test(catalog.description || "")) throw new Error("AI bias catalog must keep the human-psychology boundary in its description.");
if (!/dated evidence snapshot/i.test(catalog.terminologyBoundary || "")) throw new Error("AI bias catalog must keep model claims time-bounded.");
if (!Number.isInteger(catalog.reviewPolicy?.volatileModelSnapshotDays) || catalog.reviewPolicy.volatileModelSnapshotDays > 120) throw new Error("Volatile model snapshot review window must be explicit and no longer than 120 days.");
if (!Array.isArray(catalog.entries) || catalog.entries.length < 6) throw new Error("AI bias catalog needs a meaningful evidence-backed starter set.");

const slugs = new Set();
for (const entry of catalog.entries) {
  if (!entry.slug || !entry.name || !entry.definition || !entry.whyItMatters) throw new Error(`Incomplete AI bias entry: ${entry.slug || "unknown"}`);
  if (slugs.has(entry.slug)) throw new Error(`Duplicate AI bias slug: ${entry.slug}`);
  slugs.add(entry.slug);
  if (!entry.humanAnalogy) throw new Error(`${entry.slug}: human analogy boundary is missing.`);
  if (!entry.evidenceLevel || !entry.evidenceStatus) throw new Error(`${entry.slug}: evidence metadata is missing.`);
  if (!Array.isArray(entry.contexts) || !entry.contexts.length) throw new Error(`${entry.slug}: contexts are missing.`);
  if (!entry.selfTest || !Array.isArray(entry.mitigations) || !entry.mitigations.length) throw new Error(`${entry.slug}: practical self-test or mitigations are missing.`);
  if (!Array.isArray(entry.sources) || !entry.sources.length) throw new Error(`${entry.slug}: sources are missing.`);
  if (!entry.sources.some((source) => source.kind === "peer-reviewed")) throw new Error(`${entry.slug}: at least one peer-reviewed source is required.`);
  for (const source of entry.sources) {
    if (!source.title || !source.year || !source.url) throw new Error(`${entry.slug}: source metadata is incomplete.`);
    if (!/^https:\/\//.test(source.url)) throw new Error(`${entry.slug}: source URL must be HTTPS.`);
  }
  if (!Array.isArray(entry.modelSnapshots) || !entry.modelSnapshots.length) throw new Error(`${entry.slug}: at least one dated model snapshot is required.`);
  for (const snapshot of entry.modelSnapshots) {
    if (!snapshot.scope || !/^\d{4}-\d{2}-\d{2}$/.test(snapshot.observedAt || "") || !snapshot.status || !snapshot.finding || !snapshot.source) throw new Error(`${entry.slug}: model snapshot is incomplete.`);
    if (!/^https:\/\//.test(snapshot.source)) throw new Error(`${entry.slug}: model snapshot source must be HTTPS.`);
  }
}

if (publicCatalog.canonicalUrl !== `${SITE}/ai-biases/`) throw new Error("Public AI bias catalog canonical URL is missing.");
if (publicCatalog.entries?.length !== catalog.entries.length) throw new Error("Public AI bias catalog entry count drifted.");

const hub = await readFile("dist/ai-biases/index.html", "utf8");
for (const required of [
  "Models can be systematically wrong without thinking like humans.",
  "Human biases",
  "AI biases",
  "Human–AI patterns",
  "/ai-biases/methodology/",
  "/data/ai-systematic-biases.json",
  "data-ai-bias-pillar"
]) if (!hub.includes(required)) throw new Error(`AI bias hub is missing: ${required}`);

const methodology = await readFile("dist/ai-biases/methodology/index.html", "utf8");
if (!methodology.includes("A model finding expires faster than a psychology textbook.")) throw new Error("AI bias methodology page is missing freshness framing.");
if (!methodology.includes(String(catalog.reviewPolicy.volatileModelSnapshotDays))) throw new Error("AI bias methodology page is missing the review window.");

for (const entry of catalog.entries) {
  const html = await readFile(`dist/ai-biases/${entry.slug}/index.html`, "utf8");
  for (const required of [entry.name, "Self-test", "Dated model evidence", "Snapshots, not permanent labels.", "Human analogy:"]) {
    if (!html.includes(required)) throw new Error(`${entry.slug}: generated page is missing ${required}`);
  }
}

const sitemap = await readFile("dist/sitemap.xml", "utf8");
for (const url of [`${SITE}/ai-biases/`, `${SITE}/ai-biases/methodology/`, ...catalog.entries.map((entry) => `${SITE}/ai-biases/${entry.slug}/`)]) {
  if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`Sitemap is missing ${url}`);
}

const home = await readFile("dist/index.html", "utf8");
if (!home.includes("data-ai-bias-pillar") || !home.includes("/ai-biases/")) throw new Error("Homepage does not expose the AI bias pillar.");

console.log(`AI systematic bias check passed: ${catalog.entries.length} evidence-backed entries, dated model snapshots, practical self-tests, machine-readable export and discoverable pages.`);
