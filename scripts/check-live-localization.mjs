import { readFile } from "node:fs/promises";

const SITE = "https://cognitive-biases.github.io";
const fail = (message) => { throw new Error(`live_localization:${message}`); };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeLocale = (value) => String(value || "").toLowerCase();

const manifest = JSON.parse(await readFile("data/locales.json", "utf8"));
const sourceAiManifest = JSON.parse(await readFile("ai/locales.json", "utf8"));
const canonicalLocale = manifest.canonicalLocale || "en";
const homes = (manifest.locales || []).map((locale) => ({
  ...locale,
  route: locale.code === canonicalLocale ? "/" : locale.urlBase || `/${locale.code.toLowerCase()}/`
}));
const expectedAlternates = new Map(homes.map((home) => [normalizeLocale(home.code), `${SITE}${home.route}`]));
expectedAlternates.set("x-default", `${SITE}/`);
const aiByCode = new Map((sourceAiManifest.locales || []).map((locale) => [locale.language, locale]));

const homeBodies = new Map();
for (const home of homes) {
  const url = `${SITE}${home.route}`;
  const { response, text } = await fetchExact(url);
  if (!/text\/html/i.test(response.headers.get("content-type") || "")) fail(`${home.code}: home is not HTML`);
  if (normalizeLocale(getHtmlLang(text)) !== normalizeLocale(home.code)) fail(`${home.code}: live html lang mismatch`);
  if (findLink(text, "canonical") !== url) fail(`${home.code}: live canonical mismatch`);
  if (!findMeta(text, "name", "description").trim()) fail(`${home.code}: live meta description missing`);
  validateHreflang(home.code, text, expectedAlternates);
  validateJsonLd(home.code, text);
  homeBodies.set(home.code, text);
}

const root = homeBodies.get(canonicalLocale) || "";
if (!root.includes('data-localization-graph-switcher="true"')) fail("canonical home is missing the manifest-driven visible locale switcher");
const rootHrefs = (root.match(/<a\b[^>]*href=["'][^"']+["'][^>]*>/gi) || []).map((tag) => decodeHtml(getAttribute(tag, "href")));
for (const home of homes.filter((item) => item.code !== canonicalLocale)) {
  if (!rootHrefs.includes(home.route)) fail(`canonical home has no live ordinary link to ${home.code} (${home.route})`);
}

const { text: sitemap } = await fetchExact(`${SITE}/sitemap.xml`);
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decodeHtml(match[1]));
for (const home of homes) {
  const url = `${SITE}${home.route}`;
  const count = sitemapUrls.filter((entry) => entry === url).length;
  if (count !== 1) fail(`${home.code}: live sitemap contains ${count} copies of ${url}, expected 1`);
}

const { text: robots } = await fetchExact(`${SITE}/robots.txt`);
if (!new RegExp(`^\\s*Sitemap:\\s*${escapeRegex(`${SITE}/sitemap.xml`)}\\s*$`, "mi").test(robots)) fail("robots.txt does not advertise the canonical sitemap");
const disallows = [...robots.matchAll(/^\s*Disallow:\s*(\S*)\s*$/gmi)].map((match) => match[1]);
if (disallows.includes("/")) fail("robots.txt blocks the entire site");
for (const home of homes.filter((item) => item.route !== "/")) {
  if (disallows.some((rule) => rule && home.route.startsWith(rule))) fail(`${home.code}: robots.txt blocks ${home.route} via ${ruleFor(home.route, disallows)}`);
}

const { text: publicAiText } = await fetchExact(`${SITE}/ai/locales.json`);
let publicAiManifest;
try { publicAiManifest = JSON.parse(publicAiText); } catch { fail("public /ai/locales.json is invalid JSON"); }
assertSameSet("public AI humanInterfaceLanguages", homes.map((home) => home.code), publicAiManifest.humanInterfaceLanguages || []);
assertSameSet("public AI agentRoutingLanguages", homes.map((home) => home.code), publicAiManifest.agentRoutingLanguages || []);
for (const sourceLocale of sourceAiManifest.locales || []) {
  const publicLocale = (publicAiManifest.locales || []).find((item) => item.language === sourceLocale.language);
  if (!publicLocale) fail(`${sourceLocale.language}: missing from public /ai/locales.json`);
  for (const key of ["status", "human", "llms", "data", "agentSkills", "coverage"]) {
    if ((sourceLocale[key] || "") !== (publicLocale[key] || "")) fail(`${sourceLocale.language}: public AI locale ${key} drifted from source`);
  }
}

const { text: rootLlms } = await fetchExact(`${SITE}/llms.txt`);
for (const home of homes) {
  const ai = aiByCode.get(home.code);
  if (!ai) fail(`${home.code}: missing source AI locale record`);
  if (!ai.llms) fail(`${home.code}: missing llms route in AI locale record`);
  const llmsUrl = new URL(ai.llms);
  const { text } = await fetchExact(ai.llms);
  if (!text.trim()) fail(`${home.code}: live llms.txt is empty`);
  if (!rootLlms.includes(ai.llms)) fail(`${home.code}: root llms.txt does not advertise ${ai.llms}`);
  if (!root.includes(`href="${llmsUrl.pathname}"`)) fail(`${home.code}: canonical HTML does not advertise ${llmsUrl.pathname}`);
  if (ai.data) await fetchJsonExact(ai.data, `${home.code}: data`);
  if (ai.agentSkills) await fetchJsonExact(ai.agentSkills, `${home.code}: agentSkills`);
}
if (!rootLlms.includes("coverage/status declared") && !rootLlms.includes("coverage/status")) fail("root llms.txt lacks the partial-vs-full locale coverage warning");

console.log(`Live localization closure passed for ${homes.length} locale(s): homes, redirects, metadata, reciprocal hreflang, sitemap, robots, AI manifest, localized llms and declared machine data.`);

async function fetchExact(url, attempts = 4) {
  let error;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "manual",
        headers: { "user-agent": "CognitiveBiases-LocalizationClosure/1.0", "cache-control": "no-cache" }
      });
      const text = await response.text();
      if (response.ok) return { response, text };
      if (response.status >= 300 && response.status < 400) {
        throw new Error(`${response.status} redirect ${url} -> ${response.headers.get("location") || "unknown"}`);
      }
      error = new Error(`${response.status} ${url}`);
    } catch (caught) { error = caught; }
    if (attempt < attempts) await sleep(900 * attempt);
  }
  throw error;
}

async function fetchJsonExact(url, label) {
  const { response, text } = await fetchExact(url);
  if (!/json|text\/plain|octet-stream/i.test(response.headers.get("content-type") || "")) fail(`${label}: unexpected content type ${response.headers.get("content-type") || "missing"}`);
  try { JSON.parse(text); } catch { fail(`${label}: live JSON is invalid at ${url}`); }
}

function validateHreflang(code, html, expected) {
  const tags = (html.match(/<link\b[^>]*>/gi) || []).filter((tag) => getAttribute(tag, "rel")?.toLowerCase() === "alternate" && getAttribute(tag, "hreflang"));
  const actual = new Map();
  for (const tag of tags) {
    const language = normalizeLocale(getAttribute(tag, "hreflang"));
    if (actual.has(language)) fail(`${code}: duplicate live hreflang ${language}`);
    actual.set(language, decodeHtml(getAttribute(tag, "href")));
  }
  if (actual.size !== expected.size) fail(`${code}: live hreflang cluster size ${actual.size}, expected ${expected.size}`);
  for (const [language, href] of expected) {
    if (actual.get(language) !== href) fail(`${code}: live hreflang ${language} -> ${actual.get(language) || "missing"}, expected ${href}`);
  }
}

function validateJsonLd(code, html) {
  const scripts = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1].trim());
  if (!scripts.length) fail(`${code}: no live JSON-LD on locale home`);
  const languages = [];
  for (const [index, script] of scripts.entries()) {
    let data;
    try { data = JSON.parse(script); } catch { fail(`${code}: invalid live JSON-LD block ${index + 1}`); }
    collectInLanguages(data, languages);
  }
  if (languages.length && !languages.some((value) => normalizeLocale(value) === normalizeLocale(code))) fail(`${code}: live structured-data language mismatch (${languages.join(", ")})`);
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

function ruleFor(route, rules) {
  return rules.find((rule) => rule && route.startsWith(rule)) || "unknown rule";
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

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
