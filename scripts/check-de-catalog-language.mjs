import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const canonical = JSON.parse(await readFile("data/biases.json", "utf8"));
const published = canonical.filter((entry) => entry.published === true && entry.status !== "merged-duplicate");
const canonicalBySlug = new Map(published.map((entry) => [entry.slug, entry]));
const names = (await readdir("data/de")).filter((name) => name === "biases.json" || /^biases-reviewed-expansion-\d+\.json$/i.test(name) || /^biases-catalog-\d+\.json$/i.test(name)).sort();
const docs = await Promise.all(names.map(async (name) => ({name,doc:JSON.parse(await readFile(join("data/de",name),"utf8"))})));
const entries = docs.flatMap(({name,doc}) => (doc.entries || []).map((entry)=>({...entry,_source:name})));
const failures = [];
const fail = (message) => failures.push(message);
const forbidden = ["Where’s the trap", "Where's the trap", "How to avoid it", "Think critically", "Stay flexible", "Learning outcome"];
const likelyGerman = /\b(der|die|das|den|dem|des|und|oder|nicht|wenn|dass|eine|einen|einer|ist|sind|kann|können|wird|werden|bei|mit|für|von|zu|auf|als)\b/i;

const seen = new Set();
for (const entry of entries) {
  if (seen.has(entry.slug)) { fail(`${entry.slug}: duplicate German source entry.`); continue; }
  seen.add(entry.slug);
  if (!canonicalBySlug.has(entry.slug) && entry.slug !== "cognitive-bias-mere-urgency-effect") continue;
  const text = [entry.title,entry.summary,entry.trap,...(entry.actions || [])].join(" ");
  if (!entry.title || entry.title.trim().length < 3) fail(`${entry.slug}: German title too short/missing.`);
  if (!entry.summary || entry.summary.trim().length < 70) fail(`${entry.slug}: summary is too thin for a useful German explanation.`);
  if (!entry.trap || entry.trap.trim().length < 35) fail(`${entry.slug}: trap explanation is too thin.`);
  if (!Array.isArray(entry.actions) || entry.actions.length < 3) fail(`${entry.slug}: fewer than three concrete checks.`);
  else if (entry.actions.some((action)=>String(action).trim().length < 25)) fail(`${entry.slug}: at least one action is too vague/short.`);
  if (!likelyGerman.test([entry.summary,entry.trap,...(entry.actions || [])].join(" "))) fail(`${entry.slug}: prose does not look like German.`);
  for (const phrase of forbidden) if (text.includes(phrase)) fail(`${entry.slug}: untranslated legacy phrase “${phrase}”.`);
  if (/\b(always|never|everyone|obviously|guarantees?|proves?)\b/i.test(text) && !/nicht|kein|keine|keinen/i.test(text)) fail(`${entry.slug}: inspect overly absolute English wording.`);
}

for (const entry of published) if (!seen.has(entry.slug)) fail(`${entry.slug}: published canonical concept has no German source entry.`);

if (failures.length) {
  console.error("German catalog language check failed:\n" + failures.map((item)=>`- ${item}`).join("\n"));
  process.exit(1);
}
console.log(`German catalog language check passed for ${published.length} canonical published concepts plus allowed supplemental entries.`);
