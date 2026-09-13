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

let shortened = 0;
let styled = 0;
let brandOptimized = 0;
let trustLinked = 0;
for (const file of await walk(OUT)) {
  let html = await readFile(file, "utf8");
  let dirty = false;

  if (!html.includes('href="/ru.css"')) {
    if (!html.includes("</head>")) throw new Error(`${file}: cannot attach Russian interface styles without </head>.`);
    html = html.replace("</head>", '<link rel="stylesheet" href="/ru.css"></head>');
    styled += 1;
    dirty = true;
  }

  if (html.includes('class="brand"') && !html.includes('/assets/brand.webp')) {
    const before = html;
    html = html
      .replaceAll('<img src="/assets/biases_icon.png" width="48" height="48" alt="">', '<picture><source srcset="/assets/brand.webp" type="image/webp"><img src="/assets/biases_icon.png" width="48" height="48" alt=""></picture>')
      .replaceAll('<img src="/assets/biases_icon.png" width="40" height="40" alt="">', '<picture><source srcset="/assets/brand.webp" type="image/webp"><img src="/assets/biases_icon.png" width="40" height="40" alt=""></picture>');
    if (html === before) throw new Error(`${file}: Russian brand markup could not be upgraded to the shared WebP source.`);
    brandOptimized += 1;
    dirty = true;
  }

  if (html.includes("</footer>") && !html.includes('href="/about/editorial/"')) {
    const footerLinks = /<div class="footer-links">([\s\S]*?)<\/div>/i;
    if (!footerLinks.test(html)) throw new Error(`${file}: Russian footer is missing the footer-links container.`);
    html = html.replace(footerLinks, (match, links) => `<div class="footer-links">${links}<a href="/about/editorial/">Как мы проверяем материалы <span lang="en">— English</span></a></div>`);
    trustLinked += 1;
    dirty = true;
  }

  const currentTitle = stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  if (currentTitle.length > 90) {
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
    shortened += 1;
    dirty = true;
  }

  if (dirty) await writeFile(file, html);
}

console.log(`Russian finalization attached interface styles to ${styled} page(s), upgraded ${brandOptimized} page(s) to the shared WebP brand source, restored editorial-trust discovery on ${trustLinked} page(s), and shortened ${shortened} overlong title(s).`);
