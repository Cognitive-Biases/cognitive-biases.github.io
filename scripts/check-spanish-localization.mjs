import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadSpanishTranslations } from "./lib/spanish-translations.mjs";
import { loadFrenchTranslations } from "./lib/french-translations.mjs";

const SITE = "https://cognitive-biases.github.io";
const TODAY = "2026-09-13";

const [release, canonicalBiasesRaw, canonicalTechniquesDoc, localizedTechniques, frenchTechniquesDoc, ui, pages, locales, aiLocales, duplicateDispositions] = await Promise.all([
  readJson("data/release.json"),
  readJson("data/biases.json"),
  readJson("data/techniques.json"),
  readJson("data/techniques-es.json"),
  readJson("data/techniques-fr.json"),
  readJson("data/ui-es.json"),
  readJson("data/pages-es.json"),
  readJson("data/locales.json"),
  readJson("ai/locales.json"),
  readJson("data/duplicate-dispositions.json")
]);

const canonicalBiases = Array.isArray(canonicalBiasesRaw) ? canonicalBiasesRaw : canonicalBiasesRaw.biases || [];
const publishedBiases = canonicalBiases.filter((entry) => entry.published);
const publishedById = new Map(publishedBiases.map((entry) => [entry.id, entry]));
const translations = await loadSpanishTranslations({ canonicalBiases, releaseVersion: release.releaseVersion, today: TODAY });
const translationByCanonical = new Map(translations.entries.map((entry) => [entry.canonicalId, entry]));
const french = await loadFrenchTranslations({ canonicalBiases, releaseVersion: release.releaseVersion, today: TODAY });
const frenchByCanonical = new Map(french.entries.map((entry) => [entry.canonicalId, entry]));
const canonicalTechniques = canonicalTechniquesDoc.techniques || [];
const canonicalTechniqueBySlug = new Map(canonicalTechniques.map((entry) => [entry.slug, entry]));
const localizedTechniqueByCanonical = new Map(localizedTechniques.entries.map((entry) => [entry.canonicalSlug, entry]));
const frenchTechniqueByCanonical = new Map((frenchTechniquesDoc.entries || []).map((entry) => [entry.canonicalSlug, entry]));
const aliasPrimaryBySlug = buildAliasMap();

const localeRecord = locales.locales?.find((entry) => entry.code === "es");
if (!localeRecord || localeRecord.role !== "reviewed-layer") throw new Error("Spanish must be registered as a reviewed-layer locale.");
if (!aiLocales.humanInterfaceLanguages?.includes("es") || !aiLocales.agentRoutingLanguages?.includes("es")) throw new Error("Spanish must be registered for human and agent routing.");
if (!aiLocales.semantics?.humanReviewedLanguages?.includes("es")) throw new Error("Spanish must be registered as a human-reviewed language.");

if (translations.entries.length !== publishedBiases.length) throw new Error(`Spanish coverage must equal all published biases: ${translations.entries.length}/${publishedBiases.length}.`);
const seenIds = new Set();
const seenSlugs = new Set();
for (const entry of translations.entries) {
  if (seenIds.has(entry.canonicalId)) throw new Error(`${entry.canonicalId}: duplicate Spanish canonical ID.`);
  if (seenSlugs.has(entry.localizedSlug)) throw new Error(`${entry.localizedSlug}: duplicate Spanish localized slug.`);
  seenIds.add(entry.canonicalId);
  seenSlugs.add(entry.localizedSlug);

  if (entry.state !== "reviewed") throw new Error(`${entry.canonicalId}: Spanish state must be reviewed.`);
  if (entry.sourceRelease !== release.releaseVersion) throw new Error(`${entry.canonicalId}: stale Spanish source release ${entry.sourceRelease}.`);
  for (const field of ["localizedLabel", "englishLabel", "summary", "practicalQuestion", "boundary"]) {
    if (!String(entry[field] || "").trim()) throw new Error(`${entry.canonicalId}: missing ${field}.`);
  }
  if (entry.summary.length < 55) throw new Error(`${entry.canonicalId}: Spanish summary is too short for a useful definition.`);
  if (entry.practicalQuestion.length < 20) throw new Error(`${entry.canonicalId}: Spanish practicalQuestion is too short.`);
  if (!Array.isArray(entry.examples) || entry.examples.length < 1) throw new Error(`${entry.canonicalId}: add at least one Spanish example.`);
  if (!Array.isArray(entry.searchTerms) || entry.searchTerms.length < 3) throw new Error(`${entry.canonicalId}: add Spanish search/discovery terms.`);

  const authoredSpanish = [entry.localizedLabel, entry.summary, entry.practicalQuestion, entry.boundary, ...(entry.examples || [])].join(" ");
  if (/\b(?:TODO|TBD)\b/.test(authoredSpanish) || /\bplaceholder\b/i.test(authoredSpanish)) {
    throw new Error(`${entry.canonicalId}: Spanish record contains editorial placeholder text.`);
  }

  for (const slug of entry.techniqueSlugs || []) {
    if (!canonicalTechniqueBySlug.has(slug)) throw new Error(`${entry.canonicalId}: unknown canonical technique ${slug}.`);
  }
  if (!frenchByCanonical.has(entry.canonicalId)) throw new Error(`${entry.canonicalId}: expected French equivalent missing; hreflang would be false.`);
}
for (const bias of publishedBiases) {
  if (!seenIds.has(bias.slug)) throw new Error(`${bias.slug}: missing Spanish translation.`);
}

if (localizedTechniques.locale !== "es") throw new Error("Spanish techniques locale must be es.");
if (localizedTechniques.entries.length !== canonicalTechniques.length) throw new Error(`Spanish technique coverage incomplete: ${localizedTechniques.entries.length}/${canonicalTechniques.length}.`);
const seenTechniques = new Set();
const seenTechniqueSlugs = new Set();
for (const entry of localizedTechniques.entries) {
  if (seenTechniques.has(entry.canonicalSlug) || !canonicalTechniqueBySlug.has(entry.canonicalSlug)) throw new Error(`${entry.canonicalSlug}: duplicate or unknown Spanish technique.`);
  if (!entry.localizedSlug || seenTechniqueSlugs.has(entry.localizedSlug)) throw new Error(`${entry.canonicalSlug}: duplicate or missing Spanish technique slug.`);
  seenTechniques.add(entry.canonicalSlug);
  seenTechniqueSlugs.add(entry.localizedSlug);
  if (entry.state !== "reviewed") throw new Error(`${entry.canonicalSlug}: Spanish technique must be reviewed.`);
  for (const field of ["title", "whenToUse", "example", "whyItCanHelp", "limitations"]) {
    if (!String(entry[field] || "").trim()) throw new Error(`${entry.canonicalSlug}: missing Spanish ${field}.`);
  }
  if (!Array.isArray(entry.steps) || entry.steps.length < 3) throw new Error(`${entry.canonicalSlug}: add at least three Spanish steps.`);
  if (!frenchTechniqueByCanonical.has(entry.canonicalSlug)) throw new Error(`${entry.canonicalSlug}: missing French technique equivalent.`);
}
if (ui.locale !== "es" || pages.locale !== "es") throw new Error("Spanish UI/page sources must declare locale es.");
if ((pages.home?.journeys || []).length < 4 || (pages.home?.problems || []).length < 4) throw new Error("Spanish home discovery needs at least four journeys and four problem-first entries.");

const expected = [
  { path: "/es/", en: "/", fr: "/fr/" },
  { path: "/es/explorar/", en: "/explore/", fr: "/fr/explorer/" },
  { path: "/es/tecnicas/", en: "/techniques/", fr: "/fr/techniques/" },
  ...translations.entries.map((entry) => biasRoute(entry)),
  ...localizedTechniques.entries.map((entry) => ({
    path: `/es/tecnicas/${entry.localizedSlug}/`,
    en: `/techniques/${entry.canonicalSlug}/`,
    fr: `/fr/techniques/${frenchTechniqueByCanonical.get(entry.canonicalSlug).localizedSlug}/`
  }))
];

await access("dist/es/index.html");
const sitemap = await readFile("dist/sitemap.xml", "utf8");
for (const item of expected) {
  const target = item.path === "/es/" ? "dist/es/index.html" : join("dist", item.path.replace(/^\//, ""), "index.html");
  await access(target);
  const html = await readFile(target, "utf8");
  const canonical = `${SITE}${item.canonicalPath || item.path}`;
  const english = `${SITE}${item.canonicalEnglishPath || item.en}`;
  const frenchUrl = `${SITE}${item.canonicalFrenchPath || item.fr}`;

  if (!html.includes('<html lang="es">')) throw new Error(`${item.path}: html lang must be es.`);
  if (!html.includes(`<link rel="canonical" href="${canonical}">`)) throw new Error(`${item.path}: canonical must point to ${item.canonicalPath || item.path}.`);
  for (const [lang, value] of [["es", canonical], ["en", english], ["fr", frenchUrl], ["x-default", english]]) {
    if (!html.includes(`hreflang="${lang}" href="${value}"`)) throw new Error(`${item.path}: missing or stale ${lang} hreflang.`);
  }
  if (!html.includes('"inLanguage":"es"')) throw new Error(`${item.path}: structured data must declare Spanish.`);
  const listed = sitemap.includes(`<loc>${SITE}${item.path}</loc>`);
  if (item.isAlias) {
    if (listed) throw new Error(`${item.path}: reviewed Spanish alias must not remain in sitemap.`);
  } else if (!listed) {
    throw new Error(`${item.path}: sitemap missing Spanish URL.`);
  }

  if (!item.isAlias) {
    const enTarget = item.en === "/" ? "dist/index.html" : join("dist", item.en.replace(/^\//, ""), "index.html");
    const enHtml = await readFile(enTarget, "utf8");
    if (!enHtml.includes(`hreflang="es" href="${canonical}"`) || !enHtml.includes(`href="${item.path}"`)) {
      throw new Error(`${item.path}: English equivalent lacks reciprocal Spanish discovery.`);
    }

    const frTarget = item.fr === "/fr/" ? "dist/fr/index.html" : join("dist", item.fr.replace(/^\//, ""), "index.html");
    const frHtml = await readFile(frTarget, "utf8");
    if (!frHtml.includes(`hreflang="es" href="${canonical}"`) || !frHtml.includes(`href="${item.path}"`)) {
      throw new Error(`${item.path}: French equivalent lacks reciprocal Spanish discovery.`);
    }
  }
}

await access("dist/es/llms.txt");
await access("dist/es/data/index.json");
await access("dist/data/translations-es.json");
const manifest = await readJson("dist/es/data/index.json");
if (manifest.locale !== "es" || manifest.canonicalLocale !== "en" || manifest.status !== "reviewed-layer") throw new Error("Spanish locale manifest has an invalid locale contract.");
if (manifest.coverage?.concepts !== publishedBiases.length || manifest.coverage?.canonicalPublishedConcepts !== publishedBiases.length) throw new Error("Spanish locale manifest does not report complete concept coverage.");
if (manifest.coverage?.techniques !== canonicalTechniques.length || manifest.coverage?.fallback !== "none-for-published-biases") throw new Error("Spanish locale manifest has incomplete technique/fallback coverage.");
if (manifest.semantics?.translationReviewSeparateFromEvidenceReview !== true || manifest.semantics?.canonicalIdentifiersRemainEnglish !== true) throw new Error("Spanish locale manifest must preserve evidence and canonical-identity boundaries.");

const llms = await readFile("dist/es/llms.txt", "utf8");
for (const phrase of ["Un sesgo es una lente de comprobación", `${SITE}/es/tecnicas/`, `${SITE}/es/habilidades/`]) {
  if (!llms.includes(phrase)) throw new Error(`Spanish agent routing is missing required guidance: ${phrase}`);
}

console.log(`Spanish localization OK: ${translations.entries.length}/${publishedBiases.length} published biases, ${localizedTechniques.entries.length}/${canonicalTechniques.length} techniques, reciprocal en/fr/es discovery, reviewed alias equivalence and machine-readable routing.`);

function biasRoute(entry) {
  const primarySlug = aliasPrimaryBySlug.get(entry.canonicalId);
  if (!primarySlug) {
    return {
      path: `/es/sesgos/${entry.localizedSlug}/`,
      en: `/biases/${entry.canonicalId}/`,
      fr: `/fr/biais/${frenchByCanonical.get(entry.canonicalId).localizedSlug}/`
    };
  }
  const primarySpanish = translationByCanonical.get(primarySlug);
  const primaryFrench = frenchByCanonical.get(primarySlug);
  if (!primarySpanish || !primaryFrench) throw new Error(`${entry.canonicalId}: reviewed duplicate primary ${primarySlug} is missing a Spanish/French counterpart.`);
  return {
    path: `/es/sesgos/${entry.localizedSlug}/`,
    en: `/biases/${entry.canonicalId}/`,
    fr: `/fr/biais/${frenchByCanonical.get(entry.canonicalId).localizedSlug}/`,
    canonicalPath: `/es/sesgos/${primarySpanish.localizedSlug}/`,
    canonicalEnglishPath: `/biases/${primarySlug}/`,
    canonicalFrenchPath: `/fr/biais/${primaryFrench.localizedSlug}/`,
    isAlias: true
  };
}

function buildAliasMap() {
  const map = new Map();
  for (const group of duplicateDispositions.groups || []) {
    const primary = publishedById.get(group.primaryId);
    if (!primary) throw new Error(`${group.concept}: duplicate disposition primary ${group.primaryId} is missing.`);
    const duplicateIds = new Set(group.duplicateIds || []);
    for (const separateId of group.separateIds || []) {
      if (duplicateIds.has(separateId)) throw new Error(`${group.concept}: ${separateId} cannot be both duplicate and separate.`);
      if (!publishedById.has(separateId)) throw new Error(`${group.concept}: reviewed separate id ${separateId} is missing.`);
    }
    for (const duplicateId of duplicateIds) {
      const duplicate = publishedById.get(duplicateId);
      if (!duplicate) throw new Error(`${group.concept}: duplicate ${duplicateId} is missing.`);
      map.set(duplicate.slug, primary.slug);
    }
  }
  return map;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
