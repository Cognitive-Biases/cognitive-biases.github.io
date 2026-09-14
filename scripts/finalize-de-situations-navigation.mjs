import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join("dist", "de");
const SITUATION_LINK = '<a href="/de/entscheidungen/">Situationen</a>';
const TECHNIQUES_LINK = /(<a\b[^>]*href=["']\/de\/techniques\/["'][^>]*>[\s\S]*?<\/a>)/i;
const SITUATIONS_HREF = /href=["']\/de\/entscheidungen\/["']/i;

let filesChecked = 0;
let filesChanged = 0;
let headerUpdates = 0;
let footerUpdates = 0;

for (const file of await walkHtml(ROOT)) {
  filesChecked += 1;
  let html = await readFile(file, "utf8");
  let changed = false;

  html = html.replace(/<header\b[\s\S]*?<\/header>/i, (header) => {
    const next = ensureSituationLink(header);
    if (next !== header) {
      headerUpdates += 1;
      changed = true;
    }
    return next;
  });

  html = html.replace(/<footer\b[\s\S]*?<\/footer>/i, (footer) => {
    const next = ensureSituationLink(footer);
    if (next !== footer) {
      footerUpdates += 1;
      changed = true;
    }
    return next;
  });

  if (changed) {
    await writeFile(file, html);
    filesChanged += 1;
  }
}

console.log(`German Situationen navigation finalized: ${filesChecked} page(s) checked, ${filesChanged} page(s) changed, ${headerUpdates} header link(s) and ${footerUpdates} footer link(s) added.`);

function ensureSituationLink(fragment) {
  if (!TECHNIQUES_LINK.test(fragment) || SITUATIONS_HREF.test(fragment)) return fragment;
  return fragment.replace(TECHNIQUES_LINK, `$1${SITUATION_LINK}`);
}

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
