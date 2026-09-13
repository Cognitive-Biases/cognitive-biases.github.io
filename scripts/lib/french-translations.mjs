import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export async function loadFrenchTranslations({ canonicalBiases, releaseVersion, today }) {
  const names = (await readdir("data"))
    .filter((name) => /^translations-fr(?:-catalog-[a-z0-9-]+)?\.json$/i.test(name))
    .sort((a, b) => a === "translations-fr.json" ? -1 : b === "translations-fr.json" ? 1 : a.localeCompare(b));

  const canonicalBySlug = new Map(canonicalBiases.filter((entry) => entry.published).map((entry) => [entry.slug, entry]));
  const rawEntries = [];
  for (const name of names) {
    const document = JSON.parse(await readFile(join("data", name), "utf8"));
    for (const entry of document.entries || []) rawEntries.push({ ...entry, _sourceFile: name });
  }

  const seen = new Set();
  const entries = rawEntries.map((entry) => {
    if (seen.has(entry.canonicalId)) throw new Error(`French translation defined more than once: ${entry.canonicalId}`);
    seen.add(entry.canonicalId);
    const canonical = canonicalBySlug.get(entry.canonicalId);
    if (!canonical) throw new Error(`French translation points to unknown or unpublished bias: ${entry.canonicalId}`);
    const englishLabel = entry.englishLabel || englishLabelFromTitle(canonical.title);
    const localizedLabel = entry.localizedLabel?.trim();
    if (!localizedLabel) throw new Error(`${entry.canonicalId}: missing localizedLabel in ${entry._sourceFile}`);
    const examples = Array.isArray(entry.examples) ? entry.examples.filter(Boolean) : entry.example ? [entry.example] : [];
    return {
      ...entry,
      canonicalId: entry.canonicalId,
      localizedLabel,
      localizedSlug: entry.localizedSlug || slugifyFrench(localizedLabel),
      englishLabel,
      aliases: unique([...(entry.aliases || []), englishLabel]),
      searchTerms: unique([localizedLabel, englishLabel, `${englishLabel} français`, ...(entry.searchTerms || [])]),
      state: entry.state || "reviewed",
      sourceRelease: entry.sourceRelease || releaseVersion,
      translatedAt: entry.translatedAt || today,
      reviewedAt: entry.reviewedAt || today,
      summary: entry.summary?.trim() || "",
      practicalQuestion: entry.practicalQuestion?.trim() || "",
      examples,
      boundary: entry.boundary?.trim() || "Cette fiche décrit un concept de la bibliothèque canonique. Elle ne permet pas, à elle seule, de diagnostiquer une personne ni d'expliquer avec certitude un cas individuel.",
      techniqueSlugs: Array.isArray(entry.techniqueSlugs) ? entry.techniqueSlugs : [],
      evidenceSummary: entry.evidenceSummary?.trim() || ""
    };
  });

  entries.sort((a, b) => {
    const ca = canonicalBySlug.get(a.canonicalId);
    const cb = canonicalBySlug.get(b.canonicalId);
    return (ca?.number ?? 9999) - (cb?.number ?? 9999) || a.localizedLabel.localeCompare(b.localizedLabel, "fr");
  });

  return {
    version: 2,
    locale: "fr",
    canonicalLocale: "en",
    sourceRelease: releaseVersion,
    reviewedAt: today,
    entries
  };
}

export function slugifyFrench(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "-")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function englishLabelFromTitle(title = "") {
  return String(title).split(/\s+[–—]\s+/)[0].trim();
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}
