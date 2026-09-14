import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const fail = (message) => { throw new Error(`localization_closure:${message}`); };
const normalizeLocale = (value) => String(value || "").toLowerCase();

const manifest = JSON.parse(await readFile("data/locales.json", "utf8"));
const aiManifest = JSON.parse(await readFile("ai/locales.json", "utf8"));
const canonicalLocale = manifest.canonicalLocale || "en";
const homes = (manifest.locales || []).map((locale) => ({
  ...locale,
  route: locale.code === canonicalLocale ? "/" : locale.urlBase || `/${locale.code.toLowerCase()}/`
}));

if (!homes.length) fail("locale manifest has no locales");
if (!homes.some((home) => home.code === canonicalLocale)) fail(`canonical locale ${canonicalLocale} is not declared`);

const declaredCodes = homes.map((home) => home.code);
assertSameSet("AI humanInterfaceLanguages", declaredCodes, aiManifest.humanInterfaceLanguages || []);
assertSameSet("AI agentRoutingLanguages", declaredCodes, aiManifest.agentRoutingLanguages || []);

const aiByCode = new Map((aiManifest.locales || []).map((locale) => [locale.language, locale]));
for (const home of homes) {
  if (!aiByCode.has(home.code)) fail(`${home.code}: missing from ai/locales.json`);
}

const expectedAlternates = new Map(homes.map((home) => [normalizeLocale(home.code), `${SITE}${home.route}`]));
expectedAlternates.set("x-default", `${SITE}/`);

for (const home of homes) {
  const file = home.route === "/" ? join(OUT, "index.html") : join(OUT, home.route.replace(/^\//, ""), "index.html");
  await requireFile(file, `${home.code}: generated home page missing`);
  const html = await readFile(file, "utf8");

  const htmlLang = getHtmlLang(html);
  if (normalizeLocale(htmlLang) !== normalizeLocale(home.code)) fail(`${home.code}: html lang is ${htmlLang || "missing"}`);

  const canonical = findLink(html, "canonical");
  if (canonical !== `${SITE}${home.route}`) fail(`${home.code}: canonical mismatch ${canonical || "missing"}`);

  const description = findMeta(html, "name", "description");
  if (!description.trim()) fail(`${home.code}: meta description missing`);

  const alternateTags = (html.match(/<link\b[^>]*>/gi) || []).filter((tag) => getAttribute(tag, "rel")?.toLowerCase() === "alternate" && getAttribute(tag, "hreflang"));
  const alternates = new Map();
  for (const tag of alternateTags) {
    const code = normalizeLocale(getAttribute(tag, "hreflang"));
    if (alternates.has(code)) fail(`${home.code}: duplicate hreflang ${code}`);
    alternates.set(code, decodeHtml(getAttribute(tag, "href")));
  }
  if (alternates.size !== expectedAlternates.size) fail(`${home.code}: hreflang cluster size ${alternates.size}, expected ${expectedAlternates.size}`);
  for (const [code, href] of expectedAlternates) {
    if (alternates.get(code) !== href) fail(`${home.code}: hreflang ${code} -> ${alternates.get(code) || "missing"}, expected ${href}`);
  }

  validateJsonLd(home.code, html);

  const ai = aiByCode.get(home.code);
  if (home.code !== canonicalLocale && ai.human !== `${SITE}${home.route}`) fail(`${home.code}: AI human route mismatch ${ai.human || "missing"}`);
  if (!ai.llms) fail(`${home.code}: AI llms route missing`);
  await validateMachineUrl(ai.llms, `${home.code}: llms`);
  if (ai.data) await validateMachineUrl(ai.data, `${home.code}: data`, true);
  if (ai.agentSkills) await validateMachineUrl(ai.agentSkills, `${home.code}: agentSkills`, true);
}

const rootHtml = await readFile(join(OUT, "index.html"), "utf8");
if (!rootHtml.includes('data-localization-graph-switcher="true"')) fail("canonical home is missing manifest-driven visible locale switcher");
const rootHrefs = (rootHtml.match(/<a\b[^>]*href=["'][^"']+["'][^>]*>/gi) || []).map((tag) => decodeHtml(getAttribute(tag, "href")));
for (const home of homes.filter((item) => item.code !== canonicalLocale)) {
  if (!rootHrefs.includes(home.route)) fail(`canonical home has no ordinary visible link to ${home.code} (${home.route})`);
}

const styles = await readFile(join(OUT, "styles.css"), "utf8");
const switcherRule = styles.match(/\.locale-switch-bar\{([^}]*)\}/)?.[1] || "";
if (!/flex-wrap\s*:\s*wrap/i.test(switcherRule)) fail("visible locale switcher is not mobile-wrap safe");

const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decodeHtml(match[1]));
for (const home of homes) {
  const target = `${SITE}${home.route}`;
  const count = sitemapUrls.filter((url) => url === target).length;
  if (count !== 1) fail(`${home.code}: sitemap contains ${count} copies of ${target}, expected 1`);
}

console.log(`Localization closure passed for ${homes.length} declared locale home(s): ${declaredCodes.join(", ")}.`);

async function requireFile(path, message) {
  try { await access(path); } catch { fail(message); }
}

async function validateMachineUrl(value, label, json = false) {
  let url;
  try { url = new URL(value); } catch { fail(`${label}: invalid URL ${value}`); }
  if (url.origin !== SITE) fail(`${label}: must be same-origin, got ${value}`);
  const path = join(OUT, decodeURIComponent(url.pathname).replace(/^\//, ""));
  await requireFile(path, `${label}: generated public file missing at ${url.pathname}`);
  const text = await readFile(path, "utf8");
  if (!text.trim()) fail(`${label}: generated public file is empty at ${url.pathname}`);
  if (json) {
    try { JSON.parse(text); } catch { fail(`${label}: invalid JSON at ${url.pathname}`); }
  }
}

function validateJsonLd(code, html) {
  const scripts = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1].trim());
  if (!scripts.length) fail(`${code}: no JSON-LD on locale home`);
  const languages = [];
  for (const [index, script] of scripts.entries()) {
    let data;
    try { data = JSON.parse(script); } catch { fail(`${code}: invalid JSON-LD block ${index + 1}`); }
    collectInLanguages(data, languages);
  }
  if (languages.length && !languages.some((value) => normalizeLocale(value) === normalizeLocale(code))) {
    fail(`${code}: structured data language does not include ${code}; found ${languages.join(", ")}`);
  }
}

function collectInLanguages(value, output) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectInLanguages(item, output);
    return;
  }
  if (typeof value.inLanguage === "string") output.push(value.inLanguage);
  else if (Array.isArray(value.inLanguage)) output.push(...value.inLanguage.filter((item) => typeof item === "string"));
  for (const item of Object.values(value)) collectInLanguages(item, output);
}

function assertSameSet(label, expected, actual) {
  const left = [...new Set(expected.map(normalizeLocale))].sort();
  const right = [...new Set(actual.map(normalizeLocale))].sort();
  if (JSON.stringify(left) !== JSON.stringify(right)) fail(`${label} mismatch: expected ${left.join(", ")}; got ${right.join(", ")}`);
}

function getHtmlLang(html) {
  const tag = html.match(/<html\b[^>]*>/i)?.[0] || "";
  return decodeHtml(getAttribute(tag, "lang"));
}

function findLink(html, rel) {
  const tag = (html.match(/<link\b[^>]*>/gi) || []).find((item) => getAttribute(item, "rel")?.toLowerCase() === rel.toLowerCase());
  return tag ? decodeHtml(getAttribute(tag, "href")) : "";
}

function findMeta(html, key, value) {
  const tag = (html.match(/<meta\b[^>]*>/gi) || []).find((item) => getAttribute(item, key)?.toLowerCase() === value.toLowerCase());
  return tag ? decodeHtml(getAttribute(tag, "content")) : "";
}

function getAttribute(tag, name) {
  const match = String(tag || "").match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2] || "";
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
