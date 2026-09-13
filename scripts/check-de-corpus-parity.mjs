import { readFile, readdir } from "node:fs/promises";

const source = JSON.parse(await readFile("data/biases.json", "utf8"));
const published = (source || []).filter((entry) => entry.published !== false);
const publishedSlugs = published.map((entry) => entry.slug).filter(Boolean);
const sourceSet = new Set(publishedSlugs);

const names = (await readdir("data/de"))
  .filter((name) => /^biases-corpus-\d+\.json$/i.test(name))
  .sort();
const docs = await Promise.all(names.map(async (name) => JSON.parse(await readFile(`data/de/${name}`, "utf8"))));

const corpusEntries = docs.flatMap((doc) => doc.entries || []);
const seen = new Map();
for (const entry of corpusEntries) {
  if (!seen.has(entry.slug)) seen.set(entry.slug, []);
  seen.get(entry.slug).push(entry);
}

const missing = [...sourceSet].filter((slug) => !seen.has(slug)).sort();
const extras = [...seen.keys()].filter((slug) => !sourceSet.has(slug)).sort();
const duplicates = [...seen.entries()].filter(([, entries]) => entries.length > 1).map(([slug]) => slug).sort();
const incomplete = corpusEntries.filter((entry) =>
  !entry.slug || !entry.title || !entry.englishTitle || !entry.category || !entry.summary || !entry.trap ||
  !Array.isArray(entry.actions) || entry.actions.length < 3 || entry.actions.some((item) => !String(item || "").trim())
).map((entry) => entry.slug || "(missing slug)").sort();

console.log(`German corpus progress: ${seen.size}/${sourceSet.size} published canonical slugs localized across ${names.length} packs.`);
if (missing.length) console.error(`Missing (${missing.length}):\n${missing.join("\n")}`);
if (extras.length) console.error(`Extra/non-public (${extras.length}):\n${extras.join("\n")}`);
if (duplicates.length) console.error(`Duplicate corpus slugs (${duplicates.length}):\n${duplicates.join("\n")}`);
if (incomplete.length) console.error(`Incomplete German entries (${incomplete.length}):\n${incomplete.join("\n")}`);

if (missing.length || extras.length || duplicates.length || incomplete.length) process.exit(1);
console.log("German corpus parity check passed: exact published-slug coverage and required localized fields are complete.");
