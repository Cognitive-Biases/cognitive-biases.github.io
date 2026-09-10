import { readFile, writeFile } from "node:fs/promises";

const source = JSON.parse(await readFile("data/search-intents.json", "utf8"));
const outputPath = "dist/data/search-intents.json";
const generated = JSON.parse(await readFile(outputPath, "utf8"));
const bySlug = new Map((source.intents || []).map((intent) => [intent.slug, intent]));

const generatedGuides = (generated.generatedGuides || []).map((guide) => {
  const intent = bySlug.get(guide.slug);
  if (!intent) throw new Error(`Generated search guide has no canonical intent: ${guide.slug}`);
  return {
    ...guide,
    situationSlugs: [...(intent.situationSlugs || [])]
  };
});

for (const intent of source.intents || []) {
  for (const slug of intent.situationSlugs || []) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`${intent.slug}: invalid situation slug ${slug}`);
  }
}

await writeFile(outputPath, JSON.stringify({
  ...generated,
  intentModelVersion: source.version,
  generatedGuides
}, null, 2) + "\n");

console.log(`Search intent release data enriched: ${generatedGuides.length} generated guides with situation routing.`);
