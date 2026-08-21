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

let seoChanged = 0;
let brandChanged = 0;
for (const file of await walk(OUT)) {
  let html = await readFile(file, "utf8");
  const before = html;

  if (!html.includes("max-image-preview:large")) {
    const beforeSeo = html;
    html = html.replace(/<meta name="robots" content="([^"]*)">/i, (_match, content) => {
      const directives = content.split(",").map((item) => item.trim()).filter(Boolean);
      if (!directives.includes("max-image-preview:large")) directives.push("max-image-preview:large");
      return `<meta name="robots" content="${directives.join(",")}">`;
    });
    if (html === beforeSeo) html = html.replace("</head>", '<meta name="robots" content="max-image-preview:large"></head>');
    if (html !== beforeSeo) seoChanged += 1;
  }

  const beforeBrand = html;
  html = html
    .replaceAll('<img src="/assets/icon2.png" width="48"', '<img src="/assets/brand.webp" width="48"')
    .replaceAll('<img src="/assets/icon2.png" width="40"', '<img src="/assets/brand.webp" width="40"');
  if (html !== beforeBrand) brandChanged += 1;

  if (html !== before) await writeFile(file, html);
}
console.log(`Late finalizer: SEO metadata updated on ${seoChanged} page(s); optimized brand source repaired on ${brandChanged} page(s).`);
