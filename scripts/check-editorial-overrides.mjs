import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const biases = JSON.parse(await readFile("data/biases.json", "utf8"));
const baseEditorialFile = "editorial-overrides.json";
const editorialFiles = (await readdir("data"))
  .filter((name) => /^editorial-overrides(?:-[a-z0-9-]+)?\.json$/i.test(name))
  .sort((a, b) => a === baseEditorialFile ? -1 : b === baseEditorialFile ? 1 : a.localeCompare(b));
const editorialDocs = await Promise.all(editorialFiles.map(async (name) => ({
  name,
  document: JSON.parse(await readFile(join("data", name), "utf8")),
})));
const byId = new Map(biases.map((bias) => [bias.id, bias]));
const explore = await readFile(resolve("dist", "explore", "index.html"), "utf8");
const selectedById = new Map();
const selectedBySlug = new Map();
let declarations = 0;
let superseded = 0;

for (const { name, document } of editorialDocs) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(document.reviewedAt || "")) throw new Error(`${name}: invalid reviewedAt date.`);
  for (const override of document.entries || []) {
    declarations += 1;
    const priorById = selectedById.get(override.id);
    const priorBySlug = selectedBySlug.get(override.slug);
    if (priorById || priorBySlug) {
      const sameIdentity = priorById?.override.slug === override.slug && priorBySlug?.override.id === override.id;
      if (!override.supersedes || !sameIdentity) {
        throw new Error(`${name}: duplicate editorial override ${override.id}/${override.slug} requires explicit supersedes:true and identical identity.`);
      }
      superseded += 1;
    }
    const selected = { name, document, override };
    selectedById.set(override.id, selected);
    selectedBySlug.set(override.slug, selected);
  }
}

if (selectedById.size !== selectedBySlug.size) throw new Error("Editorial override selection is inconsistent by id and slug.");

for (const { name, document, override } of selectedById.values()) {
  const record = byId.get(override.id);
  if (!record || record.slug !== override.slug) throw new Error(`${override.slug}: override record identity mismatch after prepare:data.`);
  if (record.title !== override.title) throw new Error(`${override.slug}: working-copy title does not match final reviewed override from ${name}.`);
  if (record.description !== override.description) throw new Error(`${override.slug}: working-copy description does not match final reviewed override from ${name}.`);
  if (record.updatedAt?.slice(0, 10) !== document.reviewedAt) throw new Error(`${override.slug}: reviewed top-copy date did not propagate to updatedAt.`);
  if (!override.previousTitle || override.previousTitle === override.title) throw new Error(`${override.slug}: previousTitle regression marker is missing.`);

  const html = await readFile(resolve("dist", "biases", override.slug, "index.html"), "utf8");
  const renderedTitle = override.title.replaceAll("&", "&amp;");
  if (!html.includes(renderedTitle)) throw new Error(`${override.slug}: canonical page does not render the final reviewed title.`);
  if (html.includes(override.previousTitle)) throw new Error(`${override.slug}: canonical page regressed to the replaced title.`);
  if (!html.includes('class="evidence-review"')) throw new Error(`${override.slug}: top-copy correction lost its evidence-review prerequisite.`);
  if (!explore.includes(renderedTitle)) throw new Error(`${override.slug}: Explore card does not render the final reviewed title.`);
  if (explore.includes(override.previousTitle)) throw new Error(`${override.slug}: Explore still exposes the replaced title.`);
}

console.log(`Editorial override check passed: ${selectedById.size} final evidence-aligned corrections from ${editorialFiles.length} curated files, ${superseded} explicit supersession(s), ${declarations} declarations validated.`);
