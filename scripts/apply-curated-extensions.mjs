import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dataFiles = await readdir("data");

async function mergeEntries({ targetPath, filePattern, updatedAt = false }) {
  const base = JSON.parse(await readFile(targetPath, "utf8"));
  const files = dataFiles.filter((name) => filePattern.test(name)).sort();
  const bySlug = new Map((base.entries || []).map((entry, index) => [entry.slug, index]));
  let added = 0;
  let updated = 0;
  let newest = base.updatedAt || "";

  for (const name of files) {
    const extension = JSON.parse(await readFile(join("data", name), "utf8"));
    if (updatedAt && extension.updatedAt && extension.updatedAt > newest) newest = extension.updatedAt;
    for (const entry of extension.entries || []) {
      if (!entry.slug) throw new Error(`${name}: curated entry is missing slug.`);
      const index = bySlug.get(entry.slug);
      if (index === undefined) {
        base.entries.push(entry);
        bySlug.set(entry.slug, base.entries.length - 1);
        added += 1;
      } else if (JSON.stringify(base.entries[index]) !== JSON.stringify(entry)) {
        base.entries[index] = entry;
        updated += 1;
      }
    }
  }

  if (updatedAt && newest) base.updatedAt = newest;
  if (added || updated) await writeFile(targetPath, `${JSON.stringify(base, null, 2)}\n`);
  return { files: files.length, added, updated };
}

const comparisons = await mergeEntries({
  targetPath: "data/comparisons.json",
  filePattern: /^comparisons-[a-z0-9-]+\.json$/i
});
const research = await mergeEntries({
  targetPath: "data/research-notes.json",
  filePattern: /^research-notes-[a-z0-9-]+\.json$/i,
  updatedAt: true
});

console.log(`Curated extensions applied: comparisons ${comparisons.added} added/${comparisons.updated} updated from ${comparisons.files} file(s); research ${research.added} added/${research.updated} updated from ${research.files} file(s).`);
