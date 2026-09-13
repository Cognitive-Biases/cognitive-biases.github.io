import { readFile } from "node:fs/promises";

export async function loadPortugueseTranslations({ canonicalBiases, releaseVersion, today }) {
  const document = JSON.parse(await readFile("data/translations-pt-br.json", "utf8"));
  const canonicalBySlug = new Map(canonicalBiases.filter((entry) => entry.published).map((entry) => [entry.slug, entry]));
  const seenCanonical = new Set();
  const seenLocalized = new Set();
  const entries = (document.entries || []).map((entry) => {
    if (seenCanonical.has(entry.canonicalId)) throw new Error(`pt-BR translation defined more than once: ${entry.canonicalId}`);
    seenCanonical.add(entry.canonicalId);
    const canonical = canonicalBySlug.get(entry.canonicalId);
    if (!canonical) throw new Error(`pt-BR translation points to unknown or unpublished bias: ${entry.canonicalId}`);
    const localizedLabel = String(entry.localizedLabel || "").trim();
    const localizedSlug = String(entry.localizedSlug || slugifyPortuguese(localizedLabel)).trim();
    if (!localizedLabel || !localizedSlug) throw new Error(`${entry.canonicalId}: missing pt-BR label or slug`);
    if (seenLocalized.has(localizedSlug)) throw new Error(`Duplicate pt-BR bias slug: ${localizedSlug}`);
    seenLocalized.add(localizedSlug);
    if ((entry.state || "reviewed") !== "reviewed") throw new Error(`${entry.canonicalId}: pt-BR public entry must be reviewed`);
    const englishLabel = entry.englishLabel || englishLabelFromTitle(canonical.title);
    return {
      ...entry,
      canonicalId: entry.canonicalId,
      localizedLabel,
      localizedSlug,
      englishLabel,
      aliases: unique([...(entry.aliases || []), englishLabel]),
      searchTerms: unique([localizedLabel, englishLabel, `${englishLabel} em português`, ...(entry.searchTerms || [])]),
      state: "reviewed",
      sourceRelease: entry.sourceRelease || releaseVersion,
      translatedAt: entry.translatedAt || today,
      reviewedAt: entry.reviewedAt || today,
      examples: Array.isArray(entry.examples) ? entry.examples.filter(Boolean) : [],
      techniqueSlugs: Array.isArray(entry.techniqueSlugs) ? entry.techniqueSlugs : []
    };
  });
  entries.sort((a, b) => (canonicalBySlug.get(a.canonicalId)?.number ?? 9999) - (canonicalBySlug.get(b.canonicalId)?.number ?? 9999) || a.localizedLabel.localeCompare(b.localizedLabel, "pt-BR"));
  return {
    version: document.version || 1,
    locale: "pt-BR",
    canonicalLocale: "en",
    sourceRelease: releaseVersion,
    reviewedAt: document.reviewedAt || today,
    coverage: document.coverage || "curated-reviewed-subset",
    totalPublishedCanonical: canonicalBySlug.size,
    translatedCount: entries.length,
    entries
  };
}

export function slugifyPortuguese(value) {
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
