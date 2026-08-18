import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
const deepDives = JSON.parse(await readFile("data/deep-dives.json", "utf8"));
const duplicateDispositions = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicateDispositions.groups || []).flatMap((group) => group.duplicateIds || []));
const seen = new Set();

for (const entry of deepDives.entries || []) {
  if (seen.has(entry.slug)) throw new Error(`${entry.slug}: duplicate deep-dive entry.`);
  seen.add(entry.slug);
  const bias = bySlug.get(entry.slug);
  if (!bias) throw new Error(`${entry.slug}: deep dive has no published bias.`);
  if (duplicateIds.has(bias.id)) throw new Error(`${entry.slug}: deep dive targets a duplicate alias.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.reviewedAt || "")) throw new Error(`${entry.slug}: invalid reviewedAt date.`);
  if (!Array.isArray(entry.diagnostic) || entry.diagnostic.length < 3) throw new Error(`${entry.slug}: diagnostic is too thin.`);
  if (!Array.isArray(entry.distinctions) || entry.distinctions.length < 3) throw new Error(`${entry.slug}: distinctions are too thin.`);
  if (!Array.isArray(entry.playbook) || entry.playbook.length < 3) throw new Error(`${entry.slug}: playbook is too thin.`);
  if (!Array.isArray(entry.systemChecklist) || entry.systemChecklist.length < 4) throw new Error(`${entry.slug}: system checklist is too thin.`);
  if (!Array.isArray(entry.sources) || entry.sources.length < 3) throw new Error(`${entry.slug}: deep dive requires at least three sources.`);

  const html = await readFile(resolve("dist", "biases", entry.slug, "index.html"), "utf8");
  const pageUrl = `${SITE}/biases/${entry.slug}/`;
  if (!html.includes('class="deep-dive"') || !html.includes('id="deep-dive"')) throw new Error(`${entry.slug}: rendered deep dive is missing.`);
  if (!html.includes('class="evidence-review"')) throw new Error(`${entry.slug}: deep dive page lost its evidence review.`);
  if (!html.includes(`${pageUrl}#deep-dive-resource`) || !html.includes('"@type":"LearningResource"')) {
    throw new Error(`${entry.slug}: LearningResource structured data is missing.`);
  }
  for (const source of entry.sources) {
    if (!/^https:\/\//.test(source.url || "")) throw new Error(`${entry.slug}: deep-dive source must use HTTPS.`);
    if (!html.includes(source.url)) throw new Error(`${entry.slug}: rendered deep dive is missing source ${source.url}.`);
  }
  for (const term of entry.distinctions.map((item) => item.term)) {
    if (!html.includes(term.replaceAll("&", "&amp;"))) throw new Error(`${entry.slug}: distinction ${term} is missing from rendered page.`);
  }
}

console.log(`Deep-dive check passed: ${seen.size} canonical decision-diagnostic pages with evidence prerequisites and source-grounded LearningResource metadata.`);
