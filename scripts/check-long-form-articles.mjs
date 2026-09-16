import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const MIN_WORDS = 650;
const MIN_PARAGRAPH_WORDS = 35;
const MIN_SECTION_WORDS = 90;
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const articlesDoc = JSON.parse(await readFile("data/long-form-articles.json", "utf8"));
const everydayDoc = JSON.parse(await readFile("data/everyday-guides.json", "utf8"));
const duplicateDispositions = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicateDispositions.groups || []).flatMap((group) => group.duplicateIds || []));
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
const guideSlugsByBias = new Map();
for (const guide of everydayDoc.entries || []) {
  if (!guideSlugsByBias.has(guide.biasSlug)) guideSlugsByBias.set(guide.biasSlug, []);
  guideSlugsByBias.get(guide.biasSlug).push(guide.slug);
}

const evidenceFiles = (await readdir("data"))
  .filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name))
  .sort();
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const reviewBySlug = new Map();
for (const review of evidenceDocs.flatMap((doc) => doc.reviews || [])) {
  if (reviewBySlug.has(review.slug)) throw new Error(`${review.slug}: evidence review is defined more than once.`);
  reviewBySlug.set(review.slug, review);
}

const wordsIn = (value = "") => (String(value).match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || []).length;
const seen = new Set();

for (const entry of articlesDoc.entries || []) {
  if (seen.has(entry.slug)) throw new Error(`${entry.slug}: duplicate long-form article entry.`);
  seen.add(entry.slug);

  const bias = bySlug.get(entry.slug);
  if (!bias) throw new Error(`${entry.slug}: long-form article has no published bias.`);
  if (duplicateIds.has(bias.id)) throw new Error(`${entry.slug}: long-form article targets a duplicate alias.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.reviewedAt || "")) throw new Error(`${entry.slug}: invalid reviewedAt date.`);
  if (entry.legacySourceUrl !== `https://metalhatscats.com/cognitive-biases/${entry.slug}`) {
    throw new Error(`${entry.slug}: legacySourceUrl must point to the matching Metalhatscats article.`);
  }
  if (typeof entry.headline !== "string" || wordsIn(entry.headline) < 5) throw new Error(`${entry.slug}: headline is too thin.`);
  if (typeof entry.lede !== "string" || wordsIn(entry.lede) < 25) throw new Error(`${entry.slug}: lede is too thin.`);
  if (!Array.isArray(entry.sections) || entry.sections.length < 4) throw new Error(`${entry.slug}: needs at least four long-form sections.`);
  for (const [index, section] of entry.sections.entries()) {
    if (!section.heading || wordsIn(section.heading) < 3) throw new Error(`${entry.slug}: section ${index + 1} needs a useful heading.`);
    if (!Array.isArray(section.paragraphs) || section.paragraphs.length < 2) throw new Error(`${entry.slug}: section ${index + 1} needs at least two paragraphs.`);
    for (const [paragraphIndex, paragraph] of section.paragraphs.entries()) {
      if (wordsIn(paragraph) < MIN_PARAGRAPH_WORDS) {
        throw new Error(`${entry.slug}: section ${index + 1}, paragraph ${paragraphIndex + 1} is below the ${MIN_PARAGRAPH_WORDS}-word paragraph floor.`);
      }
    }
    const sectionWordCount = wordsIn(section.paragraphs.join(" "));
    if (sectionWordCount < MIN_SECTION_WORDS) {
      throw new Error(`${entry.slug}: section ${index + 1} has ${sectionWordCount} words, below the ${MIN_SECTION_WORDS}-word section floor.`);
    }
  }
  if (!Array.isArray(entry.checklist) || entry.checklist.length < 5) throw new Error(`${entry.slug}: decision checklist is too thin.`);
  if (!entry.boundaryNote || wordsIn(entry.boundaryNote) < 20) throw new Error(`${entry.slug}: evidence boundary is missing or too thin.`);

  const wordCount = wordsIn([entry.lede, ...entry.sections.flatMap((section) => section.paragraphs), ...entry.checklist, entry.boundaryNote].join(" "));
  if (wordCount < MIN_WORDS) throw new Error(`${entry.slug}: ${wordCount} words is below the ${MIN_WORDS}-word long-form floor.`);

  const review = reviewBySlug.get(entry.slug);
  if (!review) throw new Error(`${entry.slug}: long-form article requires an evidence review.`);
  if (!Array.isArray(review.sources) || review.sources.length < 2) throw new Error(`${entry.slug}: evidence review is missing the minimum source set.`);

  const html = await readFile(resolve("dist", "biases", entry.slug, "index.html"), "utf8");
  const pageUrl = `${SITE}/biases/${entry.slug}/`;
  const articleIndex = html.indexOf('class="long-form-article"');
  const evidenceIndex = html.indexOf('class="evidence-review"');
  if (articleIndex < 0 || !html.includes('id="long-form"')) throw new Error(`${entry.slug}: rendered long-form article is missing.`);
  if (evidenceIndex < 0) throw new Error(`${entry.slug}: rendered evidence review is missing.`);
  if (articleIndex > evidenceIndex) throw new Error(`${entry.slug}: long-form article must appear before the evidence review.`);
  if (!html.includes(`${pageUrl}#long-form-article`) || !html.includes('"@type":"Article"')) {
    throw new Error(`${entry.slug}: long-form Article structured data is missing.`);
  }
  if (!html.includes(entry.headline.replaceAll("&", "&amp;"))) throw new Error(`${entry.slug}: rendered headline is missing.`);
  if (!html.includes("Evidence boundary") || !html.includes(entry.boundaryNote.replaceAll("&", "&amp;"))) {
    throw new Error(`${entry.slug}: rendered evidence boundary is missing.`);
  }
  if (!html.includes("current evidence-first model")) throw new Error(`${entry.slug}: migration provenance note is missing.`);
  for (const source of review.sources) {
    if (!html.includes(source.url)) throw new Error(`${entry.slug}: current evidence source is missing from rendered page: ${source.url}`);
  }
  for (const guideSlug of guideSlugsByBias.get(entry.slug) || []) {
    if (!html.includes(`/everyday/${guideSlug}/`)) throw new Error(`${entry.slug}: linked everyday guide ${guideSlug} is missing.`);
  }
}

if (!seen.size) throw new Error("No long-form article entries were found.");
console.log(`Long-form article check passed: ${seen.size} canonical pages, each >= ${MIN_WORDS} words with section-level depth, evidence gating and rendered Article schema.`);
