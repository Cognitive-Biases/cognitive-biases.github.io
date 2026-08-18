import { readFile } from "node:fs/promises";

const biases = JSON.parse(await readFile("data/biases.json", "utf8"));
const errors = [];
const warnings = [];
const seenIds = new Map();
const seenSlugs = new Map();
const seenTitles = new Map();
const allIds = new Set(biases.map((bias) => bias.id));

for (const [index, bias] of biases.entries()) {
  const label = `record ${index + 1}${bias.title ? ` (${bias.title})` : ""}`;
  for (const field of ["id", "title", "slug", "typeOfBias", "description"]) {
    if (bias[field] === undefined || bias[field] === null || String(bias[field]).trim() === "") {
      errors.push(`${label}: missing ${field}`);
    }
  }

  if (typeof bias.published !== "boolean") warnings.push(`${label}: published should be boolean`);

  if (seenIds.has(bias.id)) errors.push(`${label}: duplicate id ${bias.id}; first seen at record ${seenIds.get(bias.id)}`);
  else seenIds.set(bias.id, index + 1);

  if (seenSlugs.has(bias.slug)) errors.push(`${label}: duplicate slug ${bias.slug}; first seen at record ${seenSlugs.get(bias.slug)}`);
  else seenSlugs.set(bias.slug, index + 1);

  const normalizedTitle = String(bias.title || "").trim().toLowerCase();
  if (normalizedTitle) {
    if (seenTitles.has(normalizedTitle)) warnings.push(`${label}: title duplicates record ${seenTitles.get(normalizedTitle)}`);
    else seenTitles.set(normalizedTitle, index + 1);
  }

  if (bias.updatedAt && Number.isNaN(Date.parse(bias.updatedAt))) warnings.push(`${label}: invalid updatedAt ${bias.updatedAt}`);

  for (const relatedId of bias.related || []) {
    if (!allIds.has(relatedId)) warnings.push(`${label}: related id ${relatedId} does not exist`);
    if (relatedId === bias.id) warnings.push(`${label}: related list points to itself`);
  }
}

if (warnings.length) {
  console.warn(`Data validation warnings: ${warnings.length}`);
  for (const warning of warnings.slice(0, 25)) console.warn(`- ${warning}`);
  if (warnings.length > 25) console.warn(`- ... ${warnings.length - 25} more warning(s)`);
}

if (errors.length) {
  console.error(`Data validation errors: ${errors.length}`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Data validation passed: ${biases.length} records checked.`);
}
