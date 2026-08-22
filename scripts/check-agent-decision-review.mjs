import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const examplesData = JSON.parse(await readFile("data/decision-review-examples.json", "utf8"));
const schema = JSON.parse(await readFile("schemas/decision-review.schema.json", "utf8"));
const situationsData = JSON.parse(await readFile("data/situations.json", "utf8"));
const techniquesData = JSON.parse(await readFile("data/techniques.json", "utf8"));
const skillsData = JSON.parse(await readFile("data/skills.json", "utf8"));
const biases = JSON.parse(await readFile("data/biases.json", "utf8"));

const errors = [];
const situations = new Map(situationsData.situations.map((item) => [item.slug, item]));
const techniqueSlugs = new Set(techniquesData.techniques.map((item) => item.slug));
const skillSlugs = new Set(skillsData.entries.map((item) => item.slug));
const biasSlugs = new Set(biases.map((item) => item.slug));
const ids = new Set();

if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") errors.push("schema: expected JSON Schema 2020-12");
if (!Array.isArray(schema.required) || !schema.required.includes("observedFacts") || !schema.required.includes("inferredRisks") || !schema.required.includes("missingEvidence")) errors.push("schema: fact/inference/evidence fields must be required");
if (examplesData.schemaVersion !== "1.0") errors.push("examples: unsupported schemaVersion");
if (!Array.isArray(examplesData.examples) || examplesData.examples.length < 8) errors.push("examples: expected at least 8 worked cases");

for (const example of examplesData.examples || []) {
  if (!example.id || ids.has(example.id)) errors.push(`example id missing or duplicate: ${example.id}`);
  ids.add(example.id);
  if (!String(example.input || "").trim()) errors.push(`${example.id}: missing input`);
  const review = example.review || {};
  if (review.schemaVersion !== "1.0") errors.push(`${example.id}: wrong review schemaVersion`);
  const situation = situations.get(review.situation);
  if (!situation) errors.push(`${example.id}: unknown situation ${review.situation}`);
  for (const field of ["decision", "nextAction", "uncertainty"]) if (!String(review[field] || "").trim()) errors.push(`${example.id}: missing ${field}`);
  for (const field of ["observedFacts", "missingEvidence", "questions", "techniques", "canonicalReferences"]) if (!Array.isArray(review[field]) || !review[field].length) errors.push(`${example.id}: ${field} must be non-empty`);
  for (const risk of review.inferredRisks || []) {
    if (!biasSlugs.has(risk.lensId)) errors.push(`${example.id}: unknown lens ${risk.lensId}`);
    if (situation && !situation.biases.includes(risk.lensId)) errors.push(`${example.id}: lens ${risk.lensId} is not linked to situation ${review.situation}`);
    if (!["low", "medium"].includes(risk.confidence)) errors.push(`${example.id}: confidence must stay low/medium`);
    if (!String(risk.rationale || "").trim()) errors.push(`${example.id}: risk rationale missing`);
  }
  for (const technique of review.techniques || []) {
    if (!techniqueSlugs.has(technique.id)) errors.push(`${example.id}: unknown technique ${technique.id}`);
    if (situation && !situation.techniques.includes(technique.id)) errors.push(`${example.id}: technique ${technique.id} is not linked to situation ${review.situation}`);
  }
  for (const reference of review.canonicalReferences || []) {
    const valid = reference.type === "situation" ? situations.has(reference.id)
      : reference.type === "technique" ? techniqueSlugs.has(reference.id)
      : reference.type === "skill" ? skillSlugs.has(reference.id)
      : reference.type === "bias" ? biasSlugs.has(reference.id)
      : false;
    if (!valid) errors.push(`${example.id}: invalid canonical reference ${reference.type}/${reference.id}`);
    if (!String(reference.url || "").startsWith(`${SITE}/`)) errors.push(`${example.id}: non-canonical reference URL ${reference.url}`);
  }
}

for (const path of [
  "decide/for-agents/index.html",
  "data/decision-review-examples.json",
  "data/schemas/decision-review.schema.json"
]) {
  try { await access(join(OUT, path)); }
  catch { errors.push(`missing generated artifact: ${path}`); }
}

try {
  const page = await readFile(join(OUT, "decide", "for-agents", "index.html"), "utf8");
  for (const required of ["observedFacts", "inferredRisks", "missingEvidence", "/data/schemas/decision-review.schema.json", "/data/decision-review-examples.json", "/assets/brand.webp"]) if (!page.includes(required)) errors.push(`agent page missing ${required}`);
  const decide = await readFile(join(OUT, "decide", "index.html"), "utf8");
  if (!decide.includes('href="/decide/for-agents/"')) errors.push("decide page missing agent contract link");
  const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
  if (!sitemap.includes(`${SITE}/decide/for-agents/`)) errors.push("sitemap missing agent contract page");
} catch (error) {
  errors.push(`generated page validation failed: ${error.message}`);
}

if (errors.length) {
  console.error("Agent Decision Review check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Agent Decision Review OK: ${examplesData.examples.length} calibrated worked examples and public schema.`);
