import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const LEGACY_AUTOMATION_ID = 51;
const LEGACY_AUTOMATION_SLUG = "false-priors-automation-bias";
const RETIRED_DUPLICATE_ID = 221;
const RETIRED_DUPLICATE_SLUG = "human-ai-interaction-automation-bias";

const biases = JSON.parse(await readFile("data/biases.json", "utf8"));
const automation = biases.filter((bias) => /^Automation Bias\b/i.test(bias.title || ""));
if (automation.length !== 1) throw new Error(`AI context requires exactly one Automation Bias record; found ${automation.length}.`);
if (automation[0].id !== LEGACY_AUTOMATION_ID || automation[0].slug !== LEGACY_AUTOMATION_SLUG) {
  throw new Error(`Automation Bias must preserve historical #${LEGACY_AUTOMATION_ID} / ${LEGACY_AUTOMATION_SLUG}.`);
}
if (biases.some((bias) => bias.id === RETIRED_DUPLICATE_ID || bias.slug === RETIRED_DUPLICATE_SLUG)) {
  throw new Error("Retired duplicate Automation Bias #221 is still present in the prepared corpus.");
}

const editorial = JSON.parse(await readFile("data/editorial-overrides.json", "utf8"));
const automationOverride = (editorial.entries || []).find((entry) => entry.id === LEGACY_AUTOMATION_ID);
if (!automationOverride || automationOverride.slug !== LEGACY_AUTOMATION_SLUG) {
  throw new Error("Historical Automation Bias is missing its evidence-aligned editorial override.");
}

const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(`data/${name}`, "utf8"))));
const evidenceSlugs = evidenceDocs.flatMap((document) => document.reviews || []).map((review) => review.slug);
if (!evidenceSlugs.includes(LEGACY_AUTOMATION_SLUG)) throw new Error("Historical Automation Bias is missing an evidence review.");
if (evidenceSlugs.includes(RETIRED_DUPLICATE_SLUG)) throw new Error("Evidence review still targets the retired Automation Bias duplicate slug.");

const taxonomy = JSON.parse(await readFile("data/taxonomy-v2.json", "utf8"));
if (taxonomy.recordFamilyOverrides?.[String(LEGACY_AUTOMATION_ID)] !== "attention-information") {
  throw new Error("Historical Automation Bias is missing its v2 attention-information family mapping.");
}
if (taxonomy.recordFamilyOverrides?.[String(RETIRED_DUPLICATE_ID)]) throw new Error("Taxonomy still maps retired Automation Bias #221.");

const contexts = JSON.parse(await readFile("data/contexts.json", "utf8"));
const aiContext = (contexts.entries || []).find((entry) => entry.slug === "ai-assisted-decisions");
if (!aiContext) throw new Error("AI-assisted decisions context is missing.");
const lensSlugs = aiContext.lenses.map((lens) => lens.slug);
if (!lensSlugs.includes(LEGACY_AUTOMATION_SLUG)) throw new Error("AI context does not use the historical Automation Bias canonical page.");
if (lensSlugs.includes(RETIRED_DUPLICATE_SLUG)) throw new Error("AI context still links the retired Automation Bias duplicate.");

const html = await readFile(resolve("dist", "biases", LEGACY_AUTOMATION_SLUG, "index.html"), "utf8");
if (!html.includes('class="evidence-review"')) throw new Error("Automation Bias canonical page is missing evidence review rendering.");
if (!html.includes(`/tools/decision-audit/?bias=${LEGACY_AUTOMATION_SLUG}`)) throw new Error("Automation Bias canonical page is missing Decision Audit route.");
if (!html.includes('/contexts/ai-assisted-decisions/')) throw new Error("Automation Bias canonical page is missing reciprocal AI context discovery.");
if (html.includes(RETIRED_DUPLICATE_SLUG)) throw new Error("Automation Bias canonical page leaks the retired duplicate slug.");

const aiPage = await readFile(resolve("dist", "contexts", "ai-assisted-decisions", "index.html"), "utf8");
if (!aiPage.includes(`/biases/${LEGACY_AUTOMATION_SLUG}/#evidence`)) throw new Error("AI context does not link the Automation Bias evidence section.");
if (aiPage.includes(RETIRED_DUPLICATE_SLUG)) throw new Error("AI context rendered the retired duplicate Automation Bias slug.");

console.log("AI context check passed: historical Automation Bias #51 remains the sole canonical record and is connected to evidence, taxonomy, Decision Audit, and AI context without duplicate #221.");
