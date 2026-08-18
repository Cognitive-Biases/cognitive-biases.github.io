import { readFile, writeFile } from "node:fs/promises";

const biasesPath = "data/biases.json";
const curatedPath = "data/curated-concepts.json";
const biases = JSON.parse(await readFile(biasesPath, "utf8"));
const curated = JSON.parse(await readFile(curatedPath, "utf8"));

const byId = new Map(biases.map((bias) => [bias.id, bias]));
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
let added = 0;

for (const entry of curated.entries || []) {
  const sameId = byId.get(entry.id);
  const sameSlug = bySlug.get(entry.slug);
  if (sameId && sameId.slug !== entry.slug) throw new Error(`Curated concept id ${entry.id} conflicts with ${sameId.slug}.`);
  if (sameSlug && sameSlug.id !== entry.id) throw new Error(`Curated concept slug ${entry.slug} conflicts with id ${sameSlug.id}.`);
  if (sameId || sameSlug) continue;
  biases.push(entry);
  byId.set(entry.id, entry);
  bySlug.set(entry.slug, entry);
  added += 1;
}

if (added) await writeFile(biasesPath, `${JSON.stringify(biases, null, 2)}\n`);
console.log(`Curated concepts applied: ${curated.entries?.length || 0} maintained entries, ${added} added to working corpus.`);
