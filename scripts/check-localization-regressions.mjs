import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

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
const routing = arwp.surfaces?.find((surface) => surface.id === "agent-routing-llms");
if (routing?.localePattern !== "dist/{locale}/llms.txt") {
  fail(`ARWP routing surface must describe the final Pages artifact path; found ${routing?.localePattern || "missing"}.`);
}

const frCss = await readFile("public/fr.css", "utf8");
if (!/\.fr-problem\s*\{[^}]*color\s*:\s*#101622/i.test(frCss)) {
  fail("French problem cards need an explicit dark foreground on their white background.");
}

for (const [locale, config] of Object.entries(LOCALES)) {
  let files = [];
  try {
    files = await walkHtml(join(OUT, locale));
  } catch {
    continue;
  }
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

if (failures.length) {
  console.error(`Localization regression check failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Localization regression checks passed: routing path, French contrast, localized metadata, German navigation and Russian reviewed coverage/copy.");

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

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
