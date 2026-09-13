import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const canonical = JSON.parse(await readFile("data/biases.json", "utf8"));
const published = canonical.filter((entry) => entry.published === true && entry.status !== "merged-duplicate");
const expected = new Set(published.map((entry) => entry.slug));
const doc = JSON.parse(await readFile(join(OUT,"data","de","biases.json"),"utf8"));
const entries = doc.entries || [];
const actual = new Set(entries.map((entry) => entry.slug));
const failures = [];
const fail = (message) => failures.push(message);

if (entries.length !== published.length) fail(`Expected ${published.length} public German canonical entries, found ${entries.length}.`);
for (const slug of expected) if (!actual.has(slug)) fail(`Public German data missing canonical slug ${slug}.`);
for (const slug of actual) if (!expected.has(slug)) fail(`Public German data contains non-canonical slug ${slug}.`);
if (new Set(entries.map((entry)=>entry.slug)).size !== entries.length) fail("Public German data contains duplicate slugs.");
if (doc.canonicalPublishedCount !== published.length) fail("Public German catalog count metadata is stale.");

const index = await readFile(join(OUT,"de","biases","index.html"),"utf8");
if (!index.includes(`Insgesamt: ${published.length}`)) fail("German collection does not expose the full canonical count.");
if (!index.includes("Vollständiger deutscher Katalog")) fail("German collection is missing full-catalog positioning.");
if (!index.includes("Redaktionell lokalisiert") || !index.includes("Evidence-reviewed")) fail("German collection must explain both quality states.");

let editorial = 0;
let reviewed = 0;
let canonicalReviewEditorial = 0;
for (const entry of entries) {
  const relative = join("de","biases",entry.slug,"index.html");
  try { await access(join(OUT,relative)); } catch { fail(`Missing German page /de/biases/${entry.slug}/`); continue; }
  const html = await readFile(join(OUT,relative),"utf8");
  if (!html.includes('<html lang="de">')) fail(`${entry.slug}: lang=de missing.`);
  if (!html.includes(`rel="canonical" href="${SITE}/de/biases/${entry.slug}/"`)) fail(`${entry.slug}: self canonical missing.`);
  if (!html.includes(`hreflang="en" href="${SITE}/biases/${entry.slug}/"`)) fail(`${entry.slug}: English alternate missing.`);
  if (!html.includes(`hreflang="de" href="${SITE}/de/biases/${entry.slug}/"`)) fail(`${entry.slug}: German alternate missing.`);
  if (!html.includes('aria-label="Hauptnavigation"')) fail(`${entry.slug}: German navigation missing.`);
  if (!html.includes("Was passiert?") || !html.includes("Probier das")) fail(`${entry.slug}: practical German structure missing.`);
  if (entry.localizationState === "evidence-reviewed") {
    reviewed += 1;
  } else if (entry.localizationState === "editorial-localization") {
    editorial += 1;
    if (!html.includes("Evidenzgrenze")) fail(`${entry.slug}: editorial evidence boundary missing.`);
    if (entry.canonicalEvidenceReviewAvailable) {
      canonicalReviewEditorial += 1;
      if (!html.includes("Kanonischer Evidence Review vorhanden")) fail(`${entry.slug}: canonical review provenance missing.`);
    } else if (!html.includes("wissenschaftlicher Status unverändert")) {
      fail(`${entry.slug}: legacy editorial status boundary missing.`);
    }
  } else fail(`${entry.slug}: unknown localization state ${entry.localizationState}.`);

  const english = await readFile(join(OUT,"biases",entry.slug,"index.html"),"utf8");
  if (!english.includes(`hreflang="de" href="${SITE}/de/biases/${entry.slug}/"`)) fail(`${entry.slug}: reciprocal English->German alternate missing.`);
}

const confirm = await readFile(join(OUT,"de","biases","cognitive-bias-confirmation-bias","index.html"),"utf8");
if (!confirm.includes("Geprüfte Quellen") || !confirm.includes("Denkwerkzeuge")) fail("Deep reviewed Confirmation Bias page was overwritten by the catalog expansion.");

const sitemap = await readFile(join(OUT,"sitemap.xml"),"utf8");
for (const slug of expected) if (!sitemap.includes(`<loc>${SITE}/de/biases/${slug}/</loc>`)) fail(`sitemap missing German ${slug}.`);

if (failures.length) {
  console.error("German full-catalog public check failed:\n" + failures.map((f)=>`- ${f}`).join("\n"));
  process.exit(1);
}
console.log(`German full-catalog public check passed: ${entries.length}/${published.length} canonical pages; ${reviewed} reviewed-layer pages preserved; ${editorial} editorial localizations; ${canonicalReviewEditorial} editorial pages linked to canonical Evidence Reviews.`);
await import("./check-de-skill-library.mjs");
