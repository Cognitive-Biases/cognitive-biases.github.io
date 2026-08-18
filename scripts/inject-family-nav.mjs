import { readFile, writeFile } from "node:fs/promises";

const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const taxonomy = JSON.parse(await readFile("data/taxonomy-v2.json", "utf8"));
const familyFor = (bias) => taxonomy.directCategoryFamily[bias.typeOfBias] || null;
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

const groups = new Map();
for (const bias of biases) {
  const family = familyFor(bias);
  if (!family) continue;
  if (!groups.has(family)) groups.set(family, []);
  groups.get(family).push(bias);
}
const families = [...groups.entries()]
  .filter(([, records]) => records.length >= taxonomy.hubMinimumRecords)
  .map(([slug, records]) => ({ slug, records, ...taxonomy.families[slug] }))
  .filter((family) => family.label && family.description)
  .sort((a, b) => b.records.length - a.records.length || a.label.localeCompare(b.label));
const reviewed = biases.filter((bias) => familyFor(bias)).length;
const cards = families.map((family) => `<a class="family-card" href="/families/${family.slug}/"><strong>${escapeHtml(family.label)}</strong><span>${family.records.length} reviewed entries</span><small>${escapeHtml(family.description)}</small></a>`).join("");
const block = `<section class="family-strip" aria-labelledby="family-heading"><div class="family-strip__head"><div><p class="kicker">New taxonomy</p><h2 id="family-heading">Browse by cognitive mechanism</h2></div><p>${reviewed} of ${biases.length} published entries now have a direct v2 family mapping. Ambiguous entries stay unassigned until reviewed.</p></div><div class="family-grid">${cards}</div></section>`;

const path = "dist/explore/index.html";
let html = await readFile(path, "utf8");
if (!html.includes('id="family-heading"')) {
  const marker = '<div class="filter" role="search">';
  if (!html.includes(marker)) throw new Error("Explore family navigation marker was not found.");
  html = html.replace(marker, `${block}${marker}`);
  await writeFile(path, html);
}
console.log(`Family navigation verified: ${families.length} hubs, ${reviewed} direct mappings.`);
