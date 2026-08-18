import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const contexts = JSON.parse(await readFile("data/contexts.json", "utf8"));
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
const duplicates = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const reviewedSlugs = new Set(evidenceDocs.flatMap((document) => document.reviews || []).map((review) => review.slug));
const sitemap = await readFile("dist/sitemap.xml", "utf8");
const hub = await readFile(resolve("dist", "contexts", "index.html"), "utf8");
const seenContexts = new Set();

if (!hub.includes(`<link rel="canonical" href="${SITE}/contexts/">`)) throw new Error("Contexts hub is missing canonical URL.");
if (!hub.includes('"@type":"CollectionPage"') || !hub.includes('"@type":"ItemList"')) throw new Error("Contexts hub is missing collection structured data.");
if (!sitemap.includes(`<loc>${SITE}/contexts/</loc>`)) throw new Error("Contexts hub is missing from sitemap.");

for (const context of contexts.entries || []) {
  if (seenContexts.has(context.slug)) throw new Error(`${context.slug}: duplicate context slug.`);
  seenContexts.add(context.slug);
  if (!Array.isArray(context.useWhen) || context.useWhen.length < 3) throw new Error(`${context.slug}: context signals are too thin.`);
  if (!Array.isArray(context.workflow) || context.workflow.length < 4) throw new Error(`${context.slug}: context workflow is too thin.`);
  if (!Array.isArray(context.lenses) || context.lenses.length < 3) throw new Error(`${context.slug}: context needs at least three lenses.`);
  const pageUrl = `${SITE}/contexts/${context.slug}/`;
  const html = await readFile(resolve("dist", "contexts", context.slug, "index.html"), "utf8");
  if (!html.includes(`<link rel="canonical" href="${pageUrl}">`)) throw new Error(`${context.slug}: canonical URL missing.`);
  if (!html.includes('"@type":"CollectionPage"') || !html.includes('"@type":"ItemList"') || !html.includes('"@type":"BreadcrumbList"')) throw new Error(`${context.slug}: structured data incomplete.`);
  if (!sitemap.includes(`<loc>${pageUrl}</loc>`)) throw new Error(`${context.slug}: missing from sitemap.`);
  if (!hub.includes(`/contexts/${context.slug}/`)) throw new Error(`${context.slug}: missing from contexts hub.`);
  const seenLenses = new Set();
  for (const lens of context.lenses) {
    if (seenLenses.has(lens.slug)) throw new Error(`${context.slug}: duplicate lens ${lens.slug}.`);
    seenLenses.add(lens.slug);
    const bias = bySlug.get(lens.slug);
    if (!bias) throw new Error(`${context.slug}: lens ${lens.slug} is not published.`);
    if (duplicateIds.has(bias.id)) throw new Error(`${context.slug}: lens ${lens.slug} is a duplicate alias.`);
    if (!reviewedSlugs.has(lens.slug)) throw new Error(`${context.slug}: lens ${lens.slug} is not evidence-reviewed.`);
    if (!html.includes(`/biases/${lens.slug}/#evidence`) || !html.includes(`/tools/decision-audit/?bias=${lens.slug}`)) {
      throw new Error(`${context.slug}: lens ${lens.slug} is missing evidence/audit links.`);
    }
    const biasHtml = await readFile(resolve("dist", "biases", lens.slug, "index.html"), "utf8");
    if (!biasHtml.includes(`/contexts/${context.slug}/`) || !biasHtml.includes('class="context-teaser"')) {
      throw new Error(`${context.slug}: reciprocal context link missing from ${lens.slug}.`);
    }
  }
}

for (const path of ["index.html", "explore/index.html", "contexts/index.html", "evidence/index.html", "compare/index.html", "tools/decision-audit/index.html"]) {
  const html = await readFile(resolve("dist", path), "utf8");
  if (!html.includes('href="/contexts/"')) throw new Error(`${path}: primary navigation is missing Contexts.`);
}

console.log(`Context check passed: ${seenContexts.size} curated contexts, canonical evidence-reviewed lenses only, reciprocal links, Decision Audit routes, sitemap, schema, and navigation verified.`);
