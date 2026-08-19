import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const spec = JSON.parse(await readFile("data/ai-benchmark.json", "utf8"));
const experiments = JSON.parse(await readFile("data/experiments.json", "utf8"));
const sourceBySlug = new Map((experiments.entries || []).map((entry) => [entry.slug, entry]));
const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const evidenceSlugs = new Set(evidenceDocs.flatMap((doc) => doc.reviews || []).map((review) => review.slug));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(spec.version === 1, "AI benchmark version must be explicit");
assert(spec.status === "specification-published-results-pending", "AI benchmark must not imply unpublished model results");
assert((spec.experiments || []).length === 6, `Expected 6 launch benchmark experiments, found ${(spec.experiments || []).length}`);
assert(spec.protocol?.freshContextPerCase === true, "Benchmark requires fresh contexts");
assert(spec.protocol?.minimumSamplesPerCondition >= 20, "Benchmark stochastic minimum must be at least 20");
assert(Array.isArray(spec.principles) && spec.principles.some((line) => line.includes("do not collapse")), "Benchmark must reject a universal headline score");

const seen = new Set();
for (const benchmark of spec.experiments) {
  assert(!seen.has(benchmark.experimentSlug), `Duplicate benchmark experiment ${benchmark.experimentSlug}`);
  seen.add(benchmark.experimentSlug);
  const source = sourceBySlug.get(benchmark.experimentSlug);
  assert(source, `${benchmark.experimentSlug}: missing Experiments Lab source`);
  assert(source.biasSlug === benchmark.biasSlug, `${benchmark.experimentSlug}: bias link drift`);
  assert(evidenceSlugs.has(benchmark.biasSlug), `${benchmark.experimentSlug}: benchmark concept is not evidence-reviewed`);
  assert((benchmark.conditions || []).length === 2, `${benchmark.experimentSlug}: expected exactly two conditions`);
  assert(["mean-difference", "choice-share-difference"].includes(benchmark.metric?.type), `${benchmark.experimentSlug}: unsupported metric`);
  assert(["condition0-minus-condition1", "condition1-minus-condition0"].includes(benchmark.metric?.direction), `${benchmark.experimentSlug}: direction missing`);
  for (const condition of benchmark.conditions) {
    assert(condition.label && condition.prompt, `${benchmark.experimentSlug}: incomplete condition`);
    assert(condition.prompt.includes("Return JSON only"), `${benchmark.experimentSlug}: prompt must use structured output`);
  }
}

const pagePath = join(OUT, "ai-benchmark", "index.html");
await access(pagePath);
const page = await readFile(pagePath, "utf8");
assert(page.includes("<h1>Test the change, not the label.</h1>"), "Benchmark page headline missing");
assert(page.includes("Specification published. Results pending."), "Benchmark page must state that results are pending");
assert(page.includes("does not collapse unlike effects into one universal"), "Benchmark page must reject a universal score");
assert(page.includes('"@type":"Dataset"'), "Benchmark page Dataset structured data missing");
assert(!page.includes("Leaderboard"), "Benchmark page should not publish a leaderboard without results");

const publicSpec = JSON.parse(await readFile(join(OUT, "data", "ai-benchmark.json"), "utf8"));
assert(publicSpec.experiments?.length === spec.experiments.length, "Public benchmark spec count drift");
assert(publicSpec.canonicalUrl === `${SITE}/ai-benchmark/`, "Public benchmark canonical URL drift");

const promptLines = (await readFile(join(OUT, "data", "ai-benchmark-prompts.ndjson"), "utf8")).trim().split(/\r?\n/).map(JSON.parse);
assert(promptLines.length === spec.experiments.length * 2, "Prompt pack must contain two conditions per experiment");
assert(new Set(promptLines.map((row) => row.caseId)).size === promptLines.length, "Prompt pack case IDs must be unique");

const resultSchema = JSON.parse(await readFile(join(OUT, "schemas", "ai-benchmark-results.schema.json"), "utf8"));
assert(resultSchema.$schema && resultSchema.required?.includes("response"), "Public benchmark result schema incomplete");

const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
assert(sitemap.includes(`<loc>${SITE}/ai-benchmark/</loc>`), "Sitemap missing AI benchmark");
for (const path of ["index.html", join("research", "index.html"), join("experiments", "index.html")]) {
  const html = await readFile(join(OUT, path), "utf8");
  assert(html.includes('href="/ai-benchmark/"'), `${path}: AI benchmark discovery link missing`);
}

const llms = await readFile(join(OUT, "llms.txt"), "utf8");
assert(llms.includes(`${SITE}/ai-benchmark/`), "llms.txt missing AI benchmark");
assert(llms.includes(`${SITE}/data/ai-benchmark-prompts.ndjson`), "llms.txt missing benchmark prompt pack");
assert(llms.includes(`${SITE}/schemas/ai-benchmark-results.schema.json`), "llms.txt missing benchmark result schema");

console.log(`AI Bias Benchmark check passed: ${spec.experiments.length} paired experiments, ${promptLines.length} prompt cases, results honestly pending.`);
