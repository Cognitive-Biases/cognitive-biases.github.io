import { readFile, writeFile } from "node:fs/promises";

const corpusPath = "data/biases.json";
const biases = JSON.parse(await readFile(corpusPath, "utf8"));
const additions = JSON.parse(await readFile("data/curated-additions.json", "utf8"));
const byId = new Map(biases.map((bias) => [bias.id, bias]));
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
const seenIds = new Set();
const seenSlugs = new Set();
let changed = 0;

for (const entry of additions.entries || []) {
  if (seenIds.has(entry.id)) throw new Error(`Duplicate curated addition id ${entry.id}.`);
  if (seenSlugs.has(entry.slug)) throw new Error(`Duplicate curated addition slug ${entry.slug}.`);
  seenIds.add(entry.id);
  seenSlugs.add(entry.slug);
  if (!Number.isInteger(entry.id) || entry.id < 1) throw new Error(`${entry.slug}: curated addition requires a positive integer id.`);
  if (!entry.slug || !entry.title || !entry.description || !entry.typeOfBias) throw new Error(`Curated addition ${entry.id} is missing required fields.`);
  if (!Array.isArray(entry.related)) throw new Error(`${entry.slug}: related must be an array.`);
  if (entry.published !== true) throw new Error(`${entry.slug}: curated additions must be explicit published canonical entries.`);

  const existingById = byId.get(entry.id);
  const existingBySlug = bySlug.get(entry.slug);
  if (existingById && existingBySlug && existingById !== existingBySlug) {
    throw new Error(`${entry.slug}: id ${entry.id} and slug point to different corpus records.`);
  }
  if ((existingById && !existingBySlug) || (!existingById && existingBySlug)) {
    throw new Error(`${entry.slug}: curated addition conflicts with an existing id or slug.`);
  }

  if (!existingById) {
    const clone = structuredClone(entry);
    biases.push(clone);
    byId.set(clone.id, clone);
    bySlug.set(clone.slug, clone);
    changed += 1;
    continue;
  }

  const canonical = JSON.stringify(entry);
  const current = JSON.stringify({
    id: existingById.id,
    number: existingById.number,
    typeOfBias: existingById.typeOfBias,
    title: existingById.title,
    description: existingById.description,
    slug: existingById.slug,
    status: existingById.status,
    related: existingById.related,
    updatedAt: existingById.updatedAt,
    published: existingById.published,
  });
  if (canonical !== current) {
    Object.assign(existingById, structuredClone(entry));
    changed += 1;
  }
}

const ids = new Set();
const slugs = new Set();
for (const bias of biases) {
  if (ids.has(bias.id)) throw new Error(`Curated additions leave duplicate id ${bias.id}.`);
  if (slugs.has(bias.slug)) throw new Error(`Curated additions leave duplicate slug ${bias.slug}.`);
  ids.add(bias.id);
  slugs.add(bias.slug);
}
for (const entry of additions.entries || []) {
  for (const relatedId of entry.related) {
    if (!ids.has(relatedId)) throw new Error(`${entry.slug}: related id ${relatedId} does not exist after curated additions.`);
    if (relatedId === entry.id) throw new Error(`${entry.slug}: curated addition cannot relate to itself.`);
  }
}

biases.sort((a, b) => (a.number ?? a.id) - (b.number ?? b.id) || a.id - b.id);
if (changed) await writeFile(corpusPath, `${JSON.stringify(biases, null, 2)}\n`);
console.log(`Curated additions applied: ${additions.entries.length} entries, ${changed} working-copy records added or synchronized.`);
