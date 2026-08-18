import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const biases = JSON.parse(await readFile("data/biases.json", "utf8"));
const editorialFiles = (await readdir("data"))
  .filter((name) => /^editorial-overrides(?:-[a-z0-9-]+)?\.json$/i.test(name))
  .sort();
const editorialDocs = await Promise.all(editorialFiles.map(async (name) => ({
  name,
  document: JSON.parse(await readFile(join("data", name), "utf8")),
})));
const byId = new Map(biases.map((bias) => [bias.id, bias]));
const explore = await readFile(resolve("dist", "explore", "index.html"), "utf8");
const seenIds = new Set();
const seenSlugs = new Set();
let total = 0;

for (const { name, document } of editorialDocs) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(document.reviewedAt || "")) throw new Error(`${name}: invalid reviewedAt date.`);
  for (const override of document.entries || []) {
    total += 1;
    if (seenIds.has(override.id)) throw new Error(`${name}: duplicate editorial override id ${override.id}.`);
    if (seenSlugs.has(override.slug)) throw new Error(`${name}: duplicate editorial override slug ${override.slug}.`);
    seenIds.add(override.id);
    seenSlugs.add(override.slug);

    const record = byId.get(override.id);
    if (!record || record.slug !== override.slug) throw new Error(`${override.slug}: override record identity mismatch after prepare:data.`);
    if (record.title !== override.title) throw new Error(`${override.slug}: working-copy title does not match reviewed override.`);
    if (record.description !== override.description) throw new Error(`${override.slug}: working-copy description does not match reviewed override.`);
    if (record.updatedAt?.slice(0, 10) !== document.reviewedAt) throw new Error(`${override.slug}: reviewed top-copy date did not propagate to updatedAt.`);
    if (!override.previousTitle || override.previousTitle === override.title) throw new Error(`${override.slug}: previousTitle regression marker is missing.`);

    const html = await readFile(resolve("dist", "biases", override.slug, "index.html"), "utf8");
    if (!html.includes(override.title.replaceAll("&", "&amp;"))) throw new Error(`${override.slug}: canonical page does not render the reviewed title.`);
    if (html.includes(override.previousTitle)) throw new Error(`${override.slug}: canonical page regressed to the replaced title.`);
    if (!html.includes('class="evidence-review"')) throw new Error(`${override.slug}: top-copy correction lost its evidence-review prerequisite.`);
    if (!explore.includes(override.title.replaceAll("&", "&amp;"))) throw new Error(`${override.slug}: Explore card does not render the reviewed title.`);
    if (explore.includes(override.previousTitle)) throw new Error(`${override.slug}: Explore still exposes the replaced title.`);
  }
}

console.log(`Editorial override check passed: ${total} evidence-aligned top-copy corrections from ${editorialFiles.length} curated files propagated to source working copy, canonical pages, and Explore without title regressions.`);
