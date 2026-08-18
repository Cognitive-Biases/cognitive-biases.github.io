import { readFile, writeFile } from "node:fs/promises";

const path = "data/biases.json";
const biases = JSON.parse(await readFile(path, "utf8"));
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));

const functionalPrimary = bySlug.get("cognitive-rigidity-functional-fixedness");
const functionalDuplicates = biases.filter((bias) => bias.slug === "cognitive-rigidity-functional-fixedness");
const lawOfInstrument = bySlug.get("cognitive-rigidity-law-of-the-instrument");
const decoy = bySlug.get("framing-effect-decoy-effect");

if (functionalDuplicates.length !== 2 || functionalPrimary?.id !== 3) {
  throw new Error("Expected exactly two legacy Functional Fixedness records with primary id 3.");
}
const functionalDuplicate = functionalDuplicates.find((bias) => bias.id !== 3);
if (functionalDuplicate?.id !== 56) throw new Error("Expected Functional Fixedness duplicate id 56.");
if (lawOfInstrument?.id !== 57) throw new Error("Expected Law of the Instrument id 57.");
if (decoy?.id !== 57) throw new Error("Expected legacy Decoy Effect id 57.");
if (biases.some((bias) => bias !== decoy && bias.id === 220)) throw new Error("Cannot migrate Decoy Effect to id 220 because it is already used.");

const changes = [];

// The duplicate Functional Fixedness record never had a distinct public URL because it shared
// the primary record's slug. Keep the canonical id=3 record and retire the duplicate source row.
functionalDuplicate.slug = "legacy-duplicate-functional-fixedness-56";
functionalDuplicate.published = false;
functionalDuplicate.status = "merged-duplicate";
functionalDuplicate.mergedInto = 3;
functionalDuplicate.related = [];
functionalDuplicate.updatedAt = "2026-08-18T00:00:00.000Z";
changes.push("retired duplicate Functional Fixedness record id 56 into id 3");

// Two unrelated records accidentally shared id 57. Keep the older Cognitive Rigidity identity
// stable and move Decoy Effect to the next unused id. Its public slug remains unchanged.
decoy.id = 220;
decoy.number = 220;
decoy.updatedAt = "2026-08-18T00:00:00.000Z";
changes.push("moved Decoy Effect from duplicate id 57 to id 220 without changing its slug");

for (const bias of biases) {
  const original = bias.related || [];
  const repaired = [];
  for (const relatedId of original) {
    // id 4 does not exist in the corpus.
    if (relatedId === 4) continue;

    // References to retired Functional Fixedness id 56 now point to canonical id 3.
    let nextId = relatedId === 56 ? 3 : relatedId;

    // Within the Framing Effect cluster, id 57 historically meant Decoy Effect. Outside that
    // cluster we preserve 57 as Law of the Instrument rather than guessing at ambiguous links.
    if (bias.typeOfBias === "Framing Effect" && nextId === 57 && bias.slug !== "framing-effect-decoy-effect") {
      nextId = 220;
    }

    // Remove self-links, including the Tachypsychia legacy self relation.
    if (nextId === bias.id) continue;
    if (!repaired.includes(nextId)) repaired.push(nextId);
  }
  if (JSON.stringify(repaired) !== JSON.stringify(original)) bias.related = repaired;
}

// Ensure the canonical Functional Fixedness record points to Law of the Instrument, not its
// retired duplicate, and has no missing id 4 relation.
functionalPrimary.related = [...new Set((functionalPrimary.related || []).filter((id) => id !== 4 && id !== 56))];
if (!functionalPrimary.related.includes(57)) functionalPrimary.related.push(57);

// Keep Decoy Effect's local framing cluster connected after the id migration.
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
  console.log(`Repaired corpus integrity: ${changes.join("; ")}.`);
} else {
  console.log(`Dry run passed: ${changes.join("; ")}. Use --write to persist.`);
}
