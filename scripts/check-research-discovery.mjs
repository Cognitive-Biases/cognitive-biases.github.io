import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const notes = await json("data/research-notes.json");
const biases = await json("data/biases.json");
const duplicates = await json("data/duplicate-dispositions.json");
const evidence = await json("dist/data/evidence.json");
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const canonical = new Map(biases.filter((entry) => entry.published && !duplicateIds.has(entry.id)).map((entry) => [entry.slug, entry]));
const reviewed = new Set((evidence.reviews || []).map((entry) => entry.slug));
let relationships = 0;
const linkedConcepts = new Set();

for (const note of notes.entries || []) {
  const researchHtml = await readFile(resolve("dist", "research", note.slug, "index.html"), "utf8");
  const researchMatch = researchHtml.match(/<script type="application\/ld\+json" data-seo-schema="research-article">([\s\S]*?)<\/script>/);
  if (!researchMatch) throw new Error(`${note.slug}: research Article schema is missing.`);
  const researchSchema = JSON.parse(researchMatch[1]);
  const article = researchSchema?.["@graph"]?.find((node) => node?.["@id"] === `${SITE}/research/${note.slug}/#article`);
  if (!article) throw new Error(`${note.slug}: canonical Article entity is missing.`);
  const aboutIds = new Set((article.about || []).map((item) => item?.["@id"]));

  for (const slug of note.related || []) {
    if (!canonical.has(slug)) throw new Error(`${note.slug}: related concept ${slug} is not canonical.`);
    if (!reviewed.has(slug)) throw new Error(`${note.slug}: related concept ${slug} is not evidence-reviewed.`);
    const termId = `${SITE}/biases/${slug}/#term`;
    if (!aboutIds.has(termId)) throw new Error(`${note.slug}: Article schema is missing about ${termId}.`);

    const biasHtml = await readFile(resolve("dist", "biases", slug, "index.html"), "utf8");
    if (!biasHtml.includes('class="research-teaser"')) throw new Error(`${slug}: visible Research notes teaser is missing.`);
    if (!biasHtml.includes(`href="/research/${note.slug}/"`)) throw new Error(`${slug}: visible backlink to ${note.slug} is missing.`);
    const termMatch = biasHtml.match(/<script type="application\/ld\+json" data-seo-schema="defined-term">([\s\S]*?)<\/script>/);
    if (!termMatch) throw new Error(`${slug}: marked DefinedTerm schema is missing.`);
    const termSchema = JSON.parse(termMatch[1]);
    const term = termSchema?.["@graph"]?.find((node) => node?.["@id"] === termId);
    const subjectIds = new Set((term?.subjectOf || []).map((item) => item?.["@id"]));
    if (!subjectIds.has(`${SITE}/research/${note.slug}/#article`)) throw new Error(`${slug}: DefinedTerm subjectOf does not link ${note.slug}.`);
    relationships += 1;
    linkedConcepts.add(slug);
  }
}

if (!relationships) throw new Error("Research discovery has no note-to-concept relationships.");
console.log(`Research discovery check passed: ${relationships} reciprocal Article↔DefinedTerm relationships across ${linkedConcepts.size} evidence-reviewed concepts.`);
