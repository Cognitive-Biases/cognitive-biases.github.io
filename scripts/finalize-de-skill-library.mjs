import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const roots = [join(OUT,"de","skills"), join(OUT,"de","agent-skills")];

async function walkHtml(dir) {
  const result = [];
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    const full = join(dir,entry.name);
    if (entry.isDirectory()) result.push(...await walkHtml(full));
    else if (entry.isFile() && entry.name.endsWith(".html")) result.push(full);
  }
  return result;
}

function shorten(value,max=175) {
  if (value.length <= max) return value;
  const cut = value.slice(0,max-1).replace(/\s+\S*$/,"").trim();
  return `${cut}…`;
}

let pages = 0;
let trustAdded = 0;
let descriptionsShortened = 0;
for (const root of roots) {
  for (const file of await walkHtml(root)) {
    let html = await readFile(file,"utf8");
    let changed = false;
    if (!html.includes('href="/about/editorial/"')) {
      const methodology = '<a href="/methodology/" lang="en">Methodik — English</a>';
      if (!html.includes(methodology)) throw new Error(`${file}: German skill footer has no methodology anchor for editorial trust insertion.`);
      html = html.replace(methodology,`<a href="/about/editorial/" lang="en">Redaktion & Evidenz — English</a>${methodology}`);
      trustAdded += 1;
      changed = true;
    }
    html = html.replace(/<meta name="description" content="([^"]*)">/, (match,value) => {
      const next = shorten(value);
      if (next === value) return match;
      descriptionsShortened += 1;
      changed = true;
      return `<meta name="description" content="${next}">`;
    });
    if (changed) await writeFile(file,html);
    pages += 1;
  }
}
console.log(`German skill finalization: ${pages} page(s), ${trustAdded} editorial-trust link(s) added, ${descriptionsShortened} search description(s) shortened.`);
