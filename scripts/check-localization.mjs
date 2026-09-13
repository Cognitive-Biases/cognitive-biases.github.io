import { access, readFile } from "node:fs/promises";

const TODAY = new Date().toISOString().slice(0, 10);
const errors = [];
const [profile, registry, aiLocales, pkg, exceptions] = await Promise.all([
  readJson("data/localization-profile.json"), readJson("data/locales.json"), readJson("ai/locales.json"), readJson("package.json"), readJson("data/localization-exceptions.json")
]);

expect(profile.sourceLocale === registry.canonicalLocale, "profile sourceLocale must equal data/locales.json canonicalLocale");
expect(profile.sourceLocale === aiLocales.canonicalLanguage, "profile sourceLocale must equal ai/locales.json canonicalLanguage");
expect(aiLocales.fallbackLanguage === profile.sourceLocale, "AI locale fallback must use the canonical locale");
expect(await exists(profile.sharedGuide), `Missing shared guide: ${profile.sharedGuide}`);
expect(await exists("skills/translation-review/SKILL.md"), "Missing translation-review skill");
expect(await exists("skills/translation-review/references/prompts.md"), "Missing localization prompt contracts");

const profileCodes = profile.locales.map((x) => x.code);
expectSameSet(profileCodes, registry.locales.map((x) => x.code), "profile/data locale set drift");
expectSameSet(profileCodes, aiLocales.locales.map((x) => x.language), "profile/AI locale set drift");
expectSameSet(profile.aiGroups.humanInterfaceLanguages, aiLocales.humanInterfaceLanguages, "humanInterfaceLanguages drift");
expectSameSet(profile.aiGroups.agentRoutingLanguages, aiLocales.agentRoutingLanguages, "agentRoutingLanguages drift");
expectSameSet(profile.aiGroups.humanReviewedLanguages, aiLocales.semantics?.humanReviewedLanguages || [], "humanReviewedLanguages drift");

for (const locale of profile.locales) {
  const registryLocale = registry.locales.find((x) => x.code === locale.code);
  const aiLocale = aiLocales.locales.find((x) => x.language === locale.code);
  expect(registryLocale?.role === locale.registryRole, `${locale.code}: registry role mismatch`);
  expect(aiLocale?.status === locale.aiStatus, `${locale.code}: AI status mismatch (${aiLocale?.status} vs ${locale.aiStatus})`);
  for (const command of locale.checkerCommands || []) expect(Boolean(pkg.scripts?.[command]), `${locale.code}: missing checker command ${command}`);
  if (locale.guide) expect(await exists(locale.guide), `${locale.code}: missing guide ${locale.guide}`);
  for (const guide of locale.additionalGuides || []) expect(await exists(guide), `${locale.code}: missing additional guide ${guide}`);
  if (locale.glossary) await checkGlossary(locale);

  const states = Object.values(locale.surfaces || {});
  for (const state of states) expect(["canonical", "complete", "partial", "draft", "out-of-scope", "not-applicable"].includes(state), `${locale.code}: unsupported surface state ${state}`);
  if (locale.status.includes("partial")) {
    expect(states.includes("partial"), `${locale.code}: partial locale must declare a partial surface`);
    expect(locale.fallback?.silentEnglishBody === false, `${locale.code}: partial locale must reject silent English body fallback`);
  }

  if (await exists("dist")) for (const path of locale.generatedPaths || []) expect(await exists(path), `${locale.code}: missing generated surface ${path}`);
}

for (const command of ["check:de", "check:french-localization", "check:french-skills", "check:portuguese-localization", "check:localization", "check:localization-impact"]) {
  expect(Boolean(pkg.scripts?.[command]), `package.json must expose ${command}`);
}
for (const command of ["check:de", "check:french-localization", "check:french-skills", "check:portuguese-localization", "check:localization"]) {
  expect(pkg.scripts?.check?.includes(command), `npm run check must include ${command}`);
}
expect(String(aiLocales.discovery?.policy || "").includes("agent-ready-web-profile/LOCALIZATION.md"), "AI locale manifest must retain the ARWP localization policy link");

expect(Array.isArray(exceptions.exceptions), "localization exceptions must be an array");
const exceptionIds = new Set();
for (const item of exceptions.exceptions || []) {
  for (const field of ["id", "surface", "reason", "reviewBy"]) expect(Boolean(item[field]), `exception missing ${field}`);
  expect(Array.isArray(item.locales) && item.locales.length > 0, `${item.id}: locales must be non-empty`);
  expect(!exceptionIds.has(item.id), `duplicate exception id ${item.id}`); exceptionIds.add(item.id);
  expect(/^\d{4}-\d{2}-\d{2}$/.test(item.reviewBy || ""), `${item.id}: reviewBy must use YYYY-MM-DD`);
  expect((item.reviewBy || "") >= TODAY, `${item.id}: exception expired on ${item.reviewBy}`);
  for (const code of item.locales || []) expect(profileCodes.includes(code), `${item.id}: unknown locale ${code}`);
}

const impactIds = new Set();
for (const rule of profile.impactRules || []) {
  expect(rule.id && !impactIds.has(rule.id), `duplicate/missing impact rule id ${rule.id || "<missing>"}`); impactIds.add(rule.id);
  expect(Array.isArray(rule.paths) && rule.paths.length, `${rule.id}: paths required`);
  expect(rule.surface, `${rule.id}: surface required`);
  expect(["exact-checkers", "review-required"].includes(rule.mode), `${rule.id}: unsupported mode ${rule.mode}`);
  for (const code of rule.locales || []) expect(profileCodes.includes(code), `${rule.id}: unknown locale ${code}`);
}

if (errors.length) {
  console.error(`Localization governance check failed with ${errors.length} issue(s):`);
  for (const message of errors) console.error(`- ${message}`);
  process.exit(1);
}
console.log(`Localization governance passed: ${profile.aiGroups.humanInterfaceLanguages.length} human-interface locales, ${profile.aiGroups.agentRoutingLanguages.length} agent-routing locales.`);

async function checkGlossary(locale) {
  if (!await exists(locale.glossary)) { expect(false, `${locale.code}: missing glossary ${locale.glossary}`); return; }
  const glossary = await readJson(locale.glossary);
  expect(glossary.locale === locale.code, `${locale.code}: glossary locale mismatch`);
  if (locale.glossaryFormat === "de-terms-v1") {
    expect(glossary.state === "reviewed", "de: glossary state must be reviewed");
    expect(Array.isArray(glossary.terms) && glossary.terms.length, "de: glossary terms required");
    const ids = new Set();
    for (const term of glossary.terms || []) {
      for (const field of ["id", "de", "en", "usage", "caution"]) expect(Boolean(term[field]), `de glossary term missing ${field}`);
      expect(!ids.has(term.id), `de glossary duplicate id ${term.id}`); ids.add(term.id);
    }
    return;
  }
  expect(glossary.sourceLocale === profile.sourceLocale, `${locale.code}: glossary sourceLocale mismatch`);
  expect(glossary.status === "reviewed", `${locale.code}: glossary status must be reviewed`);
  expect(Array.isArray(glossary.entries) && glossary.entries.length, `${locale.code}: glossary entries required`);
  const ids = new Set();
  for (const entry of glossary.entries || []) {
    for (const field of ["conceptId", "source", "preferred", "context", "status"]) expect(Boolean(entry[field]), `${locale.code}: glossary entry missing ${field}`);
    expect(!ids.has(entry.conceptId), `${locale.code}: duplicate glossary conceptId ${entry.conceptId}`); ids.add(entry.conceptId);
    expect(entry.status === "reviewed", `${locale.code}: ${entry.conceptId} must be reviewed`);
  }
}

async function readJson(path) { try { return JSON.parse(await readFile(path, "utf8")); } catch (error) { errors.push(`${path}: ${error.message}`); return {}; } }
async function exists(path) { try { await access(path); return true; } catch { return false; } }
function expect(ok, message) { if (!ok) errors.push(message); }
function expectSameSet(a, b, message) { const x=[...new Set(a||[])].sort(), y=[...new Set(b||[])].sort(); expect(JSON.stringify(x)===JSON.stringify(y), `${message}: [${x.join(", ")}] vs [${y.join(", ")}]`); }
