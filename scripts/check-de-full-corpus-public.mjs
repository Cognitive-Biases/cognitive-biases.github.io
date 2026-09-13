import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const canonical = JSON.parse(await readFile("data/biases.json", "utf8"));
const published = canonical.filter((entry) => entry.published !== false && entry.slug);
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

const expectedSlugs = published.map((entry) => entry.slug).sort();
const expectedSet = new Set(expectedSlugs);
const publicDoc = JSON.parse(await readFile(join(OUT, "data", "de", "biases.json"), "utf8"));
const entries = publicDoc.entries || [];
const actualSlugs = entries.map((entry) => entry.slug).sort();
const actualSet = new Set(actualSlugs);
const failures = [];
const fail = (message) => failures.push(message);
const sameSet = (a, b) => [...a].sort().join("\u0000") === [...b].sort().join("\u0000");

if (publicDoc.locale !== "de") fail("/data/de/biases.json: expected locale=de.");
if (publicDoc.state !== "full-canonical-localization") fail("/data/de/biases.json: expected state=full-canonical-localization.");
if (!sameSet(expectedSlugs, actualSlugs)) {
  const missing = expectedSlugs.filter((slug) => !actualSet.has(slug));
  const extra = actualSlugs.filter((slug) => !expectedSet.has(slug));
  if (missing.length) fail(`Public German dataset is missing: ${missing.join(", ")}`);
  if (extra.length) fail(`Public German dataset has non-public extras: ${extra.join(", ")}`);
}
if (actualSet.size !== entries.length) fail("/data/de/biases.json contains duplicate slugs.");
if (publicDoc.coverage?.publishedCanonical !== published.length || publicDoc.coverage?.localized !== published.length) fail("Public German coverage counters do not match the prepared published corpus.");
if (publicDoc.coverage?.duplicateAliasPages !== duplicateToPrimary.size) fail("German duplicate alias counter does not match duplicate dispositions.");
if (publicDoc.coverage?.canonicalGermanEntities !== published.length - duplicateToPrimary.size) fail("German canonical entity counter is wrong.");

const allowedStates = new Set(["reviewed-evidence", "localized-with-canonical-review", "localized-legacy"]);
let reviewed = 0;
let canonicalReview = 0;
let legacy = 0;

for (const entry of entries) {
  if (!allowedStates.has(entry.localizationState)) fail(`${entry.slug}: invalid localizationState ${entry.localizationState}.`);
  if (entry.localizationState === "reviewed-evidence") reviewed += 1;
  if (entry.localizationState === "localized-with-canonical-review") canonicalReview += 1;
  if (entry.localizationState === "localized-legacy") legacy += 1;
  for (const field of ["slug", "title", "englishTitle", "summary", "canonicalUrl", "germanUrl"]) if (!String(entry[field] || "").trim()) fail(`${entry.slug || "(missing slug)"}: public ${field} is required.`);

  const primary = duplicateToPrimary.get(entry.slug) || null;
  const expectedCanonicalDe = primary ? `${SITE}/de/biases/${primary.slug}/` : `${SITE}/de/biases/${entry.slug}/`;
  const expectedCanonicalEn = primary ? `${SITE}/biases/${primary.slug}/` : `${SITE}/biases/${entry.slug}/`;
  const relative = `de/biases/${entry.slug}`;
  const file = join(OUT, relative, "index.html");
  try { await access(file); } catch { fail(`Missing full-corpus German page: /${relative}/`); continue; }
  const html = await readFile(file, "utf8");
  if (!html.includes('<html lang="de">')) fail(`/${relative}/: expected lang=de.`);
  if (!html.includes(`rel="canonical" href="${expectedCanonicalDe}"`)) fail(`/${relative}/: canonical URL is wrong.`);
  if (!html.includes(`hreflang="de" href="${expectedCanonicalDe}"`)) fail(`/${relative}/: German hreflang is wrong.`);
  if (!html.includes(`hreflang="en" href="${expectedCanonicalEn}"`)) fail(`/${relative}/: English alternate is wrong.`);
  if (!html.includes('href="/de/entscheidungen/"')) fail(`/${relative}/: German situation navigation is missing.`);
  for (const marker of ["Was passiert?", "Probier das", "Grenzen"]) if (!html.includes(marker)) fail(`/${relative}/: missing German practical marker ${marker}.`);

  if (primary) {
    if (!html.includes("Zusammengeführter Eintrag.")) fail(`/${relative}/: duplicate alias notice is missing.`);
    if (entry.isCanonical !== false || entry.primarySlug !== primary.slug || entry.canonicalGermanUrl !== expectedCanonicalDe) fail(`${entry.slug}: public duplicate metadata is wrong.`);
  } else {
    if (entry.isCanonical !== true || entry.canonicalGermanUrl !== expectedCanonicalDe) fail(`${entry.slug}: public canonical metadata is wrong.`);
  }

  if (entry.localizationState === "localized-legacy" && !html.includes("Noch kein kontrollierter Evidence Review") && !html.includes("Lokalisierung ohne kontrollierten Review")) fail(`/${relative}/: legacy localization does not disclose missing controlled review.`);
  if (entry.localizationState === "localized-with-canonical-review" && !html.includes("Kanonischer Review vorhanden")) fail(`/${relative}/: canonical-review localization does not disclose review availability.`);
  if (entry.localizationState === "reviewed-evidence" && !html.includes("Vollständiger Evidence Review")) fail(`/${relative}/: reviewed German page lost its evidence-review path.`);

  const englishSlug = primary?.slug || entry.slug;
  const englishFile = join(OUT, "biases", entry.slug, "index.html");
  try {
    const englishHtml = await readFile(englishFile, "utf8");
    if (!englishHtml.includes(`hreflang="de" href="${SITE}/de/biases/${englishSlug}/"`)) fail(`${entry.slug}: English page lacks the correct German alternate.`);
  } catch { fail(`${entry.slug}: published English page is missing.`); }
}

if (publicDoc.coverage?.reviewedGerman !== reviewed) fail("reviewedGerman coverage counter is wrong.");
if (publicDoc.coverage?.localizedWithCanonicalReview !== canonicalReview) fail("localizedWithCanonicalReview coverage counter is wrong.");
if (publicDoc.coverage?.localizedLegacy !== legacy) fail("localizedLegacy coverage counter is wrong.");
if (reviewed + canonicalReview + legacy !== published.length) fail("German localization-state counters do not sum to full published coverage.");

const indexHtml = await readFile(join(OUT, "de", "biases", "index.html"), "utf8");
if (!indexHtml.includes("Vollständiger deutscher Kanon")) fail("/de/biases/: full-corpus identity is missing.");
if (!indexHtml.includes(`Insgesamt: ${published.length}`)) fail(`/de/biases/: visible count does not match ${published.length}.`);
if (!indexHtml.includes("data-de-filter")) fail("/de/biases/: German corpus search is missing.");
if (indexHtml.includes(`hreflang="en" href="${SITE}/explore/"`)) fail("/de/biases/: collection must not claim /explore/ as an equivalent language alternate.");

const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
for (const slug of expectedSlugs) {
  const route = `<loc>${SITE}/de/biases/${slug}/</loc>`;
  if (duplicateToPrimary.has(slug)) {
    if (sitemap.includes(route)) fail(`sitemap.xml should exclude consolidated German duplicate ${slug}.`);
  } else if (!sitemap.includes(route)) fail(`sitemap.xml is missing German canonical route for ${slug}.`);
}

if (failures.length) {
  console.error("German full-corpus public check failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}
console.log(`German full-corpus public check passed: ${published.length}/${published.length} published pages, ${published.length - duplicateToPrimary.size} canonical German entities, ${duplicateToPrimary.size} consolidated alias pages; ${reviewed} reviewed German, ${canonicalReview} localized with canonical review, ${legacy} localized legacy.`);
