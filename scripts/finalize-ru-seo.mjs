import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = join("dist", "ru");

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile() && entry.name === "index.html") files.push(path);
  }
  return files;
}

const stripTags = (value = "") => String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);

let changed = 0;
for (const file of await walk(OUT)) {
  let html = await readFile(file, "utf8");
  const currentTitle = stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  if (currentTitle.length <= 90) continue;
  const h1 = stripTags(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "");
  if (!h1) throw new Error(`${file}: cannot shorten title without a visible H1.`);
  let nextTitle = `${h1} | Cognitive Biases`;
  if (nextTitle.length > 90) {
    const max = 90 - "… | Cognitive Biases".length;
    nextTitle = `${h1.slice(0, max).replace(/[\s,:;–—-]+$/u, "")}… | Cognitive Biases`;
  }
  html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${escapeHtml(nextTitle)}</title>`);
  html = html.replace(/<meta\b([^>]*?)property=["']og:title["']([^>]*?)content=["'][^"']*["']([^>]*)>/i, `<meta$1property="og:title"$2content="${escapeHtml(nextTitle)}"$3>`);
  html = html.replace(/<meta\b([^>]*?)content=["'][^"']*["']([^>]*?)property=["']og:title["']([^>]*)>/i, `<meta$1content="${escapeHtml(nextTitle)}"$2property="og:title"$3>`);
  await writeFile(file, html);
  changed += 1;
}

console.log(`Russian SEO finalization shortened ${changed} overlong title(s).`);
