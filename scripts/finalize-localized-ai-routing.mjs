import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const manifest = JSON.parse(await readFile("ai/locales.json", "utf8"));
const localeRows = manifest.locales || [];
if (!localeRows.length) throw new Error("AI locale manifest has no locales.");

const routes = localeRows.map((locale) => {
  if (!locale.llms) throw new Error(`${locale.language}: missing llms route in ai/locales.json.`);
  const url = new URL(locale.llms);
  if (url.origin !== SITE) throw new Error(`${locale.language}: llms route must stay on ${SITE}.`);
  return { ...locale, href: url.pathname };
});

await mkdir(join(OUT, "ai"), { recursive: true });
await cp("ai/locales.json", join(OUT, "ai", "locales.json"));

const machineLinks = routes
  .map((locale) => `<link rel="alternate" type="text/plain" href="${escapeAttribute(locale.href)}" title="${escapeAttribute(locale.label || locale.language)} agent routing">`)
  .join("");

let htmlFilesUpdated = 0;
for (const file of await walkHtml(OUT)) {
  let html = await readFile(file, "utf8");
  if (!html.includes("</head>")) continue;
  const before = html;
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    const rel = getAttribute(tag, "rel").toLowerCase();
    const type = getAttribute(tag, "type").toLowerCase();
    const href = getAttribute(tag, "href");
    if (rel === "alternate" && type === "text/plain" && /(?:^|\/)llms\.txt(?:$|[?#])/i.test(href)) {
      html = html.replace(tag, "");
    }
  }
  html = html.replace("</head>", `${machineLinks}</head>`);
  if (html !== before) {
    await writeFile(file, html);
    htmlFilesUpdated += 1;
  }
}

const llmsPath = join(OUT, "llms.txt");
let llms = await readFile(llmsPath, "utf8");
const markerStart = "<!-- localized-routing:start -->";
const markerEnd = "<!-- localized-routing:end -->";
const existing = new RegExp(`${escapeRegex(markerStart)}[\\s\\S]*?${escapeRegex(markerEnd)}\\n?`, "g");
llms = llms.replace(existing, "").trimEnd();
const routingBlock = `${markerStart}\n\n## Localized agent routing\n\n${routes.map((locale) => `- ${locale.label || locale.language}: ${locale.llms}`).join("\n")}\n\nUse the explicit locale route when that language is requested. Locale coverage is status-dependent; preserve the coverage/status declared in ${SITE}/ai/locales.json instead of assuming full parity.\n\n${markerEnd}`;
llms = `${llms}\n\n${routingBlock}\n`;
await writeFile(llmsPath, llms);

console.log(`Localized AI routing finalized for ${routes.length} locale(s) across ${htmlFilesUpdated} HTML file(s).`);

async function walkHtml(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return []; }
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walkHtml(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

function getAttribute(tag, name) {
  const match = String(tag || "").match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2] || "";
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
