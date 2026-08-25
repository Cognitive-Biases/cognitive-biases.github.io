import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const OUT = "dist";
const PROFILE_SOURCE = "ai/site-profile.json";
const PROFILE_TARGET = join(OUT, "ai", "site-profile.json");
const DISCOVERY = '<link rel="describedby" type="application/json" href="/ai/site-profile.json" title="Agent-Ready Web Profile">';

async function walkHtml(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walkHtml(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

await mkdir(dirname(PROFILE_TARGET), { recursive: true });
await cp(PROFILE_SOURCE, PROFILE_TARGET);

let changed = 0;
for (const file of await walkHtml(OUT)) {
  const html = await readFile(file, "utf8");
  if (html.includes('/ai/site-profile.json') || !html.includes('</head>')) continue;
  const next = html.replace('</head>', `${DISCOVERY}</head>`);
  await writeFile(file, next);
  changed += 1;
}

console.log(`Published ARWP profile and advertised it from ${changed} HTML files.`);
