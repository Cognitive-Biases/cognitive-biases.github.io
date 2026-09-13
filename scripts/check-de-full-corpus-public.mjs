import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const published = JSON.parse(await readFile("data/biases.json", "utf8")).filter((entry) => entry.published !== false && entry.slug);
const byId = new Map(published.map((entry) => [entry.id, entry]));
const dispositions = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateToPrimary = new Map();
for (const group of dispositions.groups || []) {
  const primary = byId.get(group.primaryId);
  if (!primary) throw new Error(`${group.concept}: missing primary ${group.primaryId}.`);
  for (const duplicateId of group.duplicateIds || []) {
    const duplicate = byId.get(duplicateId);
    if (!duplicate) throw new Error(`${group.concept}: missing duplicate ${duplicateId}.`);
    duplicateToPrimary.set(duplicate.slug, primary);
  }
}

const failures = [];
const fail = (message) => failures.push(message);
const expectedSlugs = published.map((entry) => entry.slug).sort();
const expectedSet = new Set(expectedSlugs);
const canonicalCount = published.length - duplicateToPrimary.size;
const publicDoc = JSON.parse(await readFile(join(OUT, "data", "de", "biases.json"), "utf8"));
const entries = publicDoc.entries || [];
const actualSlugs = entries.map((entry) => entry.slug).sort();
const actualSet = new Set(actualSlugs);

for (const slug of expectedSlugs) if (!actualSet.has(slug)) fail(`Public German dataset is missing ${slug}.`);
for (const slug of actualSlugs) if (!expectedSet.has(slug)) fail(`Public German dataset has non-public extra ${slug}.`);
if (actualSet.size !== entries.length) fail("Public German dataset contains duplicate slugs.");
if (publicDoc.locale !== "de" || publicDoc.state !== "full-canonical-localization") fail("Public German dataset identity is wrong.");
if (publicDoc.coverage?.publishedCanonical !== published.length || publicDoc.coverage?.localized !== published.length) fail("German full-corpus coverage counters are wrong.");
if (publicDoc.coverage?.duplicateAliasPages !== duplicateToPrimary.size || publicDoc.coverage?.canonicalGermanEntities !== canonicalCount) fail("German canonical/alias counters are wrong.");

let reviewed = 0;
let canonicalReview = 0;
let legacy = 0;
for (const entry of entries) {
  if (entry.localizationState === "reviewed-evidence") reviewed += 1;
  else if (entry.localizationState === "localized-with-canonical-review") canonicalReview += 1;
  else if (entry.localizationState === "localized-legacy") legacy += 1;
  else fail(`${entry.slug}: invalid localizationState ${entry.localizationState}.`);

  for (const field of ["slug", "title", "englishTitle", "summary", "canonicalUrl", "germanUrl"]) {
    if (!String(entry[field] || "").trim()) fail(`${entry.slug || "(missing slug)"}: missing public field ${field}.`);
  }

  const primary = duplicateToPrimary.get(entry.slug) || null;
  const expectedDe = `${SITE}/de/biases/${primary?.slug || entry.slug}/`;
  const expectedEn = `${SITE}/biases/${primary?.slug || entry.slug}/`;
  const relative = `de/biases/${entry.slug}`;
  const file = join(OUT, relative, "index.html");
  try { await access(file); } catch { fail(`Missing German page /${relative}/.`); continue; }
  const html = await readFile(file, "utf8");
  if (!html.includes('<html lang="de">')) fail(`/${relative}/: lang=de missing.`);
  if (!html.includes(`rel="canonical" href="${expectedDe}"`)) fail(`/${relative}/: canonical URL is wrong.`);
  if (!html.includes(`hreflang="de" href="${expectedDe}"`)) fail(`/${relative}/: German alternate is wrong.`);
  if (!html.includes(`hreflang="en" href="${expectedEn}"`)) fail(`/${relative}/: English alternate is wrong.`);
  if (!html.includes('href="/de/entscheidungen/"')) fail(`/${relative}/: situation navigation missing.`);
  for (const marker of ["Was passiert?", "Probier das", "Grenzen"]) if (!html.includes(marker)) fail(`/${relative}/: missing ${marker}.`);

  if (primary) {
    if (!html.includes("Zusammengeführter Eintrag.")) fail(`/${relative}/: consolidation notice missing.`);
    if (entry.isCanonical !== false || entry.primarySlug !== primary.slug || entry.canonicalGermanUrl !== expectedDe) fail(`${entry.slug}: alias metadata is wrong.`);
  } else if (entry.isCanonical !== true || entry.canonicalGermanUrl !== expectedDe) {
    fail(`${entry.slug}: canonical metadata is wrong.`);
  }

  if (entry.localizationState === "localized-legacy" && !html.includes("Noch kein kontrollierter Evidence Review") && !html.includes("Lokalisierung ohne kontrollierten Review")) fail(`/${relative}/: missing legacy evidence warning.`);
  if (entry.localizationState === "localized-with-canonical-review" && !html.includes("Kanonischer Review vorhanden")) fail(`/${relative}/: missing canonical-review disclosure.`);
  if (entry.localizationState === "reviewed-evidence" && !html.includes("Vollständiger Evidence Review")) fail(`/${relative}/: reviewed evidence path missing.`);

  const englishFile = join(OUT, "biases", entry.slug, "index.html");
  try {
    const englishHtml = await readFile(englishFile, "utf8");
    if (!englishHtml.includes(`hreflang="de" href="${expectedDe}"`)) fail(`${entry.slug}: English page has wrong German alternate.`);
  } catch { fail(`${entry.slug}: English canonical/alias page missing.`); }
}

if (publicDoc.coverage?.reviewedGerman !== reviewed) fail("reviewedGerman counter is wrong.");
if (publicDoc.coverage?.localizedWithCanonicalReview !== canonicalReview) fail("localizedWithCanonicalReview counter is wrong.");
if (publicDoc.coverage?.localizedLegacy !== legacy) fail("localizedLegacy counter is wrong.");
if (reviewed + canonicalReview + legacy !== published.length) fail("Localization-state counters do not sum to full coverage.");

const indexHtml = await readFile(join(OUT, "de", "biases", "index.html"), "utf8");
if (!indexHtml.includes("Vollständiger deutscher Kanon")) fail("/de/biases/: full-corpus identity missing.");
if (!indexHtml.includes(`Insgesamt: ${canonicalCount}`)) fail(`/de/biases/: visible canonical count should be ${canonicalCount}.`);
if (!indexHtml.includes(`"numberOfItems":${canonicalCount}`)) fail(`/de/biases/: CollectionPage count should be ${canonicalCount}.`);
if (!indexHtml.includes("data-de-filter")) fail("/de/biases/: search missing.");
if (indexHtml.includes(`hreflang="en" href="${SITE}/explore/"`)) fail("/de/biases/: false collection hreflang to /explore/.");
for (const slug of duplicateToPrimary.keys()) if (indexHtml.includes(`href="/de/biases/${slug}/"`)) fail(`/de/biases/: duplicate alias ${slug} should not appear as a separate discovery card.`);

const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
for (const slug of expectedSlugs) {
  const route = `<loc>${SITE}/de/biases/${slug}/</loc>`;
  if (duplicateToPrimary.has(slug)) {
    if (sitemap.includes(route)) fail(`sitemap.xml should exclude consolidated German duplicate ${slug}.`);
  } else if (!sitemap.includes(route)) fail(`sitemap.xml is missing German canonical route ${slug}.`);
}

if (failures.length) {
  console.error("German full-corpus public check failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}
console.log(`German full-corpus public check passed: ${published.length}/${published.length} published records represented, ${canonicalCount} canonical German entities + ${duplicateToPrimary.size} alias URLs; ${reviewed} reviewed German, ${canonicalReview} localized with canonical review, ${legacy} localized legacy.`);
