import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const manifest = JSON.parse(await readFile("data/locales.json", "utf8"));
const canonicalLocale = manifest.canonicalLocale || "en";
const homes = [];
const languageLabels = {
  en: "Language",
  de: "Sprache",
  ru: "Язык",
  fr: "Langue",
  "pt-BR": "Idioma",
  es: "Idioma",
  it: "Lingua"
};

for (const locale of manifest.locales || []) {
  const route = locale.code === canonicalLocale ? "/" : locale.urlBase || `/${locale.code.toLowerCase()}/`;
  const file = route === "/" ? join(OUT, "index.html") : join(OUT, route.replace(/^\//, ""), "index.html");
  try {
    await access(file);
    homes.push({ ...locale, route, file });
  } catch {
    throw new Error(`Declared published locale is missing a generated home page: ${locale.code} (${route})`);
  }
}

if (!homes.some((home) => home.code === canonicalLocale)) {
  throw new Error(`Canonical locale ${canonicalLocale} is missing from the generated locale graph.`);
}

let updated = 0;
for (const current of homes) {
  let html = await readFile(current.file, "utf8");
  html = html.replace(/<(div|nav)\b[^>]*class=["'][^"']*\blocale-switch-bar\b[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi, "");

  const switcherItems = homes.map((home) => home.code === current.code
    ? `<span aria-current="page" lang="${escapeAttribute(home.code)}">${escapeHtml(home.name || home.code)}</span>`
    : `<a href="${escapeAttribute(home.route)}" hreflang="${escapeAttribute(home.code)}" lang="${escapeAttribute(home.code)}">${escapeHtml(home.name || home.code)}</a>`
  ).join("");

  // Keep the long-standing French marker while centralizing the public locale
  // graph. Older compatibility checks still use the marker, while the full
  // switcher is now intentionally present on every published locale home.
  const switcher = `<nav class="locale-switch-bar" data-locale-switch="fr" data-localization-graph-switcher="true" aria-label="${escapeAttribute(languageLabels[current.code] || languageLabels.en)}">${switcherItems}</nav>`;

  if (!/<body(?:\s[^>]*)?>/i.test(html)) {
    throw new Error(`Cannot insert the visible locale switcher without <body>: ${current.code}`);
  }
  html = html.replace(/<body([^>]*)>/i, `<body$1>${switcher}`);
  await writeFile(current.file, html);
  updated += 1;
}

const cssPath = join(OUT, "styles.css");
let css = await readFile(cssPath, "utf8");
const rule = /\.locale-switch-bar\{([^}]*)\}/;
if (rule.test(css)) {
  css = css.replace(rule, (match, body) => body.includes("flex-wrap:") ? match : `.locale-switch-bar{flex-wrap:wrap;${body}}`);
} else {
  css += `\n.locale-switch-bar{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:.65rem;align-items:center;padding:.65rem max(1rem,calc((100vw - 1160px)/2));font-size:.9rem;background:#f5f2ea;border-bottom:1px solid rgba(16,22,34,.12)}.locale-switch-bar a{font-weight:900}.locale-switch-bar [aria-current="page"]{text-decoration:underline;text-underline-offset:.2em}\n`;
}
await writeFile(cssPath, css);

console.log(`Visible locale switcher finalized on ${updated} home page(s) from manifest: ${homes.map((home) => home.code).join(", ")}.`);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
