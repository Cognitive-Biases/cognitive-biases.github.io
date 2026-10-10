import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { descriptionBlocks, escapeHtml } from "./bias-description.mjs";
const records = JSON.parse(await readFile("data/biases.json", "utf8"));
const dispositions = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const aliases = new Set(dispositions.groups.flatMap(group => group.duplicateIds || []));
const canonical = records.filter(record => record.published && !aliases.has(record.id));
let sections = 0;
for (const record of canonical) {
  const html = await readFile(`dist/biases/${record.slug}/index.html`, "utf8");
  for (const block of descriptionBlocks(record.description)) {
    if (block.heading) {
      assert.ok(html.includes(`<h2>${escapeHtml(block.heading)}</h2>`), `${record.slug}: missing explanation heading`);
      sections++;
    }
    for (const line of block.text.split("\n").filter(Boolean)) {
      const content = line.replace(/^-\s+/, "");
      assert.ok(html.includes(escapeHtml(content)), `${record.slug}: lost source explanation`);
      if (/^-\s+/.test(line)) assert.ok(html.includes(`<li>${escapeHtml(content)}</li>`), `${record.slug}: example/check is not a list item`);
    }
  }
}
console.log(`English explanation check passed: ${canonical.length} canonical pages, ${sections} source-backed sections; examples, checks and qualifications preserved.`);
