import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const TODAY = new Date().toISOString().slice(0, 10);
const base = process.argv.find((x) => x.startsWith("--base="))?.slice(7) || process.env.LOCALIZATION_BASE_REF || "";
if (!base) {
  console.log("Localization impact check skipped: supply --base=<ref> in pull-request CI.");
  process.exit(0);
}

const profile = JSON.parse(await readFile("data/localization-profile.json", "utf8"));
const exceptions = JSON.parse(await readFile(profile.exceptionsFile || "data/localization-exceptions.json", "utf8"));
let changed = [];
try {
  changed = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf8" }).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
} catch (error) {
  console.error(`Cannot diff ${base}...HEAD: ${error.message}`);
  process.exit(1);
}

const errors = [];
const mappings = [];
const governance = new Set(["docs/localization.md", "data/localization-profile.json", "data/localization-exceptions.json", "scripts/check-localization.mjs", "scripts/check-localization-impact.mjs"]);
const governanceReviewed = changed.some((file) => governance.has(file));
const validExceptions = (exceptions.exceptions || []).filter((x) => x.reviewBy >= TODAY);

for (const rule of profile.impactRules || []) {
  const raw = changed.filter((file) => rule.paths.some((pattern) => matchesGlob(file, pattern)));
  const files = raw.filter((file) => !isLocaleSpecificSource(file));
  if (!files.length) continue;
  mappings.push({ rule, files });
  if (rule.mode === "exact-checkers") continue;
  for (const locale of rule.locales || []) {
    if (governanceReviewed || changed.some((file) => isLocaleReviewFile(file, locale))) continue;
    const exception = validExceptions.find((x) => x.surface === rule.surface && (x.locales || []).includes(locale));
    if (!exception) errors.push(`${rule.id}: ${locale} requires review for ${rule.surface}; update that locale/governance or add a time-bounded exception`);
  }
}

const unmapped = changed.filter((file) => isHighRiskCanonicalFile(file) && !isLocaleSpecificSource(file) && !mappings.some(({ rule }) => rule.paths.some((pattern) => matchesGlob(file, pattern))));
for (const file of unmapped) errors.push(`Unmapped localizable source changed: ${file}. Add an impact rule or document an explicit exception.`);

if (mappings.length) {
  console.log("Localization impact map:");
  for (const { rule, files } of mappings) console.log(`- ${rule.id} → ${rule.surface} → ${(rule.locales || []).join(", ")} (${rule.mode}): ${files.join(", ")}`);
} else console.log("Localization impact map: no canonical localizable source changed.");

if (errors.length) {
  console.error(`Localization impact check failed with ${errors.length} issue(s):`);
  for (const message of errors) console.error(`- ${message}`);
  process.exit(1);
}
console.log(`Localization impact check passed for ${changed.length} changed file(s).`);

function isLocaleSpecificSource(file) {
  return /^data\/(?:de|ru)\//.test(file) || /(?:-fr|pt-br|french|portuguese|german|russian|\/(?:de|ru|fr|pt-br)\/)/i.test(file) || /^docs\/(?:GERMAN|RUSSIAN)_LOCALIZATION\.md$/.test(file) || /^docs\/localization-(?:fr|pt-br)\.md$/.test(file);
}
function isLocaleReviewFile(file, locale) {
  const lower = `/${file.toLowerCase()}`;
  const tokens = locale === "pt-BR" ? ["pt-br", "portuguese"] : locale === "fr" ? ["-fr", "/fr/", "french", "glossary-fr", "localization-fr"] : locale === "de" ? ["/de/", "german", "check-de", "generate-de", "finalize-de"] : locale === "ru" ? ["/ru/", "russian", "check-ru", "generate-ru", "finalize-ru"] : [locale.toLowerCase()];
  return tokens.some((token) => lower.includes(token));
}
function isHighRiskCanonicalFile(file) {
  return /^data\/(?:biases|techniques|agent-skills|everyday-guides)\.json$/.test(file) || /^data\/skills\/.+\.json$/.test(file) || file === "index.html" || file === "llms.txt" || /^assets\//.test(file) || /^ai\//.test(file) || (/^skills\//.test(file) && !file.startsWith("skills/translation-review/")) || /^scripts\/(?:build|generate|enhance|apply|finalize)-.+\.mjs$/.test(file);
}
function matchesGlob(file, pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*");
  return new RegExp(`^${escaped}$`).test(file);
}
