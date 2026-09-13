import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const errors = [];

const [translations, techniqueTranslations, ui, pages, release, locales, aiLocales, biasesRaw, techniques] = await Promise.all([
  readJson("data/translations-fr.json"),
  readJson("data/techniques-fr.json"),
  readJson("data/ui-fr.json"),
  readJson("data/pages-fr.json"),
  readJson("data/release.json"),
  readJson("data/locales.json"),
  readJson("ai/locales.json"),
  readJson("data/biases.json"),
  readJson("data/techniques.json")
]);
const biases = Array.isArray(biasesRaw) ? biasesRaw : biasesRaw.biases || [];
const publishedBiases = new Set(biases.filter((entry) => entry.published).map((entry) => entry.slug));
const canonicalTechniques = new Set(techniques.techniques.map((entry) => entry.slug));
const evidenceSlugs = await loadEvidenceSlugs();

expect(locales.locales.some((entry) => entry.code === "fr" && entry.role === "reviewed-layer"), "data/locales.json must declare fr as reviewed-layer");
expect(aiLocales.humanInterfaceLanguages.includes("fr"), "ai/locales.json must expose fr as a human interface language");
expect(aiLocales.agentRoutingLanguages.includes("fr"), "ai/locales.json must expose fr as an agent routing language");
expect(aiLocales.locales.some((entry) => entry.language === "fr"), "ai/locales.json must include a French locale record");
expect(translations.locale === "fr" && translations.canonicalLocale === "en", "French concept dataset locale metadata is invalid");
expect(techniqueTranslations.locale === "fr" && techniqueTranslations.canonicalLocale === "en", "French technique dataset locale metadata is invalid");
expect(translations.sourceRelease === release.releaseVersion, "French concept translations must point to the current canonical release");
expect(techniqueTranslations.sourceRelease === release.releaseVersion, "French technique translations must point to the current canonical release");
expect(translations.entries.length >= 8, "French v1 should contain at least eight reviewed concept entries");
expect(techniqueTranslations.entries.length === canonicalTechniques.size, "Every canonical decision technique must have a French reviewed translation");

const localizedBiasSlugs = new Set();
const canonicalBiasIds = new Set();
for (const entry of translations.entries) {
  expect(entry.state === "reviewed", `${entry.canonicalId}: French concept state must be reviewed`);
  expect(publishedBiases.has(entry.canonicalId), `${entry.canonicalId}: canonical bias is missing or unpublished`);
  expect(evidenceSlugs.has(entry.canonicalId), `${entry.canonicalId}: French v1 concepts must have a canonical evidence review`);
  expect(entry.sourceRelease === release.releaseVersion, `${entry.canonicalId}: sourceRelease does not match current release`);
  for (const field of ["localizedSlug", "localizedLabel", "englishLabel", "summary", "practicalQuestion", "evidenceSummary", "boundary", "translatedAt", "reviewedAt"]) {
    expect(Boolean(entry[field]), `${entry.canonicalId}: missing ${field}`);
  }
  expect(Array.isArray(entry.examples) && entry.examples.length >= 2, `${entry.canonicalId}: add at least two localized examples`);
  expect(Array.isArray(entry.searchTerms) && entry.searchTerms.length >= 2, `${entry.canonicalId}: add French/English discovery terms`);
  expect(Array.isArray(entry.techniqueSlugs) && entry.techniqueSlugs.length >= 1, `${entry.canonicalId}: connect at least one practical technique`);
  for (const techniqueSlug of entry.techniqueSlugs || []) expect(canonicalTechniques.has(techniqueSlug), `${entry.canonicalId}: unknown technique ${techniqueSlug}`);
  expect(!localizedBiasSlugs.has(entry.localizedSlug), `Duplicate French bias slug: ${entry.localizedSlug}`);
  expect(!canonicalBiasIds.has(entry.canonicalId), `Duplicate canonical bias translation: ${entry.canonicalId}`);
  localizedBiasSlugs.add(entry.localizedSlug);
  canonicalBiasIds.add(entry.canonicalId);
}

const localizedTechniqueSlugs = new Set();
const translatedCanonicalTechniques = new Set();
for (const entry of techniqueTranslations.entries) {
  expect(entry.state === "reviewed", `${entry.canonicalSlug}: French technique state must be reviewed`);
  expect(canonicalTechniques.has(entry.canonicalSlug), `${entry.canonicalSlug}: canonical technique is missing`);
  for (const field of ["localizedSlug", "title", "whenToUse", "example", "whyItCanHelp", "limitations", "translatedAt", "reviewedAt"]) {
    expect(Boolean(entry[field]), `${entry.canonicalSlug}: missing ${field}`);
  }
  expect(Array.isArray(entry.steps) && entry.steps.length >= 3, `${entry.canonicalSlug}: a practical technique needs at least three steps`);
  expect(!localizedTechniqueSlugs.has(entry.localizedSlug), `Duplicate French technique slug: ${entry.localizedSlug}`);
  expect(!translatedCanonicalTechniques.has(entry.canonicalSlug), `Duplicate canonical technique translation: ${entry.canonicalSlug}`);
  localizedTechniqueSlugs.add(entry.localizedSlug);
  translatedCanonicalTechniques.add(entry.canonicalSlug);
}
for (const slug of canonicalTechniques) expect(translatedCanonicalTechniques.has(slug), `Missing French technique translation: ${slug}`);

expect(ui.locale === "fr", "data/ui-fr.json must declare locale fr");
expect(!JSON.stringify(ui).toLowerCase().includes('"hack"'), "French UI should not use Hack as the main product term");
expect(pages.locale === "fr", "data/pages-fr.json must declare locale fr");
expect(pages.home?.journeys?.length >= 4, "French homepage should support the four main discovery journeys");
expect(pages.home?.problems?.length >= 4, "French homepage should include problem-first discovery examples");

if (await exists(OUT)) await checkGeneratedOutput();

if (errors.length) {
  console.error(`French localization check failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`French localization checks passed: ${translations.entries.length} reviewed concepts and ${techniqueTranslations.entries.length} translated techniques.`);

async function checkGeneratedOutput() {
  const expected = [
    { path: "/fr/", englishPath: "/" },
    { path: "/fr/explorer/", englishPath: "/explore/" },
    { path: "/fr/techniques/", englishPath: "/techniques/" },
    ...translations.entries.map((entry) => ({ path: `/fr/biais/${entry.localizedSlug}/`, englishPath: `/biases/${entry.canonicalId}/` })),
    ...techniqueTranslations.entries.map((entry) => ({ path: `/fr/techniques/${entry.localizedSlug}/`, englishPath: `/techniques/${entry.canonicalSlug}/` }))
  ];
  for (const pair of expected) {
    const target = outputFile(pair.path);
    expect(await exists(target), `Generated French page is missing: ${pair.path}`);
    if (!await exists(target)) continue;
    const html = await readFile(target, "utf8");
    const frUrl = `${SITE}${pair.path}`;
    const enUrl = `${SITE}${pair.englishPath}`;
    expect(html.includes('<html lang="fr">'), `${pair.path}: html lang must be fr`);
    expect(html.includes(`<link rel="canonical" href="${frUrl}">`), `${pair.path}: self canonical is missing`);
    expect(html.includes(`<link rel="alternate" hreflang="fr" href="${frUrl}">`), `${pair.path}: French hreflang is missing`);
    expect(html.includes(`<link rel="alternate" hreflang="en" href="${enUrl}">`), `${pair.path}: English hreflang is missing`);
    expect(html.includes(`<link rel="alternate" hreflang="x-default" href="${enUrl}">`), `${pair.path}: x-default must point to canonical English`);
    expect(html.includes('"inLanguage":"fr"'), `${pair.path}: JSON-LD must expose inLanguage=fr`);
    expect(!html.includes('>Skip to content<'), `${pair.path}: English skip-link copy leaked into French UI`);

    const englishTarget = outputFile(pair.englishPath);
    expect(await exists(englishTarget), `English equivalent is missing: ${pair.englishPath}`);
    if (await exists(englishTarget)) {
      const englishHtml = await readFile(englishTarget, "utf8");
      expect(englishHtml.includes(`<link rel="alternate" hreflang="fr" href="${frUrl}">`), `${pair.englishPath}: reciprocal French hreflang is missing`);
      expect(englishHtml.includes('data-locale-switch="fr"'), `${pair.englishPath}: visible French language switch is missing`);
    }
  }

  for (const entry of techniqueTranslations.entries) {
    const html = await readFile(outputFile(`/fr/techniques/${entry.localizedSlug}/`), "utf8");
    for (const label of [ui.labels.whenToUse, ui.labels.tryThis, ui.labels.example, ui.labels.whyItCanHelp, "Limites"]) {
      expect(html.includes(label), `${entry.canonicalSlug}: generated technique page is missing section ${label}`);
    }
  }

  const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
  for (const pair of expected) expect(sitemap.includes(`<loc>${SITE}${pair.path}</loc>`), `Sitemap is missing ${pair.path}`);
  expect(await exists(join(OUT, "fr", "llms.txt")), "French llms.txt is missing");
  expect(await exists(join(OUT, "fr", "data", "index.json")), "French machine-readable locale manifest is missing");
  if (await exists(join(OUT, "fr", "data", "index.json"))) {
    const manifest = await readJson(join(OUT, "fr", "data", "index.json"));
    expect(manifest.locale === "fr" && manifest.canonicalLocale === "en", "French locale manifest metadata is invalid");
    expect(manifest.coverage?.concepts === translations.entries.length, "French locale manifest concept count is stale");
    expect(manifest.coverage?.techniques === techniqueTranslations.entries.length, "French locale manifest technique count is stale");
    expect(manifest.semantics?.canonicalIdentifiersRemainEnglish === true, "French locale manifest must preserve canonical identifiers");
  }
}

function outputFile(route) {
  return route === "/" ? join(OUT, "index.html") : join(OUT, route.replace(/^\//, ""), "index.html");
}
function expect(condition, message) {
  if (!condition) errors.push(message);
}
async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}
async function loadEvidenceSlugs() {
  const names = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
  const slugs = new Set();
  for (const name of names) {
    const document = await readJson(join("data", name));
    for (const review of document.reviews || []) slugs.add(review.slug);
  }
  return slugs;
}
