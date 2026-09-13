import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const canonical = JSON.parse(await readFile("data/biases.json", "utf8"));
const names = (await readdir("data/de"))
  .filter((name) => name === "biases.json" || /^biases-reviewed-expansion-\d+\.json$/i.test(name) || /^biases-catalog-\d+\.json$/i.test(name))
  .sort();
const docs = await Promise.all(names.map(async (name) => JSON.parse(await readFile(join("data/de", name), "utf8"))));
const german = docs.flatMap((doc) => doc.entries || []);

const canonicalPublished = canonical.filter((entry) => entry.published === true && entry.status !== "merged-duplicate");
const canonicalSlugs = new Set(canonicalPublished.map((entry) => entry.slug));
const germanSlugs = new Set(german.map((entry) => entry.slug));
const missing = canonicalPublished.filter((entry) => !germanSlugs.has(entry.slug));
const supplementalAllowed = new Set(["cognitive-bias-mere-urgency-effect"]);
const unexpectedExtra = german.filter((entry) => !canonicalSlugs.has(entry.slug) && !supplementalAllowed.has(entry.slug));
const supplemental = german.filter((entry) => !canonicalSlugs.has(entry.slug) && supplementalAllowed.has(entry.slug));
const duplicates = german.map((entry) => entry.slug).filter((slug, index, all) => all.indexOf(slug) !== index);

console.log(`Canonical published concepts: ${canonicalPublished.length}`);
console.log(`German localized concepts: ${germanSlugs.size}`);
console.log(`Canonical concepts localized in German: ${canonicalPublished.length - missing.length}`);
console.log(`Missing German concepts: ${missing.length}`);
if (missing.length) {
  console.log("\nMISSING_GERMAN_START");
  for (const entry of missing) console.log(`${entry.slug}\t${entry.title}\t${entry.typeOfBias || ""}`);
  console.log("MISSING_GERMAN_END");
}
if (supplemental.length) {
  console.log("\nSUPPLEMENTAL_GERMAN_START");
  for (const entry of supplemental) console.log(`${entry.slug}\t${entry.title}`);
  console.log("SUPPLEMENTAL_GERMAN_END");
}
if (unexpectedExtra.length) {
  console.log("\nUNEXPECTED_EXTRA_GERMAN_START");
  for (const entry of unexpectedExtra) console.log(`${entry.slug}\t${entry.title}`);
  console.log("UNEXPECTED_EXTRA_GERMAN_END");
}
if (duplicates.length) console.log(`Duplicate German slugs: ${[...new Set(duplicates)].join(", ")}`);

if (missing.length || unexpectedExtra.length || duplicates.length) process.exit(1);
console.log("Full German catalog parity: PASS");
