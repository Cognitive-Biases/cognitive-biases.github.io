import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const biasesPath = "data/biases.json";
const biases = JSON.parse(await readFile(biasesPath, "utf8"));
const curatedFiles = (await readdir("data"))
  .filter((name) => /^curated-concepts(?:-[a-z0-9-]+)?\.json$/i.test(name))
  .sort();

const byId = new Map(biases.map((bias) => [bias.id, bias]));
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
let maintained = 0;
let added = 0;

for (const name of curatedFiles) {
  const curated = JSON.parse(await readFile(join("data", name), "utf8"));
  for (const entry of curated.entries || []) {
    maintained += 1;
    const sameId = byId.get(entry.id);
    const sameSlug = bySlug.get(entry.slug);
    if (sameId && sameId.slug !== entry.slug) throw new Error(`${name}: curated concept id ${entry.id} conflicts with ${sameId.slug}.`);
    if (sameSlug && sameSlug.id !== entry.id) throw new Error(`${name}: curated concept slug ${entry.slug} conflicts with id ${sameSlug.id}.`);
    if (sameId || sameSlug) continue;
    biases.push(entry);
    byId.set(entry.id, entry);
    bySlug.set(entry.slug, entry);
    added += 1;
  }
}

if (added) await writeFile(biasesPath, `${JSON.stringify(biases, null, 2)}\n`);
console.log(`Curated concepts applied: ${maintained} maintained entries from ${curatedFiles.length} file(s), ${added} added to working corpus.`);
