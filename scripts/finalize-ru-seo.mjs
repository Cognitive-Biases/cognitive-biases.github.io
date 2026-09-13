import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

await import("./generate-ru-reviewed-expansion.mjs");
await import("./generate-ru-research.mjs");

const OUT = join("dist", "ru");
const PREVIEW = "max-snippet:-1, max-image-preview:large, max-video-preview:-1";

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
const shortenMeta = (value, max = 210) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const clipped = text.slice(0, max - 1).replace(/\s+\S*$/, "").replace(/[\s,;:–—-]+$/u, "");
  return `${clipped || text.slice(0, max - 1)}…`;
};

let shortened = 0;
let descriptionsShortened = 0;
let styled = 0;
let brandOptimized = 0;
let trustLinked = 0;
let previewAligned = 0;
for (const file of await walk(OUT)) {
  let html = await readFile(file, "utf8");
  let dirty = false;

  if (!html.includes("max-image-preview:large")) {
    const robotsTag = html.match(/<meta\b[^>]*name=["']robots["'][^>]*>/i)?.[0]
      || html.match(/<meta\b[^>]*content=["'][^"']*["'][^>]*name=["']robots["'][^>]*>/i)?.[0];
    if (robotsTag) {
      let nextTag;
      if (/\bcontent=["'][^"']*["']/i.test(robotsTag)) {
        nextTag = robotsTag.replace(/\bcontent=(["'])([^"']*)\1/i, (match, quote, content) => {
          const normalized = String(content).trim().replace(/,\s*$/, "");
          return `content=${quote}${normalized ? `${normalized}, ` : ""}${PREVIEW}${quote}`;
        });
      } else {
        nextTag = robotsTag.replace(/\s*\/?\>$/, (ending) => ` content="${PREVIEW}"${ending}`);
      }
      html = html.replace(robotsTag, nextTag);
    } else {
      if (!html.includes("</head>")) throw new Error(`${file}: cannot attach search preview policy without </head>.`);
      html = html.replace("</head>", `<meta name="robots" content="${PREVIEW}"></head>`);
    }
    previewAligned += 1;
    dirty = true;
  }

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

  const descriptionTag = html.match(/<meta\b[^>]*name=["']description["'][^>]*>/i)?.[0]
    || html.match(/<meta\b[^>]*content=["'][^"']*["'][^>]*name=["']description["'][^>]*>/i)?.[0];
  const description = descriptionTag?.match(/\bcontent=(["'])([^"']*)\1/i)?.[2] || "";
  if (description.length > 220) {
    const nextDescription = shortenMeta(description, 210);
    const nextTag = descriptionTag.replace(/\bcontent=(["'])([^"']*)\1/i, (match, quote) => `content=${quote}${nextDescription}${quote}`);
    html = html.replace(descriptionTag, nextTag);
    html = html.replace(/<meta\b([^>]*?)property=["']og:description["']([^>]*?)content=["'][^"']*["']([^>]*)>/i, `<meta$1property="og:description"$2content="${nextDescription}"$3>`);
    html = html.replace(/<meta\b([^>]*?)content=["'][^"']*["']([^>]*?)property=["']og:description["']([^>]*)>/i, `<meta$1content="${nextDescription}"$2property="og:description"$3>`);
    descriptionsShortened += 1;
    dirty = true;
  }

  if (dirty) await writeFile(file, html);
}

console.log(`Russian finalization aligned search-preview policy on ${previewAligned} page(s), attached interface styles to ${styled} page(s), upgraded ${brandOptimized} page(s) to the shared WebP brand source, restored editorial-trust discovery on ${trustLinked} page(s), shortened ${shortened} overlong title(s), and shortened ${descriptionsShortened} overlong search description(s).`);
