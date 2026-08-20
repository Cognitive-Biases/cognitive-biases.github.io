import { readFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const SITE = "https://cognitive-biases.github.io";
const tracker = JSON.parse(await readFile("data/ai-era-research-tracker.json", "utf8"));
const tracks = JSON.parse(await readFile("data/ai-era-patterns.json", "utf8"));
const protocols = JSON.parse(await readFile("data/ai-era-experiment-protocols.json", "utf8"));
const trackSlugs = new Set(tracks.tracks.map((track) => track.slug));
const protocolSlugs = new Set(protocols.protocols.map((protocol) => protocol.slug));
const expectedStages = ["idea", "protocol", "experiment", "result", "replication"];

if (JSON.stringify(tracker.stageOrder) !== JSON.stringify(expectedStages)) throw new Error("AI-era tracker stage order changed unexpectedly.");
const seen = new Set();
for (const entry of tracker.entries) {
  if (seen.has(entry.track)) throw new Error(`Duplicate tracker entry: ${entry.track}`);
  seen.add(entry.track);
  if (!trackSlugs.has(entry.track)) throw new Error(`${entry.track}: tracker entry has no AI-era track.`);
  if (!expectedStages.includes(entry.stage)) throw new Error(`${entry.track}: unknown tracker stage ${entry.stage}.`);
  for (const slug of entry.protocolSlugs || []) if (!protocolSlugs.has(slug)) throw new Error(`${entry.track}: unknown protocol ${slug}.`);
  if (entry.stage === "protocol" && !(entry.protocolSlugs || []).length) throw new Error(`${entry.track}: protocol stage requires a published protocol.`);
  if (["experiment", "result", "replication"].includes(entry.stage)) throw new Error(`${entry.track}: later research stages require explicit result artifacts and are not yet supported by this tracker dataset.`);
}

const pages = [
  ["tools/career-decision-review/index.html", ["Career Decision Review", "career-decision-review.js", "Your draft stays in this browser"]],
  ["tools/lens-pack-builder/index.html", ["Lens Pack Builder", "lens-pack-builder.js", "Choose up to seven useful questions"]],
  ["ai-era/tracker/index.html", ["AI-era Research Tracker", "Progress requires an artifact", "replication"]],
];
for (const [path, needles] of pages) {
  const html = await readFile(join(OUT, path), "utf8");
  for (const needle of needles) if (!html.includes(needle)) throw new Error(`${path}: missing ${needle}`);
}
for (const asset of ["assets/career-decision-review.js", "assets/lens-pack-builder.js"]) {
  const js = await readFile(join(OUT, asset), "utf8");
  if (!js.includes("localStorage")) throw new Error(`${asset}: expected local-first storage.`);
}
const publicTracker = JSON.parse(await readFile(join(OUT, "data", "ai-era-research-tracker.json"), "utf8"));
if (publicTracker.version !== tracker.version || publicTracker.entries.length !== tracker.entries.length) throw new Error("Published AI-era tracker data does not match source data.");
const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
for (const path of ["/tools/career-decision-review/", "/tools/lens-pack-builder/", "/ai-era/tracker/"]) {
  if (!sitemap.includes(`<loc>${SITE}${path}</loc>`)) throw new Error(`sitemap.xml: missing ${path}`);
}
const home = await readFile(join(OUT, "index.html"), "utf8");
if (!home.includes('class="decision-workbench-home"')) throw new Error("Homepage is missing Decision Workbench discovery section.");
console.log(`Decision workbench checks passed: ${tracker.entries.length} research tracks, 3 public pages, 2 local-first tools.`);
