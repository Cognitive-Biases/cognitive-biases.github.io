import { readFile, writeFile } from "node:fs/promises";

const path = "data/biases.json";
const biases = JSON.parse(await readFile(path, "utf8"));
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));

const functionalPrimary = biases.find((bias) => bias.id === 3 && bias.title?.startsWith("Functional Fixedness"));
const functionalDuplicate = biases.find((bias) => bias.id === 56 && bias.title?.startsWith("Functional Fixedness"));
const lawOfInstrument = biases.find((bias) => bias.id === 57 && bias.slug === "cognitive-rigidity-law-of-the-instrument");
const decoy = biases.find((bias) => bias.slug === "framing-effect-decoy-effect");

if (!functionalPrimary) throw new Error("Expected canonical Functional Fixedness record id 3.");
if (!functionalDuplicate) throw new Error("Expected legacy Functional Fixedness record id 56.");
if (!lawOfInstrument) throw new Error("Expected Law of the Instrument record id 57.");
if (!decoy || ![57, 220].includes(decoy.id)) throw new Error("Expected Decoy Effect on legacy id 57 or repaired id 220.");
if (decoy.id === 57 && biases.some((bias) => bias !== decoy && bias.id === 220)) {
  throw new Error("Cannot migrate Decoy Effect to id 220 because it is already used.");
}

const changes = [];
const mark = (message) => { if (!changes.includes(message)) changes.push(message); };

if (functionalDuplicate.slug !== "legacy-duplicate-functional-fixedness-56" || functionalDuplicate.published !== false) {
  functionalDuplicate.slug = "legacy-duplicate-functional-fixedness-56";
  functionalDuplicate.published = false;
  functionalDuplicate.status = "merged-duplicate";
  functionalDuplicate.mergedInto = 3;
  functionalDuplicate.related = [];
  functionalDuplicate.updatedAt = "2026-08-18T00:00:00.000Z";
  mark("retired duplicate Functional Fixedness record id 56 into id 3");
}

if (decoy.id === 57) {
  decoy.id = 220;
  decoy.number = 220;
  decoy.updatedAt = "2026-08-18T00:00:00.000Z";
  mark("moved Decoy Effect from duplicate id 57 to id 220 without changing its slug");
}

for (const bias of biases) {
  const original = bias.related || [];
  const repaired = [];
  for (const relatedId of original) {
    if (relatedId === 4) {
      mark("removed relations to missing id 4");
      continue;
    }

    let nextId = relatedId;
    if (nextId === 56) {
      nextId = 3;
      mark("redirected relations from retired id 56 to id 3");
    }

    if (bias.typeOfBias === "Framing Effect" && nextId === 57 && bias.slug !== "framing-effect-decoy-effect") {
      nextId = 220;
      mark("redirected Framing Effect relations from legacy Decoy id 57 to id 220");
    }

    if (nextId === bias.id) {
      mark("removed self-relations");
      continue;
    }
    if (!repaired.includes(nextId)) repaired.push(nextId);
  }
  bias.related = repaired;
}

functionalPrimary.related = [...new Set((functionalPrimary.related || []).filter((id) => id !== 4 && id !== 56))];
if (!functionalPrimary.related.includes(57)) functionalPrimary.related.push(57);

for (const id of [58, 59, 60]) {
  const target = biases.find((bias) => bias.id === id);
  if (!target) continue;
  target.related = [...new Set((target.related || []).map((relatedId) => relatedId === 57 ? 220 : relatedId).filter((relatedId) => relatedId !== target.id))];
}

const seenIds = new Set();
const seenSlugs = new Set();
for (const bias of biases) {
  if (seenIds.has(bias.id)) throw new Error(`Repair still leaves duplicate id ${bias.id}.`);
  if (seenSlugs.has(bias.slug)) throw new Error(`Repair still leaves duplicate slug ${bias.slug}.`);
  seenIds.add(bias.id);
  seenSlugs.add(bias.slug);
}

if (process.argv.includes("--write")) {
  await writeFile(path, `${JSON.stringify(biases, null, 2)}\n`);
  console.log(changes.length ? `Repaired corpus integrity: ${changes.join("; ")}.` : "Corpus integrity already normalized.");
} else {
  console.log(changes.length ? `Dry run: ${changes.join("; ")}. Use --write to persist.` : "Dry run passed: corpus integrity already normalized.");
}
