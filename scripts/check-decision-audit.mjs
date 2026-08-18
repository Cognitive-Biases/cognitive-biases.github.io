import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
const duplicates = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const reviews = evidenceDocs.flatMap((document) => document.reviews || []);
const audit = await readFile(resolve("dist", "tools", "decision-audit", "index.html"), "utf8");
const script = await readFile(resolve("dist", "assets", "decision-audit.js"), "utf8");
const sitemap = await readFile("dist/sitemap.xml", "utf8");
const canonical = `${SITE}/tools/decision-audit/`;

if (!audit.includes(`<link rel="canonical" href="${canonical}">`)) throw new Error("Decision Audit is missing its canonical URL.");
if (!audit.includes('"@type":"WebApplication"') || !audit.includes('"@type":"BreadcrumbList"')) throw new Error("Decision Audit is missing WebApplication/Breadcrumb structured data.");
if (!audit.includes("Recognize → Test → Counter → Decide")) throw new Error("Decision Audit is missing the product flow contract.");
if (!audit.includes("does not detect a bias") && !audit.includes("does not infer hidden motives")) throw new Error("Decision Audit is missing the no-diagnosis boundary.");
if (!audit.includes("stored only in this browser") || !script.includes("localStorage")) throw new Error("Decision Audit local-first behavior is not visible and implemented.");
if (/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/.test(script)) throw new Error("Decision Audit client script must not send audit data over the network.");
if (!sitemap.includes(`<loc>${canonical}</loc>`)) throw new Error("Decision Audit is missing from sitemap.");

const requiredFields = ["decision", "confidence", "pattern", "change-evidence", "counter-evidence", "alternative", "outside-view", "failure-condition", "missing-information", "countermeasure-note", "next-action", "review-date", "review-trigger", "final-confidence"];
for (const id of requiredFields) {
  if (!audit.includes(`id="${id}"`)) throw new Error(`Decision Audit is missing field #${id}.`);
}

for (const review of reviews) {
  const bias = bySlug.get(review.slug);
  if (!bias) throw new Error(`${review.slug}: evidence review has no published bias for Decision Audit.`);
  if (duplicateIds.has(bias.id)) throw new Error(`${review.slug}: Decision Audit lens targets duplicate alias.`);
  if (!audit.includes(`value="${review.slug}"`)) throw new Error(`${review.slug}: reviewed pattern is missing from Decision Audit selector.`);
  const biasHtml = await readFile(resolve("dist", "biases", review.slug, "index.html"), "utf8");
  if (!biasHtml.includes(`/tools/decision-audit/?bias=${review.slug}`) || !biasHtml.includes('class="audit-cta"')) {
    throw new Error(`${review.slug}: reviewed page is missing reciprocal Decision Audit CTA.`);
  }
}

for (const path of ["index.html", "explore/index.html", "evidence/index.html", "compare/index.html", "tools/decision-audit/index.html"]) {
  const html = await readFile(resolve("dist", path), "utf8");
  if (!html.includes('href="/tools/decision-audit/"')) throw new Error(`${path}: primary navigation is missing Audit.`);
}

if (!script.includes("navigator.clipboard.writeText") || !script.includes("localStorage.removeItem")) throw new Error("Decision Audit copy/reset behavior is incomplete.");
if (!script.includes('new URLSearchParams(location.search).get("bias")')) throw new Error("Decision Audit bias preselection is missing.");

console.log(`Decision Audit check passed: local-only state, ${reviews.length} evidence-reviewed lenses, reciprocal CTAs, sitemap, schema, navigation, copy/reset, and no network transport verified.`);
