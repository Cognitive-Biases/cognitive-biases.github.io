import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const biases = JSON.parse(await readFile("data/biases.json", "utf8"));
const overrides = JSON.parse(await readFile("data/editorial-overrides.json", "utf8"));
const byId = new Map(biases.map((bias) => [bias.id, bias]));
const explore = await readFile(resolve("dist", "explore", "index.html"), "utf8");

for (const override of overrides.entries || []) {
  const record = byId.get(override.id);
  if (!record || record.slug !== override.slug) throw new Error(`${override.slug}: override record identity mismatch after prepare:data.`);
  if (record.title !== override.title) throw new Error(`${override.slug}: working-copy title does not match reviewed override.`);
  if (record.description !== override.description) throw new Error(`${override.slug}: working-copy description does not match reviewed override.`);
  if (record.updatedAt?.slice(0, 10) !== overrides.reviewedAt) throw new Error(`${override.slug}: reviewed top-copy date did not propagate to updatedAt.`);
  if (!override.previousTitle || override.previousTitle === override.title) throw new Error(`${override.slug}: previousTitle regression marker is missing.`);

  const html = await readFile(resolve("dist", "biases", override.slug, "index.html"), "utf8");
  if (!html.includes(override.title.replaceAll("&", "&amp;"))) throw new Error(`${override.slug}: canonical page does not render the reviewed title.`);
  if (html.includes(override.previousTitle)) throw new Error(`${override.slug}: canonical page regressed to the replaced title.`);
  if (!html.includes('class="evidence-review"')) throw new Error(`${override.slug}: top-copy correction lost its evidence-review prerequisite.`);
  if (!explore.includes(override.title.replaceAll("&", "&amp;"))) throw new Error(`${override.slug}: Explore card does not render the reviewed title.`);
  if (explore.includes(override.previousTitle)) throw new Error(`${override.slug}: Explore still exposes the replaced title.`);
}

console.log(`Editorial override check passed: ${overrides.entries.length} evidence-aligned top-copy corrections propagated to source working copy, canonical pages, and Explore without title regressions.`);
