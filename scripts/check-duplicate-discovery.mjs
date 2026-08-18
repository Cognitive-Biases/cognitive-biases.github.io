import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const byId = new Map(biases.map((bias) => [bias.id, bias]));
const dispositions = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const aliases = (dispositions.groups || []).flatMap((group) => (group.duplicateIds || []).map((id) => ({
  duplicate: byId.get(id),
  primary: byId.get(group.primaryId),
}))).filter(({ duplicate, primary }) => duplicate && primary);
const canonicalCount = biases.length - aliases.length;
const explore = await readFile("dist/explore/index.html", "utf8");

for (const { duplicate } of aliases) {
  if (explore.includes(`/biases/${duplicate.slug}/`)) throw new Error(`Explore still exposes duplicate alias ${duplicate.slug}.`);
}
if (!explore.includes(`${canonicalCount}`)) throw new Error("Explore does not expose the canonical catalogue count after duplicate cleanup.");

const familyDirs = await readdir("dist/families", { withFileTypes: true });
for (const dir of familyDirs.filter((entry) => entry.isDirectory())) {
  const html = await readFile(join("dist", "families", dir.name, "index.html"), "utf8");
  for (const { duplicate } of aliases) {
    if (html.includes(`/biases/${duplicate.slug}/`)) throw new Error(`${dir.name}: family discovery still exposes duplicate alias ${duplicate.slug}.`);
  }
}

for (const { duplicate, primary } of aliases) {
  const aliasPage = await readFile(join("dist", "biases", duplicate.slug, "index.html"), "utf8");
  if (!aliasPage.includes(`/biases/${primary.slug}/`) || !aliasPage.includes('class="consolidation-note"')) {
    throw new Error(`${duplicate.slug}: alias page was removed or lost its canonical consolidation notice.`);
  }
}

console.log(`Duplicate discovery check passed: ${aliases.length} alias pages remain directly accessible but are absent from Explore and family hubs; ${canonicalCount} canonical entries remain discoverable.`);
