import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const canonicalDoc = JSON.parse(await readFile("data/skills.json", "utf8"));
const localizedDoc = JSON.parse(await readFile("data/skills-es.json", "utf8"));
const frenchDoc = JSON.parse(await readFile("data/skills-fr.json", "utf8"));
const canonical = canonicalDoc.entries || [];
const localized = localizedDoc.entries || [];
const canonicalBySlug = new Map(canonical.map((entry) => [entry.slug, entry]));
const frenchByCanonical = new Map((frenchDoc.entries || []).map((entry) => [entry.canonicalSlug, entry]));

if (localized.length !== canonical.length) throw new Error(`Spanish decision skill coverage must equal canonical coverage: ${localized.length}/${canonical.length}.`);

const seenCanonical = new Set();
const seenLocalizedSlugs = new Set();
for (const entry of localized) {
  if (!entry.canonicalSlug || seenCanonical.has(entry.canonicalSlug)) throw new Error(`Duplicate or missing Spanish skill canonicalSlug: ${entry.canonicalSlug || "<missing>"}`);
  seenCanonical.add(entry.canonicalSlug);
  const source = canonicalBySlug.get(entry.canonicalSlug);
  if (!source) throw new Error(`${entry.canonicalSlug}: Spanish skill points to an unknown canonical skill.`);
  if (!entry.localizedSlug || seenLocalizedSlugs.has(entry.localizedSlug)) throw new Error(`${entry.canonicalSlug}: duplicate or missing localizedSlug.`);
  seenLocalizedSlugs.add(entry.localizedSlug);
  for (const field of ["title", "summary", "outcome", "example", "boundary"]) if (!String(entry[field] || "").trim()) throw new Error(`${entry.canonicalSlug}: missing ${field}.`);
  if (!Array.isArray(entry.aliases) || !entry.aliases.some((alias) => alias.toLowerCase() === source.title.toLowerCase())) throw new Error(`${entry.canonicalSlug}: aliases must include the canonical English title.`);
  if (!Array.isArray(entry.whenToUse) || entry.whenToUse.length < 3) throw new Error(`${entry.canonicalSlug}: add at least three Spanish whenToUse items.`);
  if (!Array.isArray(entry.actions) || entry.actions.length < 3) throw new Error(`${entry.canonicalSlug}: add at least three Spanish actions.`);
  if (entry.summary === source.summary || entry.outcome === source.outcome) throw new Error(`${entry.canonicalSlug}: Spanish skill must not silently reuse English body text.`);
  if (!frenchByCanonical.has(entry.canonicalSlug)) throw new Error(`${entry.canonicalSlug}: missing French skill equivalent for hreflang.`);
}
for (const source of canonical) if (!seenCanonical.has(source.slug)) throw new Error(`${source.slug}: missing Spanish decision skill.`);

await access("dist/es/habilidades/index.html");
await access("dist/es/data/skills.json");
await access("dist/data/skills-es.json");
const hub = await readFile("dist/es/habilidades/index.html", "utf8");
if (!hub.includes('<html lang="es">') || !includesHtmlText(hub, "Habilidades de decisión")) throw new Error("Spanish decision-skill hub is missing its Spanish language contract or heading.");
if (!hub.includes('hreflang="es"') || !hub.includes('hreflang="en"') || !hub.includes('hreflang="fr"')) throw new Error("Spanish decision-skill hub is missing multilingual hreflang metadata.");
if (!hub.includes("CollectionPage")) throw new Error("Spanish decision-skill hub is missing CollectionPage structured data.");

for (const entry of localized) {
  const source = canonicalBySlug.get(entry.canonicalSlug);
  const french = frenchByCanonical.get(entry.canonicalSlug);
  const path = join("dist", "es", "habilidades", entry.localizedSlug, "index.html");
  await access(path);
  const html = await readFile(path, "utf8");
  const spanishUrl = `${SITE}/es/habilidades/${entry.localizedSlug}/`;
  const englishUrl = `${SITE}/skills/${entry.canonicalSlug}/`;
  const frenchUrl = `${SITE}/fr/competences/${french.localizedSlug}/`;
  if (!html.includes('<html lang="es">')) throw new Error(`${entry.canonicalSlug}: Spanish skill page is not declared as Spanish.`);
  if (!includesHtmlText(html, entry.title) || !includesHtmlText(html, source.title)) throw new Error(`${entry.canonicalSlug}: Spanish page must expose the Spanish title and English recognition alias.`);
  if (!html.includes(`identifier":"${entry.canonicalSlug}`) && !html.includes(`identifier\":\"${entry.canonicalSlug}`)) throw new Error(`${entry.canonicalSlug}: LearningResource does not preserve the canonical identifier.`);
  if (!html.includes("LearningResource")) throw new Error(`${entry.canonicalSlug}: Spanish skill page is missing LearningResource structured data.`);
  for (const value of [spanishUrl, englishUrl, frenchUrl]) if (!html.includes(value)) throw new Error(`${entry.canonicalSlug}: Spanish skill page is missing a locale-equivalent URL.`);
  if (!includesHtmlText(html, entry.example) || !includesHtmlText(html, entry.boundary)) throw new Error(`${entry.canonicalSlug}: generated page is missing example or boundary copy.`);

  const englishHtml = await readFile(join("dist", "skills", entry.canonicalSlug, "index.html"), "utf8");
  if (!englishHtml.includes(`hreflang="es" href="${spanishUrl}"`) || !englishHtml.includes(`href="/es/habilidades/${entry.localizedSlug}/"`)) throw new Error(`${entry.canonicalSlug}: English skill page is missing reciprocal Spanish discovery.`);
  const frenchHtml = await readFile(join("dist", "fr", "competences", french.localizedSlug, "index.html"), "utf8");
  if (!frenchHtml.includes(`hreflang="es" href="${spanishUrl}"`) || !frenchHtml.includes(`href="/es/habilidades/${entry.localizedSlug}/"`)) throw new Error(`${entry.canonicalSlug}: French skill page is missing reciprocal Spanish discovery.`);
}

const publicData = JSON.parse(await readFile("dist/es/data/skills.json", "utf8"));
if (publicData.locale !== "es" || publicData.canonicalLocale !== "en") throw new Error("Spanish public skill data has an invalid locale contract.");
if (!Array.isArray(publicData.skills) || publicData.skills.length !== canonical.length) throw new Error("Spanish public skill data does not match canonical decision-skill coverage.");
for (const entry of publicData.skills) {
  if (!canonicalBySlug.has(entry.canonicalSlug)) throw new Error(`Spanish public skill data contains unknown canonical skill ${entry.canonicalSlug}.`);
  if (!entry.canonicalUrl?.endsWith(`/skills/${entry.canonicalSlug}/`) || !entry.localizedUrl?.includes("/es/habilidades/") || !entry.frenchUrl?.includes("/fr/competences/")) throw new Error(`${entry.canonicalSlug}: Spanish public skill URLs are incomplete.`);
}

const manifest = JSON.parse(await readFile("dist/es/data/index.json", "utf8"));
if (manifest.coverage?.skills !== canonical.length || manifest.coverage?.canonicalDecisionSkills !== canonical.length) throw new Error("Spanish locale manifest does not report complete decision-skill coverage.");
if (!String(manifest.datasets?.skills || "").endsWith("/es/data/skills.json")) throw new Error("Spanish locale manifest is missing the localized skill dataset.");

const sitemap = await readFile("dist/sitemap.xml", "utf8");
if (!sitemap.includes(`${SITE}/es/habilidades/`)) throw new Error("Sitemap is missing the Spanish decision-skill hub.");
for (const entry of localized) if (!sitemap.includes(`${SITE}/es/habilidades/${entry.localizedSlug}/`)) throw new Error(`${entry.canonicalSlug}: sitemap is missing the Spanish decision-skill page.`);

for (const path of ["dist/es/index.html", "dist/es/explorar/index.html", "dist/es/tecnicas/index.html"]) {
  const html = await readFile(path, "utf8");
  if (!html.includes('href="/es/habilidades/"')) throw new Error(`${path}: Spanish navigation or primary discovery surface does not expose the decision-skill library.`);
}
const agentRouting = await readFile("dist/es/llms.txt", "utf8");
if (!agentRouting.includes(`${SITE}/es/habilidades/`) || !agentRouting.includes("Para detectar posibles sesgos")) throw new Error("Spanish agent routing does not expose practical decision-skill and bias-detection guidance.");

console.log(`Spanish decision skills OK: ${localized.length}/${canonical.length} canonical skills localized with pages, data, search discovery and reciprocal en/fr/es links.`);

function includesHtmlText(html, text) {
  const escaped = String(text).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  return html.includes(escaped);
}
