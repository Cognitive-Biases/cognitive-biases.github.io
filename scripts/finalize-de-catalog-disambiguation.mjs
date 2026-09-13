import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const overrides = new Map([
  ["belief-perseverance-conservatism-bias", "Konservatismus-Bias bei Überzeugungen"],
  ["confirmation-bias-conservatism-bias", "Konservatismus-Bias beim Evidenz-Update"]
]);

const dataPath = join(OUT, "data", "de", "biases.json");
const doc = JSON.parse(await readFile(dataPath, "utf8"));
for (const entry of doc.entries || []) {
  const next = overrides.get(entry.slug);
  if (!next) continue;
  const old = entry.title;
  entry.title = next;
  entry.aliases = [...new Set([...(entry.aliases || []), old])];
  const pagePath = join(OUT, "de", "biases", entry.slug, "index.html");
  let html = await readFile(pagePath, "utf8");
  html = html.split(old).join(next);
  await writeFile(pagePath, html);
}
await writeFile(dataPath, JSON.stringify(doc, null, 2) + "\n");

const indexPath = join(OUT, "de", "biases", "index.html");
let index = await readFile(indexPath, "utf8");
for (const [slug, next] of overrides) {
  const marker = `<a href="/de/biases/${slug}/">`;
  const start = index.indexOf(marker);
  if (start < 0) throw new Error(`${slug}: German collection card not found.`);
  const textStart = start + marker.length;
  const textEnd = index.indexOf("</a>", textStart);
  if (textEnd < 0) throw new Error(`${slug}: German collection link is malformed.`);
  index = index.slice(0, textStart) + next + index.slice(textEnd);
}
await writeFile(indexPath, index);
console.log(`German catalog title disambiguation applied to ${overrides.size} canonical entries.`);
