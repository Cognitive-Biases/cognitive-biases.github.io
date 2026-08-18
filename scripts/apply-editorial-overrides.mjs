import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dataPath = "data/biases.json";
const biases = JSON.parse(await readFile(dataPath, "utf8"));
const editorialFiles = (await readdir("data"))
  .filter((name) => /^editorial-overrides(?:-[a-z0-9-]+)?\.json$/i.test(name))
  .sort();
const editorialDocs = await Promise.all(editorialFiles.map(async (name) => ({
  name,
  document: JSON.parse(await readFile(join("data", name), "utf8")),
})));
const byId = new Map(biases.map((bias) => [bias.id, bias]));
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
const evidenceFiles = (await readdir("data"))
  .filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name))
  .sort();
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const reviewedSlugs = new Set(evidenceDocs.flatMap((document) => document.reviews || []).map((review) => review.slug));
const duplicateDispositions = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicateDispositions.groups || []).flatMap((group) => group.duplicateIds || []));
const seenIds = new Set();
const seenSlugs = new Set();
let changed = 0;
let totalOverrides = 0;

for (const { name, document } of editorialDocs) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(document.reviewedAt || "")) {
    throw new Error(`${name}: editorial overrides require a valid reviewedAt date.`);
  }
  for (const override of document.entries || []) {
    totalOverrides += 1;
    if (seenIds.has(override.id)) throw new Error(`${name}: duplicate editorial override id ${override.id} across curated files.`);
    if (seenSlugs.has(override.slug)) throw new Error(`${name}: duplicate editorial override slug ${override.slug} across curated files.`);
    seenIds.add(override.id);
    seenSlugs.add(override.slug);

    const byIdRecord = byId.get(override.id);
    const bySlugRecord = bySlug.get(override.slug);
    if (!byIdRecord || byIdRecord !== bySlugRecord) {
      const idResolution = byIdRecord ? `id ${override.id} -> ${byIdRecord.slug}` : `id ${override.id} -> missing`;
      const slugResolution = bySlugRecord ? `slug ${override.slug} -> id ${bySlugRecord.id}` : `slug ${override.slug} -> missing`;
      throw new Error(`${override.slug}: editorial override identity mismatch (${idResolution}; ${slugResolution}).`);
    }
    if (!byIdRecord.published) throw new Error(`${override.slug}: editorial override must target a published record.`);
    if (duplicateIds.has(byIdRecord.id)) throw new Error(`${override.slug}: editorial override must target a canonical record, not a duplicate alias.`);
    if (!reviewedSlugs.has(override.slug)) throw new Error(`${override.slug}: top-copy correction requires an evidence-reviewed canonical page first.`);
    if (!override.title || !override.description || !override.reason) throw new Error(`${override.slug}: editorial override is missing title, description, or rationale.`);
    if (override.description.length < 300) throw new Error(`${override.slug}: editorial override description is unexpectedly thin.`);

    const nextUpdatedAt = `${document.reviewedAt}T00:00:00.000Z`;
    if (byIdRecord.title !== override.title || byIdRecord.description !== override.description || byIdRecord.updatedAt !== nextUpdatedAt) {
      byIdRecord.title = override.title;
      byIdRecord.description = override.description;
      byIdRecord.updatedAt = nextUpdatedAt;
      changed += 1;
    }
  }
}

if (changed) await writeFile(dataPath, `${JSON.stringify(biases, null, 2)}\n`);
console.log(`Editorial overrides applied: ${totalOverrides} reviewed entries from ${editorialFiles.length} curated files, ${changed} working-copy records updated.`);
