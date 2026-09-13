import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const evidenceClasses = JSON.parse(await readFile("data/evidence-classes.json", "utf8"));
const reviewFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const reviewDocs = await Promise.all(reviewFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const reviewSlugs = new Set(reviewDocs.flatMap((doc) => doc.reviews || []).map((entry) => entry.slug));
const dataPath = join(OUT, "data", "de", "biases.json");
const publicDoc = JSON.parse(await readFile(dataPath, "utf8"));
let updated = 0;

for (const entry of publicDoc.entries || []) {
  if (entry.localizationState === "evidence-reviewed") {
    entry.canonicalEvidenceReviewAvailable = true;
    continue;
  }
  const hasReview = reviewSlugs.has(entry.slug) && Boolean(evidenceClasses.bySlug?.[entry.slug]);
  entry.canonicalEvidenceReviewAvailable = hasReview;
  if (!hasReview) continue;
  entry.evidenceClass = evidenceClasses.bySlug[entry.slug];
  const pagePath = join(OUT, "de", "biases", entry.slug, "index.html");
  let html = await readFile(pagePath, "utf8");
  const oldBlock = `<section class="section"><p class="kicker">Evidenzgrenze</p><h2>Vollständig auf Deutsch, wissenschaftlicher Status unverändert</h2><p>Diese Seite lokalisiert einen veröffentlichten Eintrag des kanonischen Katalogs. Für diesen Eintrag gehört im deutschen Reviewed-Layer derzeit kein eigener vollständiger Evidence Review zur Seite. Die Lokalisierung erhöht den wissenschaftlichen Status des ursprünglichen Eintrags nicht.</p><p><a href="/biases/${entry.slug}/" lang="en">Kanonischen Eintrag auf Englisch öffnen →</a></p></section>`;
  const newBlock = `<section class="section"><p class="kicker">Evidenzgrenze</p><h2>Kanonischer Evidence Review vorhanden</h2><p>Für dieses Konzept führt das Projekt einen kontrollierten Evidence Review der Klasse <strong>${entry.evidenceClass}</strong>. Die Seite ist vollständig auf Deutsch lokalisiert; Quellen, Methodik und die ausführliche wissenschaftliche Qualifikation bleiben im kanonischen englischen Review nachvollziehbar.</p><p><a href="/biases/${entry.slug}/#evidence" lang="en">Vollständiger Evidence Review — English →</a></p></section>`;
  if (!html.includes(oldBlock)) throw new Error(`${entry.slug}: expected editorial evidence-boundary block missing.`);
  html = html.replace(oldBlock, newBlock);
  await writeFile(pagePath, html);
  updated += 1;
}

await writeFile(dataPath, JSON.stringify(publicDoc, null, 2) + "\n");
console.log(`German full-catalog provenance aligned: ${updated} editorial localization(s) linked to an existing canonical Evidence Review.`);
