import { access, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const contract = await readJson("data/localization-contract.json");
const aiLocales = await readJson("ai/locales.json");
const exceptions = await readJson(contract.impactRules.exceptionFile);

if (contract.canonicalLocale !== aiLocales.canonicalLanguage) {
  throw new Error(`Localization contract canonical locale ${contract.canonicalLocale} disagrees with ai/locales.json ${aiLocales.canonicalLanguage}.`);
}
if (contract.policy !== aiLocales.discovery?.policy) {
  throw new Error("Localization policy URL must match ai/locales.json discovery.policy.");
}

const fullCodes = contract.fullHumanLocales.map((locale) => locale.code);
const manifestHuman = aiLocales.humanInterfaceLanguages || [];
const glossaries = [];
for (const locale of contract.fullHumanLocales) {
  const { code } = locale;
  if (!manifestHuman.includes(code)) throw new Error(`${code}: full human locale missing from ai/locales.json humanInterfaceLanguages.`);
  const record = aiLocales.locales?.find((entry) => entry.language === code);
  if (!record) throw new Error(`${code}: locale record missing from ai/locales.json.`);

  for (const script of [...locale.generatorScripts, ...locale.checkScripts]) await access(script);

  if (contract.glossaryPolicy?.requiredForHumanLocales) {
    if (!locale.glossary) throw new Error(`${code}: full human locale must declare a versioned glossary.`);
    const glossary = await readJson(locale.glossary);
    validateGlossary(locale, glossary);
    glossaries.push({ code, glossary });
  }

  if (locale.freshnessStrategy === "canonical-release-version") {
    const checkSources = await Promise.all(locale.checkScripts.map((path) => readFile(path, "utf8")));
    if (!checkSources.some((source) => source.includes("sourceRelease"))) {
      throw new Error(`${code}: canonical-release-version freshness strategy requires a checker that validates sourceRelease.`);
    }
  }
}

if (contract.glossaryPolicy?.stableIdsMustMatch && glossaries.length > 1) validateGlossaryParity(glossaries);

for (const locale of contract.limitedLocales || []) {
  const record = aiLocales.locales?.find((entry) => entry.language === locale.code);
  if (!record || record.status !== locale.role) {
    throw new Error(`${locale.code}: limited locale role must match ai/locales.json (${locale.role}).`);
  }
}

validateExceptions(exceptions.exceptions || []);

const changedFiles = getChangedFiles();
if (changedFiles.length) enforceLocalizationImpact(changedFiles);

console.log(`Localization governance OK: ${fullCodes.length} human locales, ${glossaries.length} versioned glossaries, ${(contract.limitedLocales || []).length} limited locales${changedFiles.length ? `, ${changedFiles.length} changed files inspected` : ""}.`);

function validateGlossary(locale, glossary) {
  if (glossary.locale !== locale.code || glossary.canonicalLocale !== contract.canonicalLocale) {
    throw new Error(`${locale.code}: glossary locale contract is invalid.`);
  }
  if (!glossary.version || !glossary.status) throw new Error(`${locale.code}: glossary requires version and status.`);
  const terms = glossary.terms || [];
  const minimum = contract.glossaryPolicy?.minimumBaselineTerms || 1;
  if (terms.length < minimum) throw new Error(`${locale.code}: glossary baseline needs at least ${minimum} reviewed concepts.`);
  const ids = new Set();
  for (const term of terms) {
    if (!term.id || ids.has(term.id)) throw new Error(`${locale.code}: glossary term IDs must be unique and non-empty.`);
    ids.add(term.id);
    if (!String(term.source || "").trim() || !String(term.preferred || "").trim()) {
      throw new Error(`${locale.code}/${term.id}: glossary requires source and preferred terms.`);
    }
    if (term.source === term.preferred) throw new Error(`${locale.code}/${term.id}: preferred term must not silently equal canonical English.`);
  }
}

function validateGlossaryParity(items) {
  const expected = [...new Set((items[0].glossary.terms || []).map((term) => term.id))].sort();
  for (const { code, glossary } of items.slice(1)) {
    const actual = [...new Set((glossary.terms || []).map((term) => term.id))].sort();
    if (actual.join("\n") !== expected.join("\n")) {
      throw new Error(`${code}: glossary stable concept IDs drifted from the shared baseline.`);
    }
  }
}

function validateExceptions(items) {
  const seen = new Set();
  const today = new Date().toISOString().slice(0, 10);
  for (const item of items) {
    if (!item.id || seen.has(item.id)) throw new Error("Localization exceptions require unique non-empty ids.");
    seen.add(item.id);
    if (!item.reason || !Array.isArray(item.locales) || !item.locales.length || !item.expiresOn) {
      throw new Error(`${item.id}: exception requires reason, locales and expiresOn.`);
    }
    if (item.expiresOn < today) throw new Error(`${item.id}: localization exception expired on ${item.expiresOn}.`);
    for (const code of item.locales) {
      if (!contract.fullHumanLocales.some((entry) => entry.code === code)) {
        throw new Error(`${item.id}: unknown full-human locale ${code}.`);
      }
    }
  }
}

function getChangedFiles() {
  const explicitBase = process.env.LOCALIZATION_BASE_REF;
  const githubBase = process.env.GITHUB_BASE_REF;
  const base = explicitBase || (githubBase ? `origin/${githubBase}` : null);
  if (!base) return [];
  try {
    return execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf8" })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    throw new Error(`Unable to inspect localization impact against ${base}: ${error.message}`);
  }
}

function enforceLocalizationImpact(changedFiles) {
  const watched = changedFiles.filter(isWatchedCanonicalChange);
  if (!watched.length) return;

  const governanceFiles = new Set([
    "data/localization-contract.json",
    "data/localization-exceptions.json",
    "scripts/check-localization-governance.mjs",
    "skills/translation-review/SKILL.md",
    "ai/locales.json"
  ]);
  const substantive = watched.filter((path) => !governanceFiles.has(path));
  if (!substantive.length) return;

  const activeExceptions = exceptions.exceptions || [];
  const missingLocales = [];
  for (const locale of contract.fullHumanLocales) {
    if (hasLocaleSignal(changedFiles, locale.code)) continue;
    if (isExcepted(activeExceptions, locale.code, substantive)) continue;
    missingLocales.push(locale.code);
  }

  if (missingLocales.length) {
    throw new Error(
      `Localization impact gate: canonical/localizable surfaces changed (${substantive.join(", ")}) but no locale update or active exception was found for: ${missingLocales.join(", ")}. ` +
      `Update the affected locale generator/data/checker or add a time-bounded entry to ${contract.impactRules.exceptionFile}.`
    );
  }
}

function isWatchedCanonicalChange(path) {
  if (isLocaleOwnedChange(path)) return false;
  return (contract.impactRules.watchedCanonicalPrefixes || []).some((prefix) => path === prefix || path.startsWith(prefix));
}

function isLocaleOwnedChange(path) {
  const lower = path.toLowerCase();
  return Object.values(contract.impactRules.localeSignals || {})
    .flat()
    .some((signal) => lower.includes(String(signal).toLowerCase()));
}

function hasLocaleSignal(paths, code) {
  const signals = contract.impactRules.localeSignals?.[code] || [];
  return paths.some((path) => signals.some((signal) => path.toLowerCase().includes(signal.toLowerCase())));
}

function isExcepted(items, code, changed) {
  return items.some((item) => {
    if (!item.locales?.includes(code)) return false;
    if (!item.paths || !item.paths.length) return true;
    return changed.every((path) => item.paths.some((prefix) => path === prefix || path.startsWith(prefix)));
  });
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
