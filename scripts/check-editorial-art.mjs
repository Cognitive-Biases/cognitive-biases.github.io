import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

const published = JSON.parse(await readFile("data/biases.json", "utf8")).filter((record) => record.published);
const files = (await readdir("public/assets/editorial/biases")).filter((file) => file.endsWith(".webp"));
const available = new Set(files);
const missing = published.filter((record) => !available.has(`${record.slug}.webp`));

if (missing.length) {
  throw new Error(`Missing unique editorial art for ${missing.length} published bias(es): ${missing.map((record) => record.slug).join(", ")}`);
}

const hashes = new Map();
for (const file of files) {
  const bytes = await readFile(`public/assets/editorial/biases/${file}`);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const group = hashes.get(hash) || [];
  group.push(file);
  hashes.set(hash, group);
}

const duplicates = [...hashes.values()].filter((group) => group.length > 1);
if (duplicates.length) {
  throw new Error(`Duplicate editorial image content found: ${duplicates.map((group) => group.join(" = ")).join("; ")}`);
}

const map = JSON.parse(await readFile("dist/data/editorial-art-map.json", "utf8"));
const nonUnique = map.entries.filter((entry) => !entry.unique || !entry.asset.startsWith("/assets/editorial/biases/"));
if (nonUnique.length) {
  throw new Error(`Rendered editorial map still uses fallback art for ${nonUnique.length} published bias(es).`);
}

console.log(`Editorial art check passed: ${published.length}/${published.length} published biases use unique WebP assets with zero duplicate hashes.`);
