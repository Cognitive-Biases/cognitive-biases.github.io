import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join("dist", "fr");
const ROBOTS_META = '<meta name="robots" content="max-image-preview:large,max-snippet:-1,max-video-preview:-1">';

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

const files = await walk(ROOT);
let updated = 0;
for (const file of files) {
  let html = await readFile(file, "utf8");
  if (html.includes("max-image-preview:large")) continue;
  html = html.replace("</head>", `${ROBOTS_META}</head>`);
  await writeFile(file, html);
  updated += 1;
}

console.log(`French SEO finalizer: ${updated}/${files.length} page(s) updated with large-preview directives.`);
