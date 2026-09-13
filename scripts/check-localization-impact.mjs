import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const TODAY = new Date().toISOString().slice(0, 10);
const baseArg = process.argv.find((arg) => arg.startsWith("--base="));
const base = baseArg?.slice("--base=".length) || process.env.LOCALIZATION_BASE_REF || "";

if (!base) {
  console.log("Localization impact check skipped: no --base=<ref> or LOCALIZATION_BASE_REF was supplied.");
  process.exit(0);
}

const profile = JSON.parse(await readFile("data/localization-profile.json", "utf8"));
const exceptions = JSON.parse(await readFile(profile.exceptionsFile || "data/localization-exceptions.json", "utf8"));
let changedFiles = [];
try {
  changedFiles = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf8" })
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
} catch (error) {
  console.error(`Localization impact check could not diff ${base}...HEAD: ${error.message}`);
  process.exit(1);
}

const errors = [];
const matches = [];
const validExceptions = (exceptions.exceptions || []).filter((entry) => entry.reviewBy >= TODAY);
const governanceFiles = new Set([
  "docs/localization.md",
  "data/localization-profile.json",
  "data/localization-exceptions.json",
  "scripts/check-localization.mjs",
  "scripts/check-localization-impact.mjs"
]);
const governanceReviewed = changedFiles.some((path) => governanceFiles.has(path));

for (const rule of profile.impactRules || []) {
  const files = changedFiles.filter((file) => rule.paths.some((pattern) => matchesGlob(file, pattern)));
  if (!files.length) continue;
  matches.push({ rule, files });

  if (rule.mode === "exact-checkers") continue;

  for (const locale of rule.locales || []) {
    if (governanceReviewed || changedFiles.some((file) => isLocaleReviewFile(file, locale))) continue;
    const exception = validExceptions.find((entry) => entry.surface === rule.surface && (entry.locales || []).includes(locale));
    if (!exception) {
      errors.push(`${rule.id}: ${locale} requires localization review for ${rule.surface}; update a locale-specific surface/governance file or add a time-bounded exception`);
    }
  }
}

const highRiskUnmapped = changedFiles.filter((file) => isHighRiskCanonicalFile(file) && !matches.some(({ rule }) => rule.paths.some((pattern) => matchesGlob(file, pattern))));
for (const file of highRiskUnmapped) errors.push(`Unmapped localizable source changed: ${file}. Add it to data/localization-profile.json impactRules or document why it is non-localizable.`);

if (matches.length) {
  console.log("Localization impact map:");
  for (const { rule, files } of matches) {
    console.log(`- ${rule.id} → ${rule.surface} → ${(rule.locales || []).join(", ")} (${rule.mode})`);
    for (const file of files) console.log(`  - ${file}`);
  }
} else {
  console.log("Localization impact map: no declared localizable source changed.");
}

if (errors.length) {
  console.error(`Localization impact check failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Localization impact check passed for ${changedFiles.length} changed file(s).`);

function isLocaleReviewFile(file, locale) {
  const normalized = locale.toLowerCase();
  const tokens = normalized === "pt-br"
    ? ["pt-br", "pt_br", "portuguese"]
    : normalized === "fr"
      ? ["-fr", "/fr/", "french", "glossary-fr", "localization-fr"]
      : normalized === "de"
        ? ["/de/", "de/llms", "german"]
        : normalized === "ru"
          ? ["/ru/", "ru/llms", "russian"]
          : [normalized];
  const lower = `/${file.toLowerCase()}`;
  return tokens.some((token) => lower.includes(token));
}

function isHighRiskCanonicalFile(file) {
  if (/^data\/(?:biases|techniques)\.json$/.test(file)) return true;
  if (/^data\/skills\/.+\.json$/.test(file)) return true;
  if (/^scripts\/build-[^/]+\.mjs$/.test(file)) return true;
  if (file === "index.html" || file === "llms.txt") return true;
  if (/^assets\//.test(file)) return true;
  if (/^skills\//.test(file) && !file.startsWith("skills/translation-review/")) return true;
  if (/^ai\//.test(file)) return true;
  return false;
}

function matchesGlob(file, pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*");
  return new RegExp(`^${escaped}$`).test(file);
}
