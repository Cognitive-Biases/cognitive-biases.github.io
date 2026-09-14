import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const OUT = "dist";
const MAX_TITLE = 90;
const MAX_DESCRIPTION = 155;
let titlesChanged = 0;
let descriptionsChanged = 0;

for (const file of await walkHtml(OUT)) {
  let html = await readFile(file, "utf8");
  let dirty = false;
  const route = publicPath(file);

  const title = textOf(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (title.length > MAX_TITLE && /^\/(?:de|pt-br)\//.test(route)) {
    const nextTitle = shortenTitle(title, MAX_TITLE);
    if (nextTitle && nextTitle !== title) {
      html = html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${escapeHtml(nextTitle)}</title>`);
      html = replaceMetaContent(html, "property", "og:title", nextTitle);
      titlesChanged += 1;
      dirty = true;
    }
  }

  if (/^\/agent-skills\/[^/]+\/$/.test(route)) {
    const description = metaContent(html, "name", "description");
    if (description.length > 180) {
      const nextDescription = shortenSentence(description, MAX_DESCRIPTION);
      if (nextDescription && nextDescription !== description) {
        html = replaceMetaContent(html, "name", "description", nextDescription);
        html = replaceMetaContent(html, "property", "og:description", nextDescription);
        descriptionsChanged += 1;
        dirty = true;
      }
    }
  }

  if (dirty) await writeFile(file, html);
}

console.log(`Search warning debt finalized: ${titlesChanged} long localized title(s), ${descriptionsChanged} long Agent Skill description(s) repaired.`);

async function walkHtml(dir) {
  const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walkHtml(path));
    else if (entry.isFile() && entry.name === "index.html") files.push(path);
  }
  return files;
}

function publicPath(file) {
  const rel = relative(OUT, file).replaceAll("\\", "/");
  if (rel === "index.html") return "/";
  return `/${rel.replace(/index\.html$/, "")}`;
}

function shortenTitle(value, max) {
  const clean = decodeHtml(value).replace(/\s+/g, " ").trim();
  const withoutBrand = clean.replace(/\s*\|\s*Cognitive Biases\s*$/i, "").trim();
  if (withoutBrand.length <= max) return withoutBrand;
  const clipped = withoutBrand.slice(0, max - 1).replace(/\s+\S*$/, "").replace(/[\s,;:–—-]+$/u, "").trim();
  return clipped || withoutBrand.slice(0, max).trim();
}

function shortenSentence(value, max) {
  const clean = decodeHtml(value).replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const preferred = clean.slice(0, max - 1);
  const sentenceEnd = Math.max(preferred.lastIndexOf(". "), preferred.lastIndexOf("? "), preferred.lastIndexOf("! "));
  if (sentenceEnd >= 80) return preferred.slice(0, sentenceEnd + 1).trim();
  const clipped = preferred.replace(/\s+\S*$/, "").replace(/[\s,;:–—-]+$/u, "").trim();
  return `${clipped || preferred.trim()}…`;
}

function textOf(html, pattern) {
  const match = html.match(pattern);
  return match ? decodeHtml(match[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() : "";
}

function metaContent(html, key, value) {
  const tag = findMetaTag(html, key, value);
  return tag ? decodeHtml(getAttribute(tag, "content")) : "";
}

function findMetaTag(html, key, value) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  return tags.find((tag) => getAttribute(tag, key)?.toLowerCase() === value.toLowerCase()) || null;
}

function getAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2] || "";
}

function replaceMetaContent(html, key, value, content) {
  const tag = findMetaTag(html, key, value);
  if (!tag) return html;
  const next = /\bcontent\s*=\s*(["'])(.*?)\1/i.test(tag)
    ? tag.replace(/\bcontent\s*=\s*(["'])(.*?)\1/i, `content="${escapeAttribute(content)}"`)
    : tag.replace(/\s*\/?\>$/, ` content="${escapeAttribute(content)}">`);
  return html.replace(tag, next);
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtml(value) {
  return escapeAttribute(value).replace(/'/g, "&#39;");
}
