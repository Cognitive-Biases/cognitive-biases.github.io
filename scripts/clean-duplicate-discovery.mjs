import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const OUT = "dist";
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const byId = new Map(biases.map((bias) => [bias.id, bias]));
const dispositions = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const aliases = (dispositions.groups || []).flatMap((group) => {
  const primary = byId.get(group.primaryId);
  if (!primary) throw new Error(`${group.concept}: missing canonical record ${group.primaryId}.`);
  return (group.duplicateIds || []).map((id) => {
    const duplicate = byId.get(id);
    if (!duplicate) throw new Error(`${group.concept}: missing duplicate record ${id}.`);
    return { primary, duplicate };
  });
});
const canonicalCount = biases.length - aliases.length;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

let removedCards = 0;
for (const file of await htmlFiles(OUT)) {
  const relative = file.slice(resolve(OUT).length + 1).replaceAll("\\", "/");
  if (aliases.some(({ duplicate }) => relative === `biases/${duplicate.slug}/index.html`)) continue;

  let html = await readFile(file, "utf8");
  const before = html;
  for (const { duplicate } of aliases) {
    const slug = escapeRegex(duplicate.slug);
    const wrapped = new RegExp(`<div data-bias data-category="[^"]*">\\s*<a class="bias-link" href="/biases/${slug}/">[\\s\\S]*?<\\/a>\\s*<\\/div>`, "g");
    const direct = new RegExp(`<a class="bias-link" href="/biases/${slug}/">[\\s\\S]*?<\\/a>`, "g");
    html = html.replace(wrapped, () => { removedCards += 1; return ""; });
    html = html.replace(direct, () => { removedCards += 1; return ""; });
  }

  html = html
    .replace(`Browse all ${biases.length} biases`, `Browse all ${canonicalCount} entries`)
    .replace(`Browse ${biases.length} cognitive biases with plain-language explanations and practical reflection prompts.`, `Browse ${canonicalCount} canonical cognitive-bias entries with plain-language explanations and practical reflection prompts.`);

  if (html !== before) await writeFile(file, html);
}

console.log(`Duplicate discovery cleanup removed ${removedCards} alias cards; ${canonicalCount} canonical entries remain discoverable.`);
