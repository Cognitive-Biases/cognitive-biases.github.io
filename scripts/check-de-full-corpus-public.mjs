import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const canonical = JSON.parse(await readFile("data/biases.json", "utf8"));
const published = canonical.filter((entry) => entry.published !== false && entry.slug);
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
if (publicDoc.coverage?.publishedCanonical !== published.length || publicDoc.coverage?.localized !== published.length) fail("Public German coverage counters do not match the canonical published corpus.");

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

  const relative = `de/biases/${entry.slug}`;
  const file = join(OUT, relative, "index.html");
  try { await access(file); } catch { fail(`Missing full-corpus German page: /${relative}/`); continue; }
  const html = await readFile(file, "utf8");
  if (!html.includes('<html lang="de">')) fail(`/${relative}/: expected lang=de.`);
  if (!html.includes(`rel="canonical" href="${SITE}/${relative}/"`)) fail(`/${relative}/: self canonical is missing.`);
  if (!html.includes(`hreflang="de" href="${SITE}/${relative}/"`)) fail(`/${relative}/: German hreflang is missing.`);
  if (!html.includes(`hreflang="en" href="${SITE}/biases/${entry.slug}/"`)) fail(`/${relative}/: English alternate is missing.`);
  if (!html.includes('href="/de/entscheidungen/"')) fail(`/${relative}/: German situation navigation is missing.`);
  for (const marker of ["Was passiert?", "Probier das", "Grenzen"]) if (!html.includes(marker)) fail(`/${relative}/: missing German practical marker ${marker}.`);

  if (entry.localizationState === "localized-legacy" && !html.includes("Noch kein kontrollierter Evidence Review") && !html.includes("Lokalisierung ohne kontrollierten Review")) fail(`/${relative}/: legacy localization does not disclose missing controlled review.`);
  if (entry.localizationState === "localized-with-canonical-review" && !html.includes("Kanonischer Review vorhanden")) fail(`/${relative}/: canonical-review localization does not disclose review availability.`);
  if (entry.localizationState === "reviewed-evidence" && !html.includes("Vollständiger Evidence Review")) fail(`/${relative}/: reviewed German page lost its evidence-review path.`);

  const englishFile = join(OUT, "biases", entry.slug, "index.html");
  try {
    const englishHtml = await readFile(englishFile, "utf8");
    if (!englishHtml.includes(`hreflang="de" href="${SITE}/de/biases/${entry.slug}/"`)) fail(`${entry.slug}: English canonical page lacks reciprocal German alternate.`);
  } catch { fail(`${entry.slug}: published English canonical page is missing.`); }
}

if (publicDoc.coverage?.reviewedGerman !== reviewed) fail("reviewedGerman coverage counter is wrong.");
if (publicDoc.coverage?.localizedWithCanonicalReview !== canonicalReview) fail("localizedWithCanonicalReview coverage counter is wrong.");
if (publicDoc.coverage?.localizedLegacy !== legacy) fail("localizedLegacy coverage counter is wrong.");
if (reviewed + canonicalReview + legacy !== published.length) fail("German localization-state counters do not sum to full canonical coverage.");

const indexHtml = await readFile(join(OUT, "de", "biases", "index.html"), "utf8");
if (!indexHtml.includes("Vollständiger deutscher Kanon")) fail("/de/biases/: full-corpus identity is missing.");
if (!indexHtml.includes(`Insgesamt: ${published.length}`)) fail(`/de/biases/: visible count does not match ${published.length}.`);
if (!indexHtml.includes("data-de-filter")) fail("/de/biases/: German corpus search is missing.");
if (indexHtml.includes(`hreflang="en" href="${SITE}/explore/"`)) fail("/de/biases/: collection must not claim /explore/ as a reciprocal language equivalent.");

const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
for (const slug of expectedSlugs) if (!sitemap.includes(`<loc>${SITE}/de/biases/${slug}/</loc>`)) fail(`sitemap.xml is missing German full-corpus route for ${slug}.`);

if (failures.length) {
  console.error("German full-corpus public check failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}
console.log(`German full-corpus public check passed: ${published.length}/${published.length} canonical pages; ${reviewed} reviewed German, ${canonicalReview} localized with canonical review, ${legacy} localized legacy.`);
