import { readFile } from "node:fs/promises";

const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const counts = new Map();
for (const bias of biases) counts.set(bias.typeOfBias, (counts.get(bias.typeOfBias) || 0) + 1);

const categories = [...counts.entries()]
  .map(([category, count]) => ({ category, count }))
  .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

console.log(`Category inventory (${categories.length} categories):`);
for (const { category, count } of categories) console.log(`- ${category}: ${count}`);
