import { access, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_PATH = "data/ru/biases.json";
const EXPANSION_RE = /^biases-reviewed-expansion-\d+\.json$/i;
const DIST_DATA = "dist/data/ru/biases.json";
const DIST_BIASES = "dist/ru/biases";

const baseRaw = await readFile(BASE_PATH, "utf8");
const baseDoc = JSON.parse(baseRaw);
const names = (await readdir("data/ru")).filter((name) => EXPANSION_RE.test(name)).sort();
if (!names.length) throw new Error("Reviewed Russian expansion files are missing.");

const expansionDocs = await Promise.all(names.map(async (name) => JSON.parse(await readFile(join("data/ru", name), "utf8"))));
for (const [index, doc] of expansionDocs.entries()) {
  if (doc.locale !== "ru" || doc.state !== "reviewed") throw new Error(`${names[index]} must be locale=ru and state=reviewed.`);
}

const entries = [...(baseDoc.entries || []), ...expansionDocs.flatMap((doc) => doc.entries || [])];
const bySlug = new Map();
const hasRussian = (value) => /[А-Яа-яЁё]/.test(String(value || ""));
for (const entry of entries) {
  if (!entry.slug || bySlug.has(entry.slug)) throw new Error(`Duplicate or missing Russian reviewed slug: ${entry.slug || "(empty)"}`);
  bySlug.set(entry.slug, entry);
  for (const field of ["title", "summary", "trap", "evidence", "boundary"]) {
    if (!hasRussian(entry[field])) throw new Error(`${entry.slug}: ${field} must contain reviewed Russian prose.`);
  }
  if (!entry.englishTitle) throw new Error(`${entry.slug}: canonical English title is required.`);
  if (!Array.isArray(entry.actions) || entry.actions.length < 3 || !entry.actions.every(hasRussian)) {
    throw new Error(`${entry.slug}: at least three Russian practical actions are required.`);
  }
}

const evidenceClasses = JSON.parse(await readFile("data/evidence-classes.json", "utf8"));
const expected = Object.keys(evidenceClasses.bySlug || {}).sort();
const actual = [...bySlug.keys()].sort();
if (expected.length !== actual.length || expected.some((slug, index) => slug !== actual[index])) {
  const missing = expected.filter((slug) => !bySlug.has(slug));
  const extra = actual.filter((slug) => !evidenceClasses.bySlug?.[slug]);
  throw new Error(`Russian reviewed evidence coverage must be exact. Expected ${expected.length}, got ${actual.length}; missing=${missing.join(",") || "none"}; extra=${extra.join(",") || "none"}.`);
}

const mergedDoc = {
  ...baseDoc,
  updatedAt: expansionDocs.map((doc) => doc.updatedAt).filter(Boolean).sort().at(-1) || baseDoc.updatedAt,
  entries
};

try {
  await writeFile(BASE_PATH, `${JSON.stringify(mergedDoc, null, 2)}\n`);
  await import("./generate-ru-localization.mjs");
} finally {
  await writeFile(BASE_PATH, baseRaw);
}

const published = JSON.parse(await readFile(DIST_DATA, "utf8"));
const publishedSlugs = new Set((published.entries || []).map((entry) => entry.slug));
if (publishedSlugs.size !== expected.length || expected.some((slug) => !publishedSlugs.has(slug))) {
  throw new Error(`Published Russian data does not contain all ${expected.length} evidence-reviewed concepts.`);
}
for (const slug of expected) {
  await access(join(DIST_BIASES, slug, "index.html"));
}

console.log(`Russian reviewed evidence layer expanded to ${expected.length}/${expected.length} controlled concepts from ${names.length + 1} curated file(s).`);
