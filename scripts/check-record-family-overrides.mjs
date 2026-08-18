import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const taxonomy = JSON.parse(await readFile("data/taxonomy-v2.json", "utf8"));
const overrides = taxonomy.recordFamilyOverrides || {};
const byId = new Map(biases.map((bias) => [String(bias.id), bias]));
const familyFor = (bias) => overrides[String(bias.id)] || taxonomy.directCategoryFamily[bias.typeOfBias] || null;

for (const [id, family] of Object.entries(overrides)) {
  if (!byId.has(id)) throw new Error(`Family override ${id} points to a non-published record.`);
  if (!taxonomy.families[family]) throw new Error(`Family override ${id} points to unknown family ${family}.`);
}
for (const [id, contexts] of Object.entries(taxonomy.recordContexts || {})) {
  if (!byId.has(id)) throw new Error(`Context override ${id} points to a non-published record.`);
  if (!Array.isArray(contexts) || !contexts.length) throw new Error(`Context override ${id} must contain at least one context.`);
}

const groups = new Map();
for (const bias of biases) {
  const family = familyFor(bias);
  if (!family) continue;
  if (!groups.has(family)) groups.set(family, []);
  groups.get(family).push(bias);
}
const families = [...groups.entries()].filter(([, records]) => records.length >= taxonomy.hubMinimumRecords);
const publishedFamilySlugs = new Set(families.map(([slug]) => slug));
const sitemap = await readFile("dist/sitemap.xml", "utf8");
const explore = await readFile("dist/explore/index.html", "utf8");
const mappedCount = biases.filter((bias) => familyFor(bias)).length;

if (!explore.includes(`${mappedCount} of ${biases.length} published entries now have a reviewed v2 family mapping.`)) {
  throw new Error("Explore page does not expose the current reviewed family count.");
}

for (const [slug, records] of families) {
  const page = resolve("dist", "families", slug, "index.html");
  await access(page);
  const html = await readFile(page, "utf8");
  if (!sitemap.includes(`<loc>${SITE}/families/${slug}/</loc>`)) throw new Error(`${slug}: full family hub is missing from sitemap.`);
  for (const bias of records) {
    if (!html.includes(`/biases/${bias.slug}/`)) throw new Error(`${slug}: family hub is missing ${bias.slug}.`);
  }
}

for (const id of Object.keys(overrides)) {
  const bias = byId.get(id);
  const family = overrides[id];
  const html = await readFile(resolve("dist", "biases", bias.slug, "index.html"), "utf8");
  if (publishedFamilySlugs.has(family) && !html.includes(`href="/families/${family}/"`)) {
    throw new Error(`${bias.slug}: record-level family ${family} is not linked from the bias page.`);
  }
}

console.log(`Record-family override check passed: ${Object.keys(overrides).length} overrides, ${mappedCount} total mapped entries, ${families.length} family hubs.`);
