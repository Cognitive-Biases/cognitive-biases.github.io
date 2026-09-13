import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join("dist", "es");
const ROBOTS_META = '<meta name="robots" content="max-image-preview:large,max-snippet:-1,max-video-preview:-1">';

const decode = (value = "") => String(value)
  .replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
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
  if (file.includes(`${join("es", "sesgos")}`)) {
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    const currentTitle = decode(titleMatch?.[1] || "").replace(/\s+/g, " ").trim();
    if (currentTitle.length > 90) {
      const shortTitle = currentTitle.replace(/\s*:\s*definición, ejemplo y límites\s*\|\s*Cognitive Biases\s*$/i, " | Cognitive Biases");
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
    html = html.replace("</footer>", '<p class="fine-print"><a href="/about/editorial/">Proceso editorial y calidad</a></p></footer>');
    trustLinksAdded += 1;
    changed = true;
  }
  if (changed) await writeFile(file, html);
}

console.log(`Spanish SEO finalizer: ${previewUpdated}/${files.length} page(s) updated with large-preview directives; ${titlesShortened} long Spanish title(s) shortened; ${trustLinksAdded} editorial-trust footer link(s) added.`);
