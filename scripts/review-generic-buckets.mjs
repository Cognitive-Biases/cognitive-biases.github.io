import { readFile } from "node:fs/promises";

const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const taxonomy = JSON.parse(await readFile("data/taxonomy-v2.json", "utf8"));
const targetCategories = new Set(["Cognitive Bias", "Decision Making", "Heuristic Bias", "Human-Robot Interaction"]);
const overrides = taxonomy.recordFamilyOverrides || {};
const rows = biases
  .filter((bias) => targetCategories.has(bias.typeOfBias) && !overrides[String(bias.id)])
  .sort((a, b) => a.typeOfBias.localeCompare(b.typeOfBias) || a.id - b.id);

const firstSentence = (value = "") => String(value).split(/\n|(?<=[.!?])\s+/)[0].trim().replace(/\s+/g, " ");

console.log(`Unresolved generic-bucket review queue: ${rows.length} records.`);
let current = null;
for (const bias of rows) {
  if (bias.typeOfBias !== current) {
    current = bias.typeOfBias;
    console.log(`\n[${current}]`);
  }
  console.log(`#${bias.id} | ${bias.slug} | ${bias.title}`);
  console.log(`  ${firstSentence(bias.description)}`);
}
