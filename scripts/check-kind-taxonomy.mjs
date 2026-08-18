import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const EXPECTED_KINDS = ["bias", "effect", "heuristic", "fallacy", "phenomenon", "principle"];
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const kindsConfig = JSON.parse(await readFile("data/kinds-v2.json", "utf8"));
const duplicateDispositions = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicateDispositions.groups || []).flatMap((group) => group.duplicateIds || []));
const canonicalBiases = biases.filter((bias) => !duplicateIds.has(bias.id));
const overrides = kindsConfig.recordKindOverrides || {};
const canonicalName = (bias) => String(bias.canonicalName || bias.title || "").split(/\s+[–—]\s+|\s+-\s+/)[0].trim();
const normalizeText = (value = "") => String(value).normalize("NFKD").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const kindFor = (bias) => {
  if (overrides[String(bias.id)]) return overrides[String(bias.id)];
  const normalized = normalizeText(canonicalName(bias));
  if (/\bheuristic\b/.test(normalized)) return "heuristic";
  if (/\bfallacy\b/.test(normalized)) return "fallacy";
  if (/\bprinciple\b|\blaw\b/.test(normalized)) return "principle";
  if (/\beffect\b/.test(normalized)) return "effect";
  if (/\bbias\b/.test(normalized)) return "bias";
  if (/\billusion\b|\bsyndrome\b|\bphenomenon\b|\bparadox\b/.test(normalized)) return "phenomenon";
  return null;
};

const actualKinds = Object.keys(kindsConfig.kinds).sort();
if (JSON.stringify(actualKinds) !== JSON.stringify([...EXPECTED_KINDS].sort())) {
  throw new Error(`Controlled kind vocabulary changed unexpectedly: ${actualKinds.join(", ")}.`);
}
for (const kind of EXPECTED_KINDS) {
  const meta = kindsConfig.kinds[kind];
  if (!meta?.label || !meta?.description) throw new Error(`${kind}: kind metadata is incomplete.`);
}
for (const [id, kind] of Object.entries(overrides)) {
  const bias = canonicalBiases.find((item) => String(item.id) === id);
  if (!bias) throw new Error(`Kind override ${id} must target a published canonical record.`);
  if (!EXPECTED_KINDS.includes(kind)) throw new Error(`${bias.slug}: override uses uncontrolled kind ${kind}.`);
}

const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(`data/${name}`, "utf8"))));
const reviewedSlugs = new Set(evidenceDocs.flatMap((document) => document.reviews || []).map((review) => review.slug));
const canonicalBySlug = new Map(canonicalBiases.map((bias) => [bias.slug, bias]));
for (const slug of reviewedSlugs) {
  const bias = canonicalBySlug.get(slug);
  if (!bias) throw new Error(`${slug}: evidence review does not target a canonical record.`);
  if (!kindFor(bias)) throw new Error(`${slug}: every evidence-reviewed canonical entry must have an explicit or name-grounded kind.`);
}

const resolved = canonicalBiases.filter((bias) => kindFor(bias));
const unresolved = canonicalBiases.filter((bias) => !kindFor(bias));
if (!resolved.length || !unresolved.length) throw new Error("Kind taxonomy should resolve conservative assignments while leaving genuinely unclear records unassigned.");
for (const bias of resolved) {
  const kind = kindFor(bias);
  const html = await readFile(resolve("dist", "biases", bias.slug, "index.html"), "utf8");
  if (!html.includes(`class="kind-chip" data-kind="${kind}" href="/kinds/#${kind}"`)) {
    throw new Error(`${bias.slug}: rendered canonical page is missing its linked ${kind} chip.`);
  }
}
for (const bias of unresolved.slice(0, 10)) {
  const html = await readFile(resolve("dist", "biases", bias.slug, "index.html"), "utf8");
  if (html.includes('class="kind-chip"')) throw new Error(`${bias.slug}: unresolved record was assigned a visible kind anyway.`);
}

const hub = await readFile(resolve("dist", "kinds", "index.html"), "utf8");
const explore = await readFile(resolve("dist", "explore", "index.html"), "utf8");
const sitemap = await readFile("dist/sitemap.xml", "utf8");
if (!hub.includes(`<link rel="canonical" href="${SITE}/kinds/">`)) throw new Error("Kinds overview is missing canonical URL.");
if (!hub.includes('"@type":"CollectionPage"') || !hub.includes('"@type":"ItemList"')) throw new Error("Kinds overview is missing collection structured data.");
if (!sitemap.includes(`<loc>${SITE}/kinds/</loc>`)) throw new Error("Kinds overview is missing from sitemap.");
if (!explore.includes('class="kind-summary"') || !explore.includes(`${resolved.length} / ${canonicalBiases.length}`)) throw new Error("Explore kind coverage summary is missing or stale.");
for (const kind of EXPECTED_KINDS) {
  if (!hub.includes(`id="${kind}"`) || !hub.includes(kindsConfig.kinds[kind].label)) throw new Error(`${kind}: missing from kinds overview.`);
}

console.log(`Kind taxonomy check passed: ${resolved.length}/${canonicalBiases.length} canonical entries resolved, ${unresolved.length} intentionally unassigned, all ${reviewedSlugs.size} evidence-reviewed entries typed across ${EXPECTED_KINDS.length} controlled kinds.`);
