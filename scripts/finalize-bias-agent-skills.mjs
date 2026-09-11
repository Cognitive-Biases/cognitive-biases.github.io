import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const hubPath = "dist/agent-skills/index.html";
let hub = await readFile(hubPath, "utf8");

const oldHeading = "A bias is a lens. A skill is a job your agent can actually do.";
const oldCopy = "We do not create hundreds of tiny skills that merely repeat bias definitions. The marketplace packages useful workflows: review a decision, challenge evidence, forecast, verify information or use AI without letting fluent output become evidence.";
const newHeading = "Every bias is installable. Workflows go further.";
const newCopy = "Every published canonical cognitive bias has its own focused Agent Skill, generated from the canonical library and free to install. Broader workflow skills remain available for jobs such as decision review, evidence evaluation, forecasting, verification and AI-assisted reasoning.";

if (hub.includes(oldHeading)) hub = hub.replace(oldHeading, newHeading);
if (hub.includes(oldCopy)) hub = hub.replace(oldCopy, newCopy);

if (hub.includes("The initial collection is instruction-only.")) {
  hub = hub.replace("The initial collection is instruction-only.", "The collection is instruction-only.");
}

if (!hub.includes("Every bias is installable")) throw new Error("Agent Skills hub is missing the per-bias marketplace positioning.");
if (!hub.includes("/agent-skills/biases/")) throw new Error("Agent Skills hub is missing the Bias Skills collection link.");
await writeFile(hubPath, hub);

const biases = JSON.parse(await readFile("data/biases.json", "utf8"));
const duplicates = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const canonicalBiases = biases.filter((bias) => bias.published && !duplicateIds.has(bias.id));

const conceptTitle = (bias) => String(bias.title || bias.slug).split(/\s+[–—]\s+/)[0].trim();
const clean = (value = "") => String(value).replace(/\s+/g, " ").trim();
const escapeAttr = (value = "") => String(value).replace(/[&"<>]/g, (character) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[character]);
const truncate = (value, max) => {
  const text = clean(value);
  if (text.length <= max) return text;
  const clipped = text.slice(0, Math.max(1, max - 1)).replace(/\s+\S*$/, "").replace(/[\s–—|,:;-]+$/, "");
  return `${clipped || text.slice(0, max - 1)}…`;
};

function skillNameForBias(bias) {
  const base = `bias-${String(bias.slug).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-")}`;
  if (base.length <= 64) return base;
  const suffix = createHash("sha1").update(String(bias.slug)).digest("hex").slice(0, 8);
  return `${base.slice(0, 55).replace(/-+$/g, "")}-${suffix}`;
}

function uniqueSeoValues(items, candidate, fallback) {
  const initial = items.map(candidate);
  const counts = new Map();
  for (const value of initial) counts.set(value, (counts.get(value) || 0) + 1);
  return items.map((item, index) => counts.get(initial[index]) === 1 ? initial[index] : fallback(item, initial[index]));
}

const seoTitles = uniqueSeoValues(
  canonicalBiases,
  (bias) => truncate(`${conceptTitle(bias)} Agent Skill – ${bias.typeOfBias || "Cognitive Bias"}`, 68),
  (bias) => truncate(`${conceptTitle(bias)} Agent Skill – ${bias.typeOfBias || "Cognitive Bias"} #${bias.number || bias.id}`, 68)
);

const seoDescriptions = uniqueSeoValues(
  canonicalBiases,
  (bias) => truncate(`Free ${conceptTitle(bias)} Agent Skill for ${bias.typeOfBias || "cognitive bias"}. Explain the lens, test alternatives, preserve uncertainty, and apply a practical counter-check.`, 155),
  (bias) => truncate(`Free ${conceptTitle(bias)} Agent Skill for ${bias.typeOfBias || "cognitive bias"} (canonical #${bias.number || bias.id}). Test alternatives and preserve uncertainty.`, 155)
);

const seenTitles = new Set();
const seenDescriptions = new Set();
for (let index = 0; index < canonicalBiases.length; index += 1) {
  const bias = canonicalBiases[index];
  const skillName = skillNameForBias(bias);
  const pagePath = join("dist", "agent-skills", skillName, "index.html");
  let page = await readFile(pagePath, "utf8");
  const seoTitle = seoTitles[index];
  const seoDescription = seoDescriptions[index];

  if (seenTitles.has(seoTitle)) throw new Error(`${bias.slug}: generated Bias Skill SEO title is still duplicated: ${seoTitle}`);
  if (seenDescriptions.has(seoDescription)) throw new Error(`${bias.slug}: generated Bias Skill meta description is still duplicated.`);
  seenTitles.add(seoTitle);
  seenDescriptions.add(seoDescription);

  page = page.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(seoTitle)}</title>`);
  page = page.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeAttr(seoDescription)}">`);
  page = page.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escapeAttr(seoTitle)}">`);
  page = page.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escapeAttr(seoDescription)}">`);

  if (!page.includes(`<title>${escapeAttr(seoTitle)}</title>`)) throw new Error(`${bias.slug}: could not finalize Bias Skill title metadata.`);
  if (!page.includes(`content="${escapeAttr(seoDescription)}"`)) throw new Error(`${bias.slug}: could not finalize Bias Skill description metadata.`);
  if (!page.includes(`${SITE}/agent-skills/${skillName}/`)) throw new Error(`${bias.slug}: Bias Skill canonical URL changed unexpectedly.`);
  await writeFile(pagePath, page);
}

console.log(`Finalized Agent Skills marketplace copy and unique SEO metadata for ${canonicalBiases.length} Bias Skills.`);
