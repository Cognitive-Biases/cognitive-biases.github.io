import { access, readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const failures = [];
const fail = (message) => failures.push(message);
const LOCALES = {
  fr: { intl: "fr-FR", stopwords: ["de","du","des","le","la","les","un","une","et","ou","avec","pour","par","sur","en","dans","sans","sous","à","au","aux"] },
  es: { intl: "es-ES", stopwords: ["de","del","el","la","los","las","un","una","y","o","con","para","por","sobre","en","sin","a","al"] },
  "pt-br": { intl: "pt-BR", stopwords: ["de","da","do","das","dos","um","uma","e","ou","com","para","por","sobre","em","sem","a","ao"] },
  it: { intl: "it-IT", stopwords: ["di","del","della","dei","degli","delle","un","una","e","o","con","per","da","su","in","senza","a","al"] },
  de: { intl: "de-DE", stopwords: ["der","die","das","des","den","dem","ein","eine","und","oder","mit","für","von","zu","im","in","auf","über"] },
  ru: { intl: "ru-RU", stopwords: ["и","или","с","со","для","по","на","в","во","из","от","до","о","об","без","под","над","при"] }
};

const arwp = JSON.parse(await readFile(".arwp/localization.json", "utf8"));
const aiLocales = JSON.parse(await readFile("ai/locales.json", "utf8"));
const contract = JSON.parse(await readFile("data/localization-contract.json", "utf8"));
const localeManifest = JSON.parse(await readFile("data/locales.json", "utf8"));
const dispositions = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((entry) => entry.published);
const byId = new Map(biases.map((entry) => [entry.id, entry]));
const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");

const routing = arwp.surfaces?.find((surface) => surface.id === "agent-routing-llms");
if (routing?.localePattern !== "dist/{locale}/llms.txt") {
  fail(`ARWP routing surface must describe the final Pages artifact path; found ${routing?.localePattern || "missing"}.`);
}
if (!routing?.requiredForRoles?.includes("human-interface")) {
  fail("Localized llms routing must be required for published human-interface locales.");
}

for (const code of ["de", "ru"]) {
  const arwpLocale = arwp.locales?.find((entry) => entry.code === code);
  const aiLocale = aiLocales.locales?.find((entry) => entry.language === code);
  const contractLocale = contract.partialHumanLocales?.find((entry) => entry.code === code);
  if (arwpLocale?.role !== "human-interface" || arwpLocale?.status !== "reviewed-partial-human-interface") {
    fail(`${code}: ARWP must classify the published layer as reviewed-partial human-interface, not routing-only.`);
  }
  if (!aiLocales.humanInterfaceLanguages?.includes(code) || aiLocale?.status !== "reviewed-partial-human-interface" || !aiLocale?.human) {
    fail(`${code}: AI locale manifest must expose the reviewed-partial human interface.`);
  }
  if (!contractLocale || contractLocale.status !== "reviewed-partial-human-interface") {
    fail(`${code}: localization contract must model the partial human layer explicitly.`);
  }
  if ((contract.limitedLocales || []).some((entry) => entry.code === code)) {
    fail(`${code}: partial human locale must not remain in routing-only limitedLocales.`);
  }
}

const workflow = await readFile(".github/workflows/localization-governance.yml", "utf8");
if (!/\n\s*push:\s*\n\s*branches:\s*\[main\]/m.test(workflow)) {
  fail("Localization governance must run on pushes to main so the exact deployed SHA is checked.");
}

const frCss = await readFile("public/fr.css", "utf8");
if (!/\.fr-problem\s*\{[^}]*color\s*:\s*#101622/i.test(frCss)) {
  fail("French problem cards need an explicit dark foreground on their white background.");
}

const localeFiles = new Map();
for (const [locale, config] of Object.entries(LOCALES)) {
  let files = [];
  try {
    files = await walkHtml(join(OUT, locale));
  } catch {
    continue;
  }
  localeFiles.set(locale, files);
  const stopwords = new Set(config.stopwords);
  for (const file of files) {
    const html = await readFile(file, "utf8");
    const descriptionTag = findMetaTag(html, "name", "description");
    const description = descriptionTag ? getAttribute(descriptionTag, "content") : "";
    if (description && endsWithStopword(description, stopwords, config.intl)) {
      fail(`${file}: localized meta description ends with a dangling function word.`);
    }

    if (locale === "de") {
      const header = html.match(/<header\b[\s\S]*?<\/header>/i)?.[0] || "";
      const footer = html.match(/<footer\b[\s\S]*?<\/footer>/i)?.[0] || "";
      if (header.includes('href="/de/techniques/"')) {
        const count = (header.match(/href="\/de\/entscheidungen\/"/g) || []).length;
        if (count !== 1) fail(`${file}: German header must contain exactly one Situationen link; found ${count}.`);
      }
      if (footer.includes('href="/de/techniques/"')) {
        const count = (footer.match(/href="\/de\/entscheidungen\/"/g) || []).length;
        if (count !== 1) fail(`${file}: German footer must contain exactly one Situationen link; found ${count}.`);
      }
    }
  }
}

await checkHomeHreflangGraph();
await checkLocalizedDuplicateGraph();

try {
  const ruHome = await readFile(join(OUT, "ru", "index.html"), "utf8");
  if (ruHome.includes("задать более хороший вопрос")) fail("Russian homepage still contains the machine-like phrase “задать более хороший вопрос”.");
} catch {
  fail("Russian homepage is missing.");
}

const evidenceClasses = JSON.parse(await readFile("data/evidence-classes.json", "utf8"));
try {
  const publicRu = JSON.parse(await readFile(join(OUT, "data", "ru", "biases.json"), "utf8"));
  const expected = Object.keys(evidenceClasses.bySlug || {}).sort();
  const actual = (publicRu.entries || []).map((entry) => entry.slug).sort();
  if (expected.length !== actual.length || expected.some((slug, index) => slug !== actual[index])) {
    fail(`Published Russian reviewed coverage must match all controlled evidence concepts exactly (${actual.length}/${expected.length}).`);
  }
} catch {
  fail("Published Russian machine-readable bias data is missing or invalid.");
}

runGovernanceFaultInjectionSelfTests();

if (failures.length) {
  console.error(`Localization regression check failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Localization regression checks passed: routing path, partial-human DE/RU classification, main-push governance, French contrast, localized metadata, German navigation, Russian reviewed coverage/copy, reciprocal home hreflang and localized duplicate equivalence.");

async function checkHomeHreflangGraph() {
  const homes = [];
  for (const locale of localeManifest.locales || []) {
    const route = locale.code === localeManifest.canonicalLocale ? "/" : locale.urlBase || `/${locale.code.toLowerCase()}/`;
    const file = route === "/" ? join(OUT, "index.html") : join(OUT, route.replace(/^\//, ""), "index.html");
    try {
      await access(file);
      homes.push({ code: locale.code, route, file });
    } catch {
      // Only public homes belong to the published equivalence cluster.
    }
  }
  const expected = new Map(homes.map(({ code, route }) => [code.toLowerCase(), `${SITE}${route}`]));
  expected.set("x-default", `${SITE}/`);
  for (const home of homes) {
    const html = await readFile(home.file, "utf8");
    const actual = hreflangMap(html);
    for (const [code, href] of expected) {
      const values = actual.get(code) || [];
      if (values.length !== 1 || values[0] !== href) {
        fail(`${home.route}: hreflang ${code} must appear exactly once and point to ${href}; found ${values.join(", ") || "missing"}.`);
      }
    }
    for (const code of actual.keys()) {
      if (!expected.has(code)) fail(`${home.route}: unexpected home hreflang ${code}; all home clusters must use the shared published-locale graph.`);
    }
  }
}

async function checkLocalizedDuplicateGraph() {
  const aliasPairs = [];
  for (const group of dispositions.groups || []) {
    const primary = byId.get(group.primaryId);
    if (!primary) {
      fail(`${group.concept}: primary id ${group.primaryId} is missing.`);
      continue;
    }
    const duplicateIds = new Set(group.duplicateIds || []);
    for (const separateId of group.separateIds || []) {
      if (duplicateIds.has(separateId)) fail(`${group.concept}: id ${separateId} cannot be both duplicate and separate.`);
      if (!byId.has(separateId)) fail(`${group.concept}: separate id ${separateId} is missing.`);
    }
    for (const duplicateId of duplicateIds) {
      const duplicate = byId.get(duplicateId);
      if (!duplicate) fail(`${group.concept}: duplicate id ${duplicateId} is missing.`);
      else aliasPairs.push({ group, primary, duplicate });
    }
  }

  for (const [locale, files] of localeFiles) {
    const records = [];
    for (const file of files) {
      const html = await readFile(file, "utf8");
      const en = alternateHref(html, "en");
      const slug = englishBiasSlug(en);
      if (!slug) continue;
      records.push({ file, html, slug, canonical: canonicalHref(html), self: fileUrl(file) });
    }
    const bySlug = new Map(records.map((record) => [record.slug, record]));

    for (const { group, primary, duplicate } of aliasPairs) {
      const primaryRecord = bySlug.get(primary.slug);
      const duplicateRecord = bySlug.get(duplicate.slug);
      if (!duplicateRecord) continue;
      if (!primaryRecord) {
        fail(`${locale}/${duplicate.slug}: localized duplicate exists without localized primary ${primary.slug}.`);
        continue;
      }
      if (duplicateRecord.canonical !== primaryRecord.canonical) {
        fail(`${locale}/${duplicate.slug}: localized alias canonical must point to localized primary ${primary.slug}.`);
      }
      if (alternateHref(duplicateRecord.html, "en") !== `${SITE}/biases/${primary.slug}/`) {
        fail(`${locale}/${duplicate.slug}: English hreflang must target the reviewed primary English concept.`);
      }
      if (sitemap.includes(`<loc>${duplicateRecord.self}</loc>`)) {
        fail(`${locale}/${duplicate.slug}: localized alias must be removed from the sitemap.`);
      }
      const aliasPath = new URL(duplicateRecord.self).pathname;
      for (const record of records) {
        if (record.file === duplicateRecord.file) continue;
        if (record.html.includes(`href="${aliasPath}"`)) {
          fail(`${relative(OUT, record.file)}: internal discovery still links to localized alias ${aliasPath}.`);
          break;
        }
      }

      for (const separateId of group.separateIds || []) {
        const separate = byId.get(separateId);
        const separateRecord = separate ? bySlug.get(separate.slug) : null;
        if (separateRecord && separateRecord.canonical !== separateRecord.self) {
          fail(`${locale}/${separate.slug}: reviewed separate homonym must remain self-canonical.`);
        }
      }
    }
  }
}

function runGovernanceFaultInjectionSelfTests() {
  const commentOnly = `// freshness sourceRelease !== release.releaseVersion\nconst ok = true;`;
  if (hasExecutableFreshnessAssertion(stripJsComments(commentOnly))) {
    fail("Fault-injection: a freshness assertion in a comment must not satisfy governance.");
  }
  const executable = `if (translations.sourceRelease !== release.releaseVersion) throw new Error('stale');`;
  if (!hasExecutableFreshnessAssertion(stripJsComments(executable))) {
    fail("Fault-injection: an executable sourceRelease comparison must satisfy freshness governance.");
  }
  for (const code of ["de", "ru", "fr", "es", "pt-BR", "it"]) {
    const locale = [...(contract.fullHumanLocales || []), ...(contract.partialHumanLocales || [])].find((entry) => entry.code === code);
    if (!locale) {
      fail(`Fault-injection: ${code} is missing from human locale ownership.`);
      continue;
    }
    if (isLocaleOwnedPath(`docs/harmless-${code.toLowerCase()}-mention.md`, locale)) {
      fail(`Fault-injection: harmless filename mention must not count as a ${code} localization update.`);
    }
  }
  const de = contract.partialHumanLocales?.find((entry) => entry.code === "de");
  const ru = contract.partialHumanLocales?.find((entry) => entry.code === "ru");
  if (de && !isLocaleOwnedPath("data/de/biases.json", de)) fail("Fault-injection: real German locale data must count as a German update.");
  if (ru && !isLocaleOwnedPath("data/ru/biases.json", ru)) fail("Fault-injection: real Russian locale data must count as a Russian update.");
}

async function walkHtml(dir) {
  await access(dir);
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walkHtml(path));
    else if (entry.isFile() && entry.name === "index.html") files.push(path);
  }
  return files;
}

function findMetaTag(html, key, value) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  return tags.find((tag) => getAttribute(tag, key)?.toLowerCase() === value.toLowerCase()) || null;
}

function getAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2] || "";
}

function endsWithStopword(value, stopwords, intl) {
  const plain = decodeHtml(String(value || "")).replace(/[.…!?]+$/u, "").trim();
  const terminal = plain.match(/([\p{L}’'-]+)$/u)?.[1]?.toLocaleLowerCase(intl);
  return Boolean(terminal && stopwords.has(terminal));
}

function hreflangMap(html) {
  const map = new Map();
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  for (const tag of tags) {
    if (getAttribute(tag, "rel")?.toLowerCase() !== "alternate") continue;
    const code = getAttribute(tag, "hreflang")?.toLowerCase();
    const href = decodeHtml(getAttribute(tag, "href"));
    if (!code || !href) continue;
    if (!map.has(code)) map.set(code, []);
    map.get(code).push(href);
  }
  return map;
}

function alternateHref(html, code) {
  return hreflangMap(html).get(code.toLowerCase())?.[0] || "";
}

function canonicalHref(html) {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  const tag = tags.find((item) => getAttribute(item, "rel")?.toLowerCase() === "canonical");
  return tag ? decodeHtml(getAttribute(tag, "href")) : "";
}

function englishBiasSlug(value) {
  const match = String(value || "").match(/^https:\/\/cognitive-biases\.github\.io\/biases\/([^/]+)\/$/);
  return match?.[1] || "";
}

function fileUrl(file) {
  let path = relative(OUT, file).replaceAll("\\", "/").replace(/index\.html$/, "");
  if (!path.startsWith("/")) path = `/${path}`;
  return `${SITE}${path}`;
}

function stripJsComments(source) {
  return String(source)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function hasExecutableFreshnessAssertion(source) {
  const leftToRight = /\bsourceRelease\b[^\n;]{0,320}(?:===|!==|==|!=)[^\n;]{0,320}\b(?:releaseVersion|release\.releaseVersion)\b/;
  const rightToLeft = /\b(?:releaseVersion|release\.releaseVersion)\b[^\n;]{0,320}(?:===|!==|==|!=)[^\n;]{0,320}\bsourceRelease\b/;
  return leftToRight.test(source) || rightToLeft.test(source);
}

function isLocaleOwnedPath(path, locale) {
  const normalized = String(path).replaceAll("\\", "/").toLowerCase();
  const explicit = [locale.glossary, ...(locale.generatorScripts || []), ...(locale.checkScripts || [])]
    .filter(Boolean)
    .map((item) => String(item).replaceAll("\\", "/").toLowerCase());
  if (explicit.includes(normalized)) return true;
  const prefixes = (locale.localizedSourcePrefixes || [])
    .map((item) => String(item).replaceAll("\\", "/").toLowerCase());
  if (prefixes.some((prefix) => normalized === prefix.replace(/\/$/, "") || normalized.startsWith(prefix))) return true;
  const code = locale.code.toLowerCase();
  const urlCode = code === "pt-br" ? "pt-br" : code;
  if (normalized.startsWith(`data/${urlCode}/`) || normalized.startsWith(`public/${urlCode}.`) || normalized.includes(`/${urlCode}/`)) return true;
  if (normalized.startsWith("data/") && (normalized.includes(`-${urlCode}.`) || normalized.includes(`-${urlCode}-`) || normalized.includes(`_${urlCode}.`))) return true;
  const scriptMarkers = { fr: ["french"], es: ["spanish"], it: ["italian"], "pt-br": ["portuguese", "pt-br"], de: ["german", "-de", "de-"], ru: ["russian", "-ru", "ru-"] }[code] || [code];
  return normalized.startsWith("scripts/") && scriptMarkers.some((marker) => normalized.includes(marker));
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
