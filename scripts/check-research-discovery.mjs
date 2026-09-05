import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const notes = await json("data/research-notes.json");
const biases = await json("data/biases.json");
const duplicates = await json("data/duplicate-dispositions.json");
const evidence = await json("dist/data/evidence.json");
const tracker = await json("data/ai-era-research-tracker.json");
const labData = await json("dist/data/research-lab.json");
const digestData = await json("data/monthly-research-digests.json");
const evidenceChanges = await json("dist/data/evidence-changes.json");
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const canonical = new Map(biases.filter((entry) => entry.published && !duplicateIds.has(entry.id)).map((entry) => [entry.slug, entry]));
const reviewed = new Set((evidence.reviews || []).map((entry) => entry.slug));
let relationships = 0;
const linkedConcepts = new Set();

for (const note of notes.entries || []) {
  const researchHtml = await readFile(resolve("dist", "research", note.slug, "index.html"), "utf8");
  const researchMatch = researchHtml.match(/<script type="application\/ld\+json" data-seo-schema="research-article">([\s\S]*?)<\/script>/);
  if (!researchMatch) throw new Error(`${note.slug}: research Article schema is missing.`);
  const researchSchema = JSON.parse(researchMatch[1]);
  const article = researchSchema?.["@graph"]?.find((node) => node?.["@id"] === `${SITE}/research/${note.slug}/#article`);
  if (!article) throw new Error(`${note.slug}: canonical Article entity is missing.`);
  const aboutIds = new Set((article.about || []).map((item) => item?.["@id"]));

  for (const slug of note.related || []) {
    if (!canonical.has(slug)) throw new Error(`${note.slug}: related concept ${slug} is not canonical.`);
    if (!reviewed.has(slug)) throw new Error(`${note.slug}: related concept ${slug} is not evidence-reviewed.`);
    const termId = `${SITE}/biases/${slug}/#term`;
    if (!aboutIds.has(termId)) throw new Error(`${note.slug}: Article schema is missing about ${termId}.`);

    const biasHtml = await readFile(resolve("dist", "biases", slug, "index.html"), "utf8");
    if (!biasHtml.includes('class="research-teaser"')) throw new Error(`${slug}: visible Research notes teaser is missing.`);
    if (!biasHtml.includes(`href="/research/${note.slug}/"`)) throw new Error(`${slug}: visible backlink to ${note.slug} is missing.`);
    const termMatch = biasHtml.match(/<script type="application\/ld\+json" data-seo-schema="defined-term">([\s\S]*?)<\/script>/);
    if (!termMatch) throw new Error(`${slug}: marked DefinedTerm schema is missing.`);
    const termSchema = JSON.parse(termMatch[1]);
    const term = termSchema?.["@graph"]?.find((node) => node?.["@id"] === termId);
    const subjectIds = new Set((term?.subjectOf || []).map((item) => item?.["@id"]));
    if (!subjectIds.has(`${SITE}/research/${note.slug}/#article`)) throw new Error(`${slug}: DefinedTerm subjectOf does not link ${note.slug}.`);
    relationships += 1;
    linkedConcepts.add(slug);
  }
}

if (!relationships) throw new Error("Research discovery has no note-to-concept relationships.");

const labHtml = await readFile(resolve("dist", "research", "lab", "index.html"), "utf8");
const changesHtml = await readFile(resolve("dist", "research", "changes", "index.html"), "utf8");
const researchIndex = await readFile(resolve("dist", "research", "index.html"), "utf8");
const dataIndex = await readFile(resolve("dist", "data", "index.html"), "utf8");
const sitemap = await readFile(resolve("dist", "sitemap.xml"), "utf8");
if (!labHtml.includes(`<link rel="canonical" href="${SITE}/research/lab/">`)) throw new Error("Research Lab canonical is missing.");
if (!researchIndex.includes('href="/research/lab/"')) throw new Error("Research index does not discover Research Lab.");
if (!dataIndex.includes('href="/data/research-lab.json"')) throw new Error("Data page does not expose Research Lab JSON.");
if (!sitemap.includes(`<loc>${SITE}/research/lab/</loc>`)) throw new Error("Research Lab is missing from sitemap.");
if (labData.interpretationRule !== tracker.interpretationRule) throw new Error("Research Lab interpretation rule drifted from tracker.");
if (JSON.stringify(labData.stageOrder) !== JSON.stringify(tracker.stageOrder)) throw new Error("Research Lab stage order drifted from tracker.");
if ((labData.tracks || []).length !== (tracker.entries || []).length) throw new Error("Research Lab track count does not match tracker.");
for (const entry of tracker.entries || []) {
  if (!labHtml.includes(escapeForCheck(entry.name)) || !labHtml.includes(escapeForCheck(entry.nextMilestone))) throw new Error(`${entry.track}: Research Lab is missing visible tracker content.`);
  const published = (labData.tracks || []).find((track) => track.track === entry.track);
  if (!published || published.stage !== entry.stage) throw new Error(`${entry.track}: Research Lab JSON stage drift.`);
  for (const artifact of entry.studyArtifacts || []) if (!labHtml.includes(`href="${artifact}"`)) throw new Error(`${entry.track}: Research Lab is missing artifact ${artifact}.`);
}
if (!labHtml.includes("A protocol is not a result") || !labData.resultGate) throw new Error("Research Lab result gate is missing.");

const expectedChanges = (digestData.digests || []).flatMap((digest) => (digest.signals || []).filter((signal) => signal.delta !== "watch only")).length;
const allowedChangeTypes = new Set(["strengthens", "narrows", "new context"]);
if (!changesHtml.includes(`<link rel="canonical" href="${SITE}/research/changes/">`)) throw new Error("Evidence Change Log canonical is missing.");
if (!researchIndex.includes('href="/research/changes/"')) throw new Error("Research index does not discover Evidence Change Log.");
if (!dataIndex.includes('href="/data/evidence-changes.json"')) throw new Error("Data page does not expose evidence changes JSON.");
if (!sitemap.includes(`<loc>${SITE}/research/changes/</loc>`)) throw new Error("Evidence Change Log is missing from sitemap.");
if ((evidenceChanges.changes || []).length !== expectedChanges) throw new Error(`Evidence Change Log expected ${expectedChanges} records; found ${(evidenceChanges.changes || []).length}.`);
if (!evidenceChanges.semantics?.strengthens || !evidenceChanges.semantics?.narrows || !evidenceChanges.semantics?.["new context"]) throw new Error("Evidence Change Log semantics are incomplete.");
const changeIds = new Set();
const seenTypes = new Set();
for (const change of evidenceChanges.changes || []) {
  if (!change.id || changeIds.has(change.id)) throw new Error(`Evidence Change Log has duplicate or missing id ${change.id}.`);
  changeIds.add(change.id);
  if (!allowedChangeTypes.has(change.changeType)) throw new Error(`${change.id}: invalid change type ${change.changeType}.`);
  seenTypes.add(change.changeType);
  if (!change.finding || !change.projectChange || !change.practicalCheck) throw new Error(`${change.id}: evidence delta is missing explanatory fields.`);
  if (!/^https:\/\//.test(change.source?.url || "")) throw new Error(`${change.id}: source URL is missing or not HTTPS.`);
  if (!changesHtml.includes(escapeForCheck(change.title)) || !changesHtml.includes(escapeForCheck(change.projectChange))) throw new Error(`${change.id}: readable Evidence Change Log is missing the machine record.`);
}
for (const type of allowedChangeTypes) if (!seenTypes.has(type)) throw new Error(`Evidence Change Log currently lacks an example of ${type}.`);

function escapeForCheck(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

console.log(`Research discovery check passed: ${relationships} reciprocal Article↔DefinedTerm relationships across ${linkedConcepts.size} evidence-reviewed concepts; Research Lab exposes ${labData.tracks.length} maturity-tracked research tracks; Evidence Change Log exposes ${evidenceChanges.changes.length} reviewed evidence deltas.`);
