import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const source = JSON.parse(await readFile("data/experiments.json", "utf8"));
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const evidenceIds = new Set(evidenceDocs.flatMap((document) => document.reviews || []).map((review) => review.slug));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const experiments = source.entries || [];
assert(experiments.length >= 6, `Experiments Lab needs at least 6 launch demos, found ${experiments.length}`);
assert(/^\d{4}-\d{2}-\d{2}$/.test(String(source.updatedAt || "")), "Experiment data needs a stable updatedAt date");

const slugs = new Set();
for (const experiment of experiments) {
  assert(experiment.slug && !slugs.has(experiment.slug), `duplicate experiment slug: ${experiment.slug}`);
  slugs.add(experiment.slug);
  for (const field of ["title", "category", "summary", "researchQuestion", "biasSlug", "responseType", "prediction", "interpretation", "debias"]) {
    assert(String(experiment[field] || "").trim(), `${experiment.slug}: missing ${field}`);
  }
  assert(experiment.summary.length <= 190, `${experiment.slug}: summary too long for metadata`);
  assert(bySlug.has(experiment.biasSlug), `${experiment.slug}: unknown published bias ${experiment.biasSlug}`);
  assert(evidenceIds.has(experiment.biasSlug), `${experiment.slug}: bias is not evidence-reviewed`);
  assert(["choice", "rating", "number"].includes(experiment.responseType), `${experiment.slug}: unknown response type`);
  assert(Array.isArray(experiment.conditions) && experiment.conditions.length === 2, `${experiment.slug}: exactly two conditions required`);
  for (const condition of experiment.conditions) {
    assert(condition.label && condition.prompt, `${experiment.slug}: incomplete condition`);
    if (experiment.responseType === "choice") assert(Array.isArray(condition.options) && condition.options.length >= 2, `${experiment.slug}: choice condition needs options`);
  }
}

const publicData = JSON.parse(await readFile(join(OUT, "data", "experiments.json"), "utf8"));
assert(publicData.experiments?.length === experiments.length, "public experiment data count drift");
assert(publicData.canonicalUrl === `${SITE}/experiments/`, "public experiment canonical URL drift");
assert(String(publicData.privacy || "").includes("not transmitted"), "public experiment privacy statement missing");

const hub = await readFile(join(OUT, "experiments", "index.html"), "utf8");
assert(hub.includes("<h1>See the manipulation before you memorise the label.</h1>"), "Experiment hub headline missing");
assert(hub.includes('"@type":"CollectionPage"'), "Experiment hub CollectionPage schema missing");
assert(hub.includes("do not treat these demos as scientific measurements"), "Experiment hub must not imply study-quality measurement");
for (const experiment of experiments) assert(hub.includes(`/experiments/${experiment.slug}/`), `Experiment hub missing ${experiment.slug}`);

for (const experiment of experiments) {
  const path = join(OUT, "experiments", experiment.slug, "index.html");
  await access(path);
  const html = await readFile(path, "utf8");
  assert(html.includes(`<link rel="canonical" href="${SITE}/experiments/${experiment.slug}/">`), `${experiment.slug}: canonical missing`);
  assert(html.includes('"@type":"LearningResource"'), `${experiment.slug}: LearningResource schema missing`);
  assert(html.includes(`/biases/${experiment.biasSlug}/#evidence`), `${experiment.slug}: evidence link missing`);
  assert(html.includes("Your response stays on this page. Nothing is sent or stored."), `${experiment.slug}: privacy copy missing`);
  assert(html.includes("not a scientific measurement"), `${experiment.slug}: measurement caveat missing`);
  assert(html.includes('src="/experiments.js"'), `${experiment.slug}: interactive script missing`);
  assert(html.includes("/assets/brand.webp"), `${experiment.slug}: optimized brand asset missing`);
}

const script = await readFile(join(OUT, "experiments.js"), "utf8");
for (const forbidden of ["fetch(", "XMLHttpRequest", "sendBeacon", "localStorage", "sessionStorage"]) {
  assert(!script.includes(forbidden), `experiments.js must stay local-only: found ${forbidden}`);
}
assert(script.includes("Math.random()"), "experiment condition randomization missing");

const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
assert(sitemap.includes(`<loc>${SITE}/experiments/</loc>`), "sitemap missing experiment hub");
for (const experiment of experiments) assert(sitemap.includes(`<loc>${SITE}/experiments/${experiment.slug}/</loc>`), `sitemap missing ${experiment.slug}`);

for (const [path, marker] of [
  [join(OUT, "index.html"), 'class="section experiment-home"'],
  [join(OUT, "research", "index.html"), 'class="experiment-research-link"'],
  [join(OUT, "practice", "index.html"), 'class="section experiment-practice-link"']
]) {
  const html = await readFile(path, "utf8");
  assert(html.includes(marker) && html.includes('href="/experiments/"'), `${path}: Experiments Lab discovery link missing`);
}

const uniqueBiasSlugs = [...new Set(experiments.map((experiment) => experiment.biasSlug))];
for (const biasSlug of uniqueBiasSlugs) {
  const html = await readFile(join(OUT, "biases", biasSlug, "index.html"), "utf8");
  assert(html.includes('class="experiment-teaser"'), `${biasSlug}: experiment teaser missing`);
}

const llms = await readFile(join(OUT, "llms.txt"), "utf8");
assert(llms.includes("https://cognitive-biases.github.io/experiments/"), "llms.txt missing Experiments Lab");
assert(llms.includes("https://cognitive-biases.github.io/data/experiments.json"), "llms.txt missing experiment data");

console.log(`Experiments Lab check passed: ${experiments.length} demos across ${uniqueBiasSlugs.length} evidence-reviewed concepts.`);
