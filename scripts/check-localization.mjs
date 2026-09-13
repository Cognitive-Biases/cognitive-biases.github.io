import { access, readFile } from "node:fs/promises";

const TODAY = new Date().toISOString().slice(0, 10);
const errors = [];

const [profile, registry, aiLocales, pkg, exceptions] = await Promise.all([
  readJson("data/localization-profile.json"),
  readJson("data/locales.json"),
  readJson("ai/locales.json"),
  readJson("package.json"),
  readJson("data/localization-exceptions.json")
]);

expect(profile.sourceLocale === registry.canonicalLocale, "localization profile sourceLocale must equal data/locales.json canonicalLocale");
expect(profile.sourceLocale === aiLocales.canonicalLanguage, "localization profile sourceLocale must equal ai/locales.json canonicalLanguage");
expect(aiLocales.fallbackLanguage === profile.sourceLocale, "AI locale fallback must use the canonical localization source locale");
expect(profile.localeRegistry === "data/locales.json", "localization profile must point to data/locales.json");
expect(profile.publicManifest === "ai/locales.json", "localization profile must point to ai/locales.json");
expect(await exists(profile.sharedGuide), `Shared localization guide is missing: ${profile.sharedGuide}`);
expect(await exists("skills/translation-review/SKILL.md"), "Translation review skill is missing");
expect(await exists("skills/translation-review/references/prompts.md"), "Localization prompt contracts are missing");

const profileCodes = profile.locales.map((entry) => entry.code);
const registryCodes = registry.locales.map((entry) => entry.code);
const aiCodes = aiLocales.locales.map((entry) => entry.language);
expectSameSet(profileCodes, registryCodes, "localization profile locales must exactly match data/locales.json");
expectSameSet(profileCodes, aiCodes, "localization profile locales must exactly match ai/locales.json locale records");
expectSameSet(profile.aiGroups?.humanInterfaceLanguages || [], aiLocales.humanInterfaceLanguages || [], "humanInterfaceLanguages drifted between profile and AI manifest");
expectSameSet(profile.aiGroups?.agentRoutingLanguages || [], aiLocales.agentRoutingLanguages || [], "agentRoutingLanguages drifted between profile and AI manifest");
expectSameSet(profile.aiGroups?.humanReviewedLanguages || [], aiLocales.semantics?.humanReviewedLanguages || [], "humanReviewedLanguages drifted between profile and AI manifest");

for (const locale of profile.locales) {
  const registryLocale = registry.locales.find((entry) => entry.code === locale.code);
  const aiLocale = aiLocales.locales.find((entry) => entry.language === locale.code);
  expect(Boolean(registryLocale), `${locale.code}: missing data/locales.json record`);
  expect(Boolean(aiLocale), `${locale.code}: missing ai/locales.json record`);
  if (registryLocale) expect(registryLocale.role === locale.registryRole, `${locale.code}: registry role ${registryLocale.role} does not match profile ${locale.registryRole}`);
  if (aiLocale) expect(aiLocale.status === locale.aiStatus, `${locale.code}: AI status ${aiLocale.status} does not match profile ${locale.aiStatus}`);

  for (const command of locale.checkerCommands || []) {
    expect(Boolean(pkg.scripts?.[command]), `${locale.code}: checker command is not defined in package.json: ${command}`);
  }

  if (locale.guide) expect(await exists(locale.guide), `${locale.code}: localization guide is missing: ${locale.guide}`);
  if (locale.glossary) await checkGlossary(locale);

  const surfaceStates = Object.values(locale.surfaces || {});
  for (const state of surfaceStates) {
    expect(["canonical", "complete", "partial", "out-of-scope", "not-applicable"].includes(state), `${locale.code}: unsupported surface state ${state}`);
  }

  if (locale.status === "reviewed-partial") {
    expect(surfaceStates.includes("partial"), `${locale.code}: reviewed-partial locale must declare at least one partial surface`);
    expect(locale.fallback?.silentEnglishBody === false, `${locale.code}: partial locale must explicitly reject silent English body fallback`);
  }

  if (await exists("dist")) {
    for (const generatedPath of locale.generatedPaths || []) {
      expect(await exists(generatedPath), `${locale.code}: declared generated localization surface is missing after build: ${generatedPath}`);
    }
  }
}

expect(pkg.scripts?.["check:french-localization"], "package.json must keep the French localization checker");
expect(pkg.scripts?.["check:french-skills"], "package.json must keep the French Decision Skills checker");
expect(pkg.scripts?.["check:portuguese-localization"], "package.json must keep the Brazilian Portuguese checker");
expect(pkg.scripts?.["check:localization"], "package.json must expose check:localization");
expect(pkg.scripts?.["check:localization-impact"], "package.json must expose check:localization-impact");
expect(pkg.scripts?.check?.includes("check:french-localization"), "npm run check must keep check:french-localization");
expect(pkg.scripts?.check?.includes("check:french-skills"), "npm run check must keep check:french-skills");
expect(pkg.scripts?.check?.includes("check:portuguese-localization"), "npm run check must keep check:portuguese-localization");
expect(pkg.scripts?.check?.includes("check:localization"), "npm run check must include the shared localization checker");
expect(String(aiLocales.discovery?.policy || "").includes("agent-ready-web-profile/LOCALIZATION.md"), "AI locale manifest must point to the shared ARWP localization policy");

expect(Array.isArray(exceptions.exceptions), "data/localization-exceptions.json must contain an exceptions array");
const seenExceptionIds = new Set();
for (const exception of exceptions.exceptions || []) {
  for (const field of ["id", "surface", "reason", "reviewBy"]) expect(Boolean(exception[field]), `Localization exception is missing ${field}`);
  expect(Array.isArray(exception.locales) && exception.locales.length > 0, `${exception.id || "unknown exception"}: locales must be a non-empty array`);
  expect(!seenExceptionIds.has(exception.id), `Duplicate localization exception id: ${exception.id}`);
  seenExceptionIds.add(exception.id);
  expect(/^\d{4}-\d{2}-\d{2}$/.test(exception.reviewBy || ""), `${exception.id}: reviewBy must use YYYY-MM-DD`);
  expect((exception.reviewBy || "") >= TODAY, `${exception.id}: localization exception expired on ${exception.reviewBy}`);
  for (const code of exception.locales || []) expect(profileCodes.includes(code), `${exception.id}: unknown locale ${code}`);
}

expect(Array.isArray(profile.impactRules) && profile.impactRules.length > 0, "localization profile must declare impactRules");
const impactIds = new Set();
for (const rule of profile.impactRules || []) {
  expect(Boolean(rule.id) && !impactIds.has(rule.id), `Duplicate or missing localization impact rule id: ${rule.id || "<missing>"}`);
  impactIds.add(rule.id);
  expect(Array.isArray(rule.paths) && rule.paths.length > 0, `${rule.id}: impact rule must declare paths`);
  expect(Boolean(rule.surface), `${rule.id}: impact rule must declare surface`);
  expect(["exact-checkers", "review-required"].includes(rule.mode), `${rule.id}: unsupported impact mode ${rule.mode}`);
  for (const code of rule.locales || []) expect(profileCodes.includes(code), `${rule.id}: unknown impacted locale ${code}`);
}

if (errors.length) {
  console.error(`Localization governance check failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Localization governance checks passed for ${profile.locales.length} locales (${profile.aiGroups.humanInterfaceLanguages.length} human-interface, ${profile.aiGroups.agentRoutingLanguages.length} agent-routing).`);

async function checkGlossary(locale) {
  if (!await exists(locale.glossary)) {
    expect(false, `${locale.code}: glossary is missing: ${locale.glossary}`);
    return;
  }
  const glossary = await readJson(locale.glossary);
  expect(glossary.locale === locale.code, `${locale.code}: glossary locale metadata is ${glossary.locale}`);
  expect(glossary.sourceLocale === profile.sourceLocale, `${locale.code}: glossary sourceLocale must be ${profile.sourceLocale}`);
  expect(glossary.status === "reviewed", `${locale.code}: first-class glossary must be reviewed`);
  expect(Array.isArray(glossary.entries) && glossary.entries.length > 0, `${locale.code}: glossary must contain entries`);
  const ids = new Set();
  for (const entry of glossary.entries || []) {
    for (const field of ["conceptId", "source", "preferred", "context", "status"]) expect(Boolean(entry[field]), `${locale.code}: glossary entry is missing ${field}`);
    expect(!ids.has(entry.conceptId), `${locale.code}: duplicate glossary conceptId ${entry.conceptId}`);
    ids.add(entry.conceptId);
    expect(entry.status === "reviewed", `${locale.code}: glossary entry ${entry.conceptId} must be reviewed`);
    if (entry.aliases !== undefined) expect(Array.isArray(entry.aliases), `${locale.code}: ${entry.conceptId} aliases must be an array`);
    if (entry.avoid !== undefined) expect(Array.isArray(entry.avoid), `${locale.code}: ${entry.conceptId} avoid must be an array`);
  }
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    errors.push(`${path}: ${error.message}`);
    return {};
  }
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

function expect(condition, message) {
  if (!condition) errors.push(message);
}

function expectSameSet(actual, expected, message) {
  const a = [...new Set(actual)].sort();
  const b = [...new Set(expected)].sort();
  expect(JSON.stringify(a) === JSON.stringify(b), `${message}: [${a.join(", ")}] vs [${b.join(", ")}]`);
}
