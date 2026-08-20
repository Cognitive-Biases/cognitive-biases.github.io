import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

let changed = 0;
for (const file of await walk(OUT)) {
  let html = await readFile(file, "utf8");
  const before = html;
  html = html
    .replaceAll('<img src="/assets/icon2.png" width="48"', '<img src="/assets/brand.webp" width="48"')
    .replaceAll('<img src="/assets/icon2.png" width="40"', '<img src="/assets/brand.webp" width="40"');
  if (html !== before) {
    await writeFile(file, html);
    changed += 1;
  }
}

console.log(`Final brand asset pass updated ${changed} HTML page(s).`);
