import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const queryPattern = /\/tools\/decision-audit\/\?bias=([a-z0-9-]+)/g;
let linksRewritten = 0;

for (const file of await walkHtml(OUT)) {
  const html = await readFile(file, "utf8");
  const next = html.replace(queryPattern, (_whole, slug) => {
    linksRewritten += 1;
    return `/tools/decision-audit/#bias=${slug}`;
  });
  if (next !== html) await writeFile(file, next);
}

const scriptPath = join(OUT, "assets", "decision-audit.js");
let script = await readFile(scriptPath, "utf8");
const oldPreselection = 'const requested = new URLSearchParams(location.search).get("bias");';
const newPreselection = 'const requested = new URLSearchParams(location.hash.replace(/^#/, "")).get("bias");';
if (!script.includes(oldPreselection) && !script.includes(newPreselection)) {
  throw new Error("Decision Audit preselection parser was not found; refusing an unverified routing rewrite.");
}
if (script.includes(oldPreselection)) {
  script = script.replace(oldPreselection, newPreselection);
  await writeFile(scriptPath, script);
}

console.log(`Decision Audit routing finalized: ${linksRewritten} query-bearing CTA link(s) moved to fragment state; bias preselection uses location.hash.`);

async function walkHtml(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walkHtml(path));
    else if (entry.isFile() && entry.name === "index.html") files.push(path);
  }
  return files;
}
