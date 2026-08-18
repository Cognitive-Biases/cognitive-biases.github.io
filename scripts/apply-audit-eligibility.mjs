import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const evidenceFiles = (await readdir("data"))
  .filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name))
  .sort();
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const reviews = evidenceDocs.flatMap((document) => document.reviews || []);
const explicit = JSON.parse(await readFile("data/audit-exclusions.json", "utf8")).entries || [];
const reviewedSlugs = new Set(reviews.map((review) => review.slug));
const explicitSlugs = new Set();
for (const entry of explicit) {
  if (!entry.slug || !entry.reason) throw new Error("Decision Audit exclusion entries require slug and reason.");
  if (!reviewedSlugs.has(entry.slug)) throw new Error(`${entry.slug}: Decision Audit exclusion must target an evidence-reviewed concept.`);
  if (explicitSlugs.has(entry.slug)) throw new Error(`${entry.slug}: Decision Audit exclusion is duplicated.`);
  explicitSlugs.add(entry.slug);
}
const excludedSlugs = new Set([
  ...reviews.filter((review) => review.auditEligible === false).map((review) => review.slug),
  ...explicitSlugs,
]);

const auditPath = join(OUT, "tools", "decision-audit", "index.html");
let audit = await readFile(auditPath, "utf8");

const dataMatch = audit.match(/<script type="application\/json" id="audit-pattern-data">([\s\S]*?)<\/script>/);
if (!dataMatch) throw new Error("Decision Audit pattern data block is missing before eligibility filtering.");
const patterns = JSON.parse(dataMatch[1]);
const eligiblePatterns = patterns.filter((pattern) => !excludedSlugs.has(pattern.slug));
audit = audit.replace(dataMatch[0], `<script type="application/json" id="audit-pattern-data">${JSON.stringify(eligiblePatterns).replaceAll("<", "\\u003c")}</script>`);

for (const slug of excludedSlugs) {
  const option = new RegExp(`<option value="${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}">[\\s\\S]*?<\\/option>`, "g");
  audit = audit.replace(option, "");
}
await writeFile(auditPath, audit);

for (const slug of excludedSlugs) {
  const pagePath = join(OUT, "biases", slug, "index.html");
  let html = await readFile(pagePath, "utf8");
  if (html.includes(`/tools/decision-audit/?bias=${slug}`)) {
    html = html.replace(/<aside class="audit-cta">[\s\S]*?<\/aside>/, "");
    await writeFile(pagePath, html);
  }
}

console.log(`Decision Audit eligibility applied: ${eligiblePatterns.length}/${reviews.length} evidence-reviewed entries remain audit lenses; ${excludedSlugs.size} reviewed concepts excluded (${explicitSlugs.size} explicit product exclusions).`);
