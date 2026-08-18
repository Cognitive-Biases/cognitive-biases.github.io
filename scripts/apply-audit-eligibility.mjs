import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const evidenceFiles = (await readdir("data"))
  .filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name))
  .sort();
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const reviews = evidenceDocs.flatMap((document) => document.reviews || []);
const excluded = reviews.filter((review) => review.auditEligible === false);

const auditPath = join(OUT, "tools", "decision-audit", "index.html");
let audit = await readFile(auditPath, "utf8");

const dataMatch = audit.match(/<script type="application\/json" id="audit-pattern-data">([\s\S]*?)<\/script>/);
if (!dataMatch) throw new Error("Decision Audit pattern data block is missing before eligibility filtering.");
const patterns = JSON.parse(dataMatch[1]);
const excludedSlugs = new Set(excluded.map((review) => review.slug));
const eligiblePatterns = patterns.filter((pattern) => !excludedSlugs.has(pattern.slug));
audit = audit.replace(dataMatch[0], `<script type="application/json" id="audit-pattern-data">${JSON.stringify(eligiblePatterns).replaceAll("<", "\\u003c")}</script>`);

for (const review of excluded) {
  const option = new RegExp(`<option value="${review.slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}">[\\s\\S]*?<\\/option>`, "g");
  audit = audit.replace(option, "");
}
await writeFile(auditPath, audit);

for (const review of excluded) {
  const pagePath = join(OUT, "biases", review.slug, "index.html");
  let html = await readFile(pagePath, "utf8");
  if (html.includes(`/tools/decision-audit/?bias=${review.slug}`)) {
    html = html.replace(/<aside class="audit-cta">[\s\S]*?<\/aside>/, "");
    await writeFile(pagePath, html);
  }
}

console.log(`Decision Audit eligibility applied: ${eligiblePatterns.length}/${reviews.length} evidence-reviewed entries remain audit lenses; ${excluded.length} reviewed concepts excluded from self-audit.`);
