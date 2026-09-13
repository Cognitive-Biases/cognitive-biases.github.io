import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const canonicalDoc = JSON.parse(await readFile("data/skills.json", "utf8"));
const localizedDoc = JSON.parse(await readFile("data/skills-fr.json", "utf8"));
const canonical = canonicalDoc.entries || [];
const localized = localizedDoc.entries || [];
const canonicalBySlug = new Map(canonical.map((entry) => [entry.slug, entry]));

if (localized.length !== canonical.length) throw new Error(`French decision skill coverage must equal canonical coverage: ${localized.length}/${canonical.length}.`);

const seenCanonical = new Set();
const seenLocalizedSlugs = new Set();
for (const entry of localized) {
  if (!entry.canonicalSlug || seenCanonical.has(entry.canonicalSlug)) throw new Error(`Duplicate or missing French skill canonicalSlug: ${entry.canonicalSlug || "<missing>"}`);
  seenCanonical.add(entry.canonicalSlug);
  const source = canonicalBySlug.get(entry.canonicalSlug);
  if (!source) throw new Error(`${entry.canonicalSlug}: French skill points to an unknown canonical skill.`);
  if (!entry.localizedSlug || seenLocalizedSlugs.has(entry.localizedSlug)) throw new Error(`${entry.canonicalSlug}: duplicate or missing localizedSlug.`);
  seenLocalizedSlugs.add(entry.localizedSlug);
  for (const field of ["title", "summary", "outcome", "example", "boundary"]) {
    if (!String(entry[field] || "").trim()) throw new Error(`${entry.canonicalSlug}: missing ${field}.`);
  }
  if (!Array.isArray(entry.aliases) || !entry.aliases.some((alias) => alias.toLowerCase() === source.title.toLowerCase())) throw new Error(`${entry.canonicalSlug}: aliases must include the canonical English title.`);
  if (!Array.isArray(entry.whenToUse) || entry.whenToUse.length < 3) throw new Error(`${entry.canonicalSlug}: add at least three French whenToUse items.`);
  if (!Array.isArray(entry.actions) || entry.actions.length < 3) throw new Error(`${entry.canonicalSlug}: add at least three French actions.`);
  if (entry.summary === source.summary || entry.outcome === source.outcome) throw new Error(`${entry.canonicalSlug}: French skill must not silently reuse the English body text.`);
}

for (const source of canonical) {
  if (!seenCanonical.has(source.slug)) throw new Error(`${source.slug}: missing French decision skill.`);
}

await access("dist/fr/competences/index.html");
await access("dist/fr/data/skills.json");
await access("dist/data/skills-fr.json");

const hub = await readFile("dist/fr/competences/index.html", "utf8");
if (!hub.includes('<html lang="fr">') || !includesHtmlText(hub, "Compétences de décision")) throw new Error("French decision-skill hub is missing its French language contract or heading.");
if (!hub.includes('hreflang="fr"') || !hub.includes('hreflang="en"')) throw new Error("French decision-skill hub is missing reciprocal hreflang metadata.");
if (!hub.includes("CollectionPage")) throw new Error("French decision-skill hub is missing CollectionPage structured data.");

for (const entry of localized) {
  const source = canonicalBySlug.get(entry.canonicalSlug);
  const path = join("dist", "fr", "competences", entry.localizedSlug, "index.html");
  await access(path);
  const html = await readFile(path, "utf8");
  const frenchUrl = `${SITE}/fr/competences/${entry.localizedSlug}/`;
  const englishUrl = `${SITE}/skills/${entry.canonicalSlug}/`;
  if (!html.includes('<html lang="fr">')) throw new Error(`${entry.canonicalSlug}: French skill page is not declared as French.`);
  if (!includesHtmlText(html, entry.title) || !includesHtmlText(html, source.title)) throw new Error(`${entry.canonicalSlug}: French page must expose the French title and English recognition alias.`);
  if (!html.includes(`identifier":"${entry.canonicalSlug}`) && !html.includes(`identifier\":\"${entry.canonicalSlug}`)) throw new Error(`${entry.canonicalSlug}: LearningResource does not preserve the canonical identifier.`);
  if (!html.includes("LearningResource")) throw new Error(`${entry.canonicalSlug}: French skill page is missing LearningResource structured data.`);
  if (!html.includes(frenchUrl) || !html.includes(englishUrl)) throw new Error(`${entry.canonicalSlug}: French skill page is missing canonical or English equivalent URL.`);
  if (!includesHtmlText(html, entry.example) || !includesHtmlText(html, entry.boundary)) throw new Error(`${entry.canonicalSlug}: generated page is missing example or boundary copy.`);

  const englishPath = join("dist", "skills", entry.canonicalSlug, "index.html");
  const englishHtml = await readFile(englishPath, "utf8");
  if (!englishHtml.includes(`hreflang="fr" href="${frenchUrl}"`)) throw new Error(`${entry.canonicalSlug}: English skill page is missing reciprocal French hreflang.`);
  if (!englishHtml.includes(`href="/fr/competences/${entry.localizedSlug}/"`)) throw new Error(`${entry.canonicalSlug}: English skill page is missing the French language switch.`);
}

const publicData = JSON.parse(await readFile("dist/fr/data/skills.json", "utf8"));
if (publicData.locale !== "fr" || publicData.canonicalLocale !== "en") throw new Error("French public skill data has an invalid locale contract.");
if (!Array.isArray(publicData.skills) || publicData.skills.length !== canonical.length) throw new Error("French public skill data does not match canonical decision-skill coverage.");
for (const entry of publicData.skills) {
  if (!canonicalBySlug.has(entry.canonicalSlug)) throw new Error(`French public skill data contains unknown canonical skill ${entry.canonicalSlug}.`);
  if (!entry.canonicalUrl?.endsWith(`/skills/${entry.canonicalSlug}/`) || !entry.localizedUrl?.includes("/fr/competences/")) throw new Error(`${entry.canonicalSlug}: French public skill URLs are incomplete.`);
}

const manifest = JSON.parse(await readFile("dist/fr/data/index.json", "utf8"));
if (manifest.coverage?.skills !== canonical.length || manifest.coverage?.canonicalDecisionSkills !== canonical.length) throw new Error("French locale manifest does not report complete decision-skill coverage.");
if (!String(manifest.datasets?.skills || "").endsWith("/fr/data/skills.json")) throw new Error("French locale manifest is missing the localized skill dataset.");

const sitemap = await readFile("dist/sitemap.xml", "utf8");
if (!sitemap.includes(`${SITE}/fr/competences/`)) throw new Error("Sitemap is missing the French decision-skill hub.");
for (const entry of localized) {
  if (!sitemap.includes(`${SITE}/fr/competences/${entry.localizedSlug}/`)) throw new Error(`${entry.canonicalSlug}: sitemap is missing the French decision-skill page.`);
}

for (const path of ["dist/fr/index.html", "dist/fr/explorer/index.html", "dist/fr/techniques/index.html"]) {
  const html = await readFile(path, "utf8");
  if (!html.includes('href="/fr/competences/"')) throw new Error(`${path}: French navigation or primary discovery surface does not expose the decision-skill library.`);
}

const agentRouting = await readFile("dist/fr/llms.txt", "utf8");
if (!agentRouting.includes(`${SITE}/fr/competences/`)) throw new Error("French agent routing does not expose the localized decision-skill library.");

console.log(`French decision skills OK: ${localized.length}/${canonical.length} canonical skills localized with pages, data, search discovery and reciprocal language links.`);

function includesHtmlText(html, text) {
  const escaped = String(text).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  return html.includes(escaped);
}
