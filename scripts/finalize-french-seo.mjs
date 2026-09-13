import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join("dist", "fr");
const ROBOTS_META = '<meta name="robots" content="max-image-preview:large,max-snippet:-1,max-video-preview:-1">';
const evidenceClasses = JSON.parse(await readFile("data/evidence-classes.json", "utf8")).classes || {};

const decode = (value = "") => String(value)
  .replaceAll("&amp;", "&")
  .replaceAll("&quot;", '"')
  .replaceAll("&#39;", "'")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">");
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);

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
let previewUpdated = 0;
let titlesShortened = 0;
let trustLinksAdded = 0;
for (const file of files) {
  let html = await readFile(file, "utf8");
  let changed = false;

  if (!html.includes("max-image-preview:large")) {
    html = html.replace("</head>", `${ROBOTS_META}</head>`);
    previewUpdated += 1;
    changed = true;
  }

  if (file.includes(`${join("fr", "biais")}`)) {
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    const currentTitle = decode(titleMatch?.[1] || "").replace(/\s+/g, " ").trim();
    if (currentTitle.length > 90) {
      const shortTitle = currentTitle.replace(/\s*:\s*définition, exemple et limites\s*\|\s*Cognitive Biases\s*$/i, " | Cognitive Biases");
      if (shortTitle.length < currentTitle.length) {
        const escaped = escapeHtml(shortTitle);
        html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escaped}</title>`);
        html = html.replace(/<meta\b([^>]*\bproperty=["']og:title["'][^>]*)>/i, (tag) => tag.replace(/\bcontent=["'][^"']*["']/i, `content="${escaped}"`));
        titlesShortened += 1;
        changed = true;
      }
    }
  }

  if (html.includes("</footer>") && !html.includes('href="/about/editorial/"')) {
    html = html.replace("</footer>", '<p class="fine-print"><a href="/about/editorial/">Processus éditorial et qualité</a></p></footer>');
    trustLinksAdded += 1;
    changed = true;
  }

  if (changed) await writeFile(file, html);
}

const methodologyPath = join("dist", "methodology", "index.html");
let methodology = await readFile(methodologyPath, "utf8");
const missingClasses = Object.entries(evidenceClasses).filter(([id]) => !new RegExp(`(?:id|name)=["']${id}["']`, "i").test(methodology));
if (missingClasses.length) {
  const cards = missingClasses.map(([id, entry]) => `<article class="evidence-class-card" id="${escapeHtml(id)}"><h3>${escapeHtml(entry.label)}</h3><p>${escapeHtml(entry.description)}</p></article>`).join("");
  const section = `<section class="section methodology-evidence-classes" aria-labelledby="controlled-evidence-classes"><p class="eyebrow">Evidence vocabulary</p><h2 id="controlled-evidence-classes">Controlled evidence classes</h2><p>These labels describe the strength and scope of the reviewed claim. They do not rank people, diagnose individuals, or turn a context-dependent result into a universal law.</p><div class="card-grid">${cards}</div></section>`;
  methodology = methodology.replace("</main>", `${section}</main>`);
  await writeFile(methodologyPath, methodology);
}

console.log(`French SEO finalizer: ${previewUpdated}/${files.length} page(s) updated with large-preview directives; ${titlesShortened} long French title(s) shortened; ${trustLinksAdded} editorial-trust footer link(s) added; ${missingClasses.length} methodology evidence-class anchor(s) restored.`);
