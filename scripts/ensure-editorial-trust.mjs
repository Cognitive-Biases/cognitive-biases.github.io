import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const trust = JSON.parse(await readFile("data/project-trust.json", "utf8"));
const esc = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const trustLink = `<span class="editorial-trust-credit">Maintained by <a href="/about/editorial/">${esc(trust.maintainer.name)}</a></span>`;

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

let changed = 0;
let footerPages = 0;
for (const path of await walk(OUT)) {
  let html = await readFile(path, "utf8");
  if (!html.includes("</footer>")) continue;
  footerPages += 1;
  const before = html;

  html = html.replace(/<span>Made by MetalHatsCats<\/span>/g, trustLink);
  html = html.replace(/Made by\s*<a[^>]*>MetalHatsCats<\/a>/g, `Maintained by <a href="/about/editorial/">${esc(trust.maintainer.name)}</a>`);
  if (!html.includes('href="/about/editorial/"')) {
    html = html.replace("</footer>", `${trustLink}</footer>`);
  }

  if (html !== before) {
    await writeFile(path, html);
    changed += 1;
  }
}

if (!footerPages) throw new Error("No footer pages found while restoring editorial trust.");
console.log(`Editorial trust preserved after final theme on ${footerPages} footer pages; ${changed} page(s) updated.`);
