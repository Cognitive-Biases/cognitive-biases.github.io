import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Durable roadmap for the Metalhatscats long-form migration.
// Probes the Wayback Machine because the live legacy URLs now 308-redirect
// to the new canonical site (see docs/migration-map.md). Output is a local
// working artifact under .artifacts/long-form-migration/ and is not published.

const OUT_DIR = ".artifacts/long-form-migration";
const WAYBACK = "https://archive.org/wayback/available?url=";
const PROBE_DELAY_MS = 1200;
const PROBE_RETRIES = 4;

const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const duplicateDispositions = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicateDispositions.groups || []).flatMap((group) => group.duplicateIds || []));

const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name)).sort();
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const reviewBySlug = new Map(evidenceDocs.flatMap((doc) => doc.reviews || []).map((review) => [review.slug, review]));

const longFormFiles = (await readdir("data/long-form")).filter((name) => name.endsWith(".json"));
const longFormBySlug = new Map();
for (const name of longFormFiles) {
  const entry = JSON.parse(await readFile(join("data/long-form", name), "utf8"));
  const words = [entry.lede, ...entry.sections.flatMap((section) => section.paragraphs), ...entry.checklist, entry.boundaryNote]
    .join(" ").match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || [];
  longFormBySlug.set(entry.slug, { words: words.length, sections: entry.sections.length });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const probeLegacy = async (url) => {
  for (let attempt = 1; attempt <= PROBE_RETRIES; attempt += 1) {
    try {
      const response = await fetch(WAYBACK + encodeURIComponent(url));
      if (response.status === 429) {
        await sleep(PROBE_DELAY_MS * attempt * 2);
        continue;
      }
      if (!response.ok) return { probed: false, found: false, archiveUrl: null };
      const data = await response.json();
      const snapshot = data.archived_snapshots?.closest;
      return { probed: true, found: Boolean(snapshot?.available), archiveUrl: snapshot?.url || null };
    } catch {
      await sleep(PROBE_DELAY_MS * attempt);
    }
  }
  return { probed: false, found: false, archiveUrl: null };
};

const onlyInventory = process.argv.includes("--no-probe");
const rows = [];
for (const bias of [...biases].sort((a, b) => a.slug.localeCompare(b.slug))) {
  const isDuplicate = duplicateIds.has(bias.id);
  const review = reviewBySlug.get(bias.slug);
  const longForm = longFormBySlug.get(bias.slug);
  const legacyUrl = `https://metalhatscats.com/cognitive-biases/${bias.slug}`;
  const probe = onlyInventory || isDuplicate ? { probed: false, found: false, archiveUrl: null } : await probeLegacy(legacyUrl);
  if (!onlyInventory && !isDuplicate) await sleep(PROBE_DELAY_MS);

  let status;
  if (isDuplicate) status = "duplicate-alias";
  else if (longForm) status = "migrated";
  else if (review && probe.found) status = "ready-to-migrate";
  else if (review && !probe.found) status = probe.probed ? "legacy-not-found" : "manual-review";
  else if (!review && probe.found) status = "needs-evidence-review";
  else status = probe.probed ? "legacy-not-found" : "manual-review";

  rows.push({
    canonicalSlug: bias.slug,
    title: bias.title,
    legacyUrl,
    legacyArticleFound: probe.found,
    legacyArchiveUrl: probe.archiveUrl,
    legacyProbed: probe.probed,
    evidenceReviewFound: Boolean(review),
    evidenceReviewedAt: review?.reviewedAt || review?.date || null,
    alreadyHasLongForm: Boolean(longForm),
    longFormWords: longForm?.words || 0,
    migrationStatus: status,
  });
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(join(OUT_DIR, "inventory.json"), `${JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), rows }, null, 2)}\n`);
const csvHeader = "canonicalSlug,legacyUrl,legacyArticleFound,evidenceReviewFound,alreadyHasLongForm,longFormWords,migrationStatus";
const csv = [csvHeader, ...rows.map((row) => [row.canonicalSlug, row.legacyUrl, row.legacyArticleFound, row.evidenceReviewFound, row.alreadyHasLongForm, row.longFormWords, row.migrationStatus].join(","))].join("\n");
await writeFile(join(OUT_DIR, "inventory.csv"), `${csv}\n`);

const count = (status) => rows.filter((row) => row.migrationStatus === status).length;
console.log(`Long-form migration inventory (${rows.length} canonical published concepts):`);
console.log(`  migrated:              ${count("migrated")}`);
console.log(`  ready-to-migrate:      ${count("ready-to-migrate")}`);
console.log(`  needs-evidence-review: ${count("needs-evidence-review")}`);
console.log(`  legacy-not-found:      ${count("legacy-not-found")}`);
console.log(`  duplicate-alias:       ${count("duplicate-alias")}`);
console.log(`  manual-review:         ${count("manual-review")}`);
console.log(`Wrote ${OUT_DIR}/inventory.json and inventory.csv`);
