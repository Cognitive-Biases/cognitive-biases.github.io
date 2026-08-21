import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
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
for (const file of await walk(OUT)) {
  let html = await readFile(file, "utf8");
  if (html.includes("max-image-preview:large")) continue;
  const before = html;
  html = html.replace(/<meta name="robots" content="([^"]*)">/i, (_match, content) => {
    const directives = content.split(",").map((item) => item.trim()).filter(Boolean);
    if (!directives.includes("max-image-preview:large")) directives.push("max-image-preview:large");
    return `<meta name="robots" content="${directives.join(",")}">`;
  });
  if (html === before) html = html.replace("</head>", '<meta name="robots" content="max-image-preview:large"></head>');
  if (html !== before) {
    await writeFile(file, html);
    changed += 1;
  }
}
console.log(`Late SEO finalizer added large-preview control to ${changed} HTML page(s).`);
