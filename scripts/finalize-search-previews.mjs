import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const PREVIEW = ["max-image-preview:large", "max-snippet:-1", "max-video-preview:-1"];

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

let added = 0;
let extended = 0;
for (const file of await walk(OUT)) {
  let html = await readFile(file, "utf8");
  if (html.includes("max-image-preview:large") && html.includes("max-snippet:-1") && html.includes("max-video-preview:-1")) continue;

  const robots = /<meta\s+name=["']robots["']\s+content=["']([^"']*)["']\s*\/?\s*>/i;
  const match = html.match(robots);
  if (match) {
    const directives = match[1].split(",").map((x) => x.trim()).filter(Boolean);
    for (const directive of PREVIEW) if (!directives.some((x) => x.toLowerCase().startsWith(directive.split(":")[0]))) directives.push(directive);
    html = html.replace(robots, `<meta name="robots" content="${directives.join(",")}">`);
    extended += 1;
  } else {
    html = html.replace("</head>", `<meta name="robots" content="index,follow,${PREVIEW.join(",")}"></head>`);
    added += 1;
  }
  await writeFile(file, html);
}

console.log(`Final search-preview controls: ${added} added, ${extended} extended.`);
