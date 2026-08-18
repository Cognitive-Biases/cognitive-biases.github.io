import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const ID = 121;
const SLUG = "cognitive-bias-systematic-bias";
const RESEARCH = "systematic-bias-why-more-data-is-not-enough";
const json = async (path) => JSON.parse(await readFile(path, "utf8"));

const biases = await json("data/biases.json");
const systematic = biases.find((entry) => entry.id === ID);
if (!systematic || systematic.slug !== SLUG) throw new Error("Systematic Bias #121 canonical record is missing.");
if (!/measurement and statistical concept, not one cognitive bias/i.test(systematic.title || "")) throw new Error("Systematic Bias reviewed title is missing.");
if (/🔍|💡/u.test(systematic.description || "")) throw new Error("Systematic Bias top copy must stay plain and marker-free.");
if (!/not the name of one psychological mechanism/i.test(systematic.description || "")) throw new Error("Systematic Bias top copy lost its non-psychological boundary.");
if (!/More observations can reduce random uncertainty, but they do not automatically remove a systematic error/i.test(systematic.description || "")) throw new Error("Systematic Bias top copy lost the more-data boundary.");

const evidence = await json("dist/data/evidence.json");
const review = (evidence.reviews || []).find((entry) => entry.slug === SLUG);
if (!review || !/measurement\/statistical concept; not a standalone cognitive-bias construct/i.test(review.evidenceStatus || "")) throw new Error("Systematic Bias evidence status is missing or incorrectly psychological.");
if (review.auditEligible !== false) throw new Error("Systematic Bias evidence review must remain audit-ineligible.");

const kinds = await json("data/kinds-v2.json");
if (kinds.recordKindOverrides?.[String(ID)] !== "measurement") throw new Error("Systematic Bias #121 must use Measurement concept kind.");
if (kinds.kinds?.measurement?.label !== "Measurement concept") throw new Error("Measurement concept controlled kind is missing.");

const taxonomy = await json("data/taxonomy-v2.json");
if (taxonomy.recordFamilyOverrides?.[String(ID)] !== "measurement-methods") throw new Error("Systematic Bias #121 must map to Measurement & methods.");
if (taxonomy.families?.["measurement-methods"]?.label !== "Measurement & methods") throw new Error("Measurement & methods family is missing.");

const notes = await json("data/research-notes.json");
const note = (notes.entries || []).find((entry) => entry.slug === RESEARCH);
if (!note || !note.related?.includes(SLUG)) throw new Error("Systematic Bias research note is missing or not related to #121.");
if (!/more data is not enough/i.test(note.title || "")) throw new Error("Systematic Bias research note lost its practical search intent.");

const html = await readFile(resolve("dist", "biases", SLUG, "index.html"), "utf8");
for (const required of [
  'class="evidence-review"',
  'class="kind-chip" data-kind="measurement" href="/kinds/#measurement"',
  'data-seo-schema="defined-term"',
  `"termCode":"${ID}"`,
  'class="research-teaser"',
  `/research/${RESEARCH}/`
]) if (!html.includes(required)) throw new Error(`Systematic Bias canonical page is missing ${required}.`);
if (html.includes(`/tools/decision-audit/?bias=${SLUG}`) || html.includes('class="audit-cta"')) throw new Error("Systematic Bias must remain outside Decision Audit.");

const audit = await readFile(resolve("dist", "tools", "decision-audit", "index.html"), "utf8");
if (audit.includes(`value="${SLUG}"`)) throw new Error("Systematic Bias still appears in Decision Audit selector.");

const researchHtml = await readFile(resolve("dist", "research", RESEARCH, "index.html"), "utf8");
if (!researchHtml.includes('data-seo-schema="research-article"')) throw new Error("Systematic Bias research note is missing Article structured data.");
for (const source of ["NIST Technical Note 1297", "Bias, Statistical"]) {
  if (!researchHtml.includes(source)) throw new Error(`Systematic Bias research page is missing source ${source}.`);
}

const publicBiases = await json("dist/data/biases.json");
const publicResearch = await json("dist/data/research-notes.json");
if (!publicBiases.some((entry) => entry.id === ID && entry.slug === SLUG && /measurement and statistical concept/i.test(entry.title || ""))) throw new Error("Public dataset is missing corrected Systematic Bias #121.");
if (!(publicResearch.entries || []).some((entry) => entry.slug === RESEARCH)) throw new Error("Public dataset is missing Systematic Bias research note.");

const sitemap = await readFile("dist/sitemap.xml", "utf8");
for (const url of [`${SITE}/biases/${SLUG}/`, `${SITE}/research/${RESEARCH}/`, `${SITE}/kinds/`]) {
  if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`Sitemap is missing ${url}.`);
}

console.log("Systematic Bias measurement check passed: #121 is a Measurement concept in Measurement & methods, evidence-reviewed, audit-ineligible, linked to Research, exported and discoverable without pretending it is a personal cognitive bias.");
