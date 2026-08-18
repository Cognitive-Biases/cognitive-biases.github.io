import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
const comparisons = JSON.parse(await readFile("data/comparisons.json", "utf8"));
const duplicates = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const reviewedSlugs = new Set(evidenceDocs.flatMap((document) => document.reviews || []).map((review) => review.slug));
const sitemap = await readFile("dist/sitemap.xml", "utf8");
const hub = await readFile(resolve("dist", "compare", "index.html"), "utf8");
const seen = new Set();

if (!hub.includes(`<link rel="canonical" href="${SITE}/compare/">`)) throw new Error("Compare hub is missing its canonical URL.");
if (!hub.includes('"@type":"CollectionPage"') || !hub.includes('"@type":"ItemList"')) throw new Error("Compare hub is missing collection structured data.");
if (!sitemap.includes(`<loc>${SITE}/compare/</loc>`)) throw new Error("Compare hub is missing from sitemap.");

for (const entry of comparisons.entries || []) {
  if (seen.has(entry.slug)) throw new Error(`${entry.slug}: duplicate comparison slug.`);
  seen.add(entry.slug);
  const left = bySlug.get(entry.leftSlug);
  const right = bySlug.get(entry.rightSlug);
  for (const bias of [left, right]) {
    if (!bias) throw new Error(`${entry.slug}: comparison target is missing.`);
    if (duplicateIds.has(bias.id)) throw new Error(`${entry.slug}: comparison target ${bias.slug} is a duplicate alias.`);
    if (!reviewedSlugs.has(bias.slug)) throw new Error(`${entry.slug}: comparison target ${bias.slug} is not evidence-reviewed.`);
  }
  if (entry.leftSlug === entry.rightSlug) throw new Error(`${entry.slug}: cannot compare a record with itself.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.reviewedAt || "")) throw new Error(`${entry.slug}: invalid review date.`);
  if (!Array.isArray(entry.dimensions) || entry.dimensions.length < 3) throw new Error(`${entry.slug}: comparison table is too thin.`);
  if (!Array.isArray(entry.diagnostic) || entry.diagnostic.length < 3) throw new Error(`${entry.slug}: diagnostic is too thin.`);
  if (!Array.isArray(entry.examples) || entry.examples.length < 2) throw new Error(`${entry.slug}: examples are too thin.`);
  if (!Array.isArray(entry.reviewProtocol) || entry.reviewProtocol.length < 4) throw new Error(`${entry.slug}: review protocol is too thin.`);
  if (!Array.isArray(entry.sources) || entry.sources.length < 2) throw new Error(`${entry.slug}: comparison needs at least two sources.`);

  const url = `${SITE}/compare/${entry.slug}/`;
  const html = await readFile(resolve("dist", "compare", entry.slug, "index.html"), "utf8");
  if (!html.includes(`<link rel="canonical" href="${url}">`)) throw new Error(`${entry.slug}: detail canonical is missing.`);
  if (!html.includes('"@type":"Article"') || !html.includes('"@type":"BreadcrumbList"')) throw new Error(`${entry.slug}: detail structured data is incomplete.`);
  if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`${entry.slug}: detail URL is missing from sitemap.`);
  if (!hub.includes(`href="/compare/${entry.slug}/"`)) throw new Error(`${entry.slug}: comparison is missing from hub.`);
  if (!html.includes(`/biases/${entry.leftSlug}/#evidence`) || !html.includes(`/biases/${entry.rightSlug}/#evidence`)) throw new Error(`${entry.slug}: detail does not link both evidence-reviewed entries.`);
  for (const source of entry.sources) {
    if (!/^https:\/\//.test(source.url || "")) throw new Error(`${entry.slug}: source must use HTTPS.`);
    if (!html.includes(source.url)) throw new Error(`${entry.slug}: rendered page is missing source ${source.url}.`);
  }
  for (const bias of [left, right]) {
    const biasHtml = await readFile(resolve("dist", "biases", bias.slug, "index.html"), "utf8");
    if (!biasHtml.includes(`href="/compare/${entry.slug}/"`) || !biasHtml.includes('class="comparison-teaser"')) {
      throw new Error(`${entry.slug}: ${bias.slug} is missing the comparison teaser/backlink.`);
    }
  }
}

for (const path of ["index.html", "explore/index.html", "evidence/index.html", "compare/index.html"]) {
  const html = await readFile(resolve("dist", path), "utf8");
  if (!html.includes('href="/compare/"')) throw new Error(`${path}: primary navigation is missing Compare.`);
}

console.log(`Comparison check passed: ${seen.size} evidence-reviewed comparisons, reciprocal bias links, sitemap, structured data, and primary navigation verified.`);
