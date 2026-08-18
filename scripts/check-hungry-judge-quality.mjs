import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const ID = 103;
const SLUG = "cognitive-bias-hungry-judge-effect";
const RESEARCH = "hungry-judge-effect-what-study-actually-shows";
const json = async (path) => JSON.parse(await readFile(path, "utf8"));

const biases = await json("data/biases.json");
const hungry = biases.find((entry) => entry.id === ID);
if (!hungry || hungry.slug !== SLUG) throw new Error("Hungry Judge Effect #103 canonical record is missing.");
if (!/famous parole-board finding with an uncertain cause/i.test(hungry.title || "")) throw new Error("Hungry Judge reviewed title is missing.");
if (/🔍|💡/u.test(hungry.description || "")) throw new Error("Hungry Judge top copy must stay plain and marker-free.");
if (/judges give harsher sentences before lunch/i.test(hungry.description || "")) throw new Error("Hungry Judge page regressed to the legacy before-lunch causal claim.");
if (!/study did not measure hunger/i.test(hungry.description || "")) throw new Error("Hungry Judge top copy lost the no-hunger-measurement boundary.");
if (!/not as a law that hungry judges become harsher/i.test(hungry.description || "")) throw new Error("Hungry Judge top copy lost the myth-correction boundary.");

const evidence = await json("dist/data/evidence.json");
const review = (evidence.reviews || []).find((entry) => entry.slug === SLUG);
if (!review || !/contested observational finding/i.test(review.evidenceStatus || "")) throw new Error("Hungry Judge evidence status is missing or too strong.");
for (const doi of ["10.1073/pnas.1018033108", "10.1073/pnas.1110910108", "10.1073/pnas.1112190108"]) {
  if (!review.sources?.some((source) => source.doi === doi)) throw new Error(`Hungry Judge evidence review is missing ${doi}.`);
}

const exclusions = await json("data/audit-exclusions.json");
const exclusion = (exclusions.entries || []).find((entry) => entry.slug === SLUG);
if (!exclusion || !/not as a self-diagnostic decision lens/i.test(exclusion.reason || "")) throw new Error("Hungry Judge explicit Decision Audit exclusion is missing or unclear.");

const notes = await json("data/research-notes.json");
const note = (notes.entries || []).find((entry) => entry.slug === RESEARCH);
if (!note || !note.related?.includes(SLUG) || note.sources?.length < 4) throw new Error("Hungry Judge research synthesis is missing or too thin.");
if (!note.sources.some((source) => source.doi === "10.1073/pnas.1110910108")) throw new Error("Hungry Judge research note is missing the case-order critique.");
if (!note.sources.some((source) => /magnitude of the effect is overestimated/i.test(source.title || ""))) throw new Error("Hungry Judge research note is missing the later simulation analysis.");

const html = await readFile(resolve("dist", "biases", SLUG, "index.html"), "utf8");
for (const required of ['class="evidence-review"', 'data-seo-schema="defined-term"', `"termCode":"${ID}"`, 'class="research-teaser"', `/research/${RESEARCH}/`]) {
  if (!html.includes(required)) throw new Error(`Hungry Judge canonical page is missing ${required}.`);
}
if (html.includes(`/tools/decision-audit/?bias=${SLUG}`) || html.includes('class="audit-cta"')) throw new Error("Hungry Judge page must not offer Decision Audit self-diagnosis.");

const audit = await readFile(resolve("dist", "tools", "decision-audit", "index.html"), "utf8");
if (audit.includes(`value="${SLUG}"`)) throw new Error("Hungry Judge still appears in the Decision Audit selector.");

const researchHtml = await readFile(resolve("dist", "research", RESEARCH, "index.html"), "utf8");
if (!researchHtml.includes('data-seo-schema="research-article"')) throw new Error("Hungry Judge research note is missing Article structured data.");
if (!researchHtml.includes("10.1073/pnas.1110910108")) throw new Error("Hungry Judge research page does not expose the critique source.");

const publicBiases = await json("dist/data/biases.json");
const publicResearch = await json("dist/data/research-notes.json");
if (!publicBiases.some((entry) => entry.id === ID && entry.slug === SLUG && /uncertain cause/i.test(entry.title || ""))) throw new Error("Public dataset is missing corrected Hungry Judge #103.");
if (!(publicResearch.entries || []).some((entry) => entry.slug === RESEARCH)) throw new Error("Public dataset is missing Hungry Judge research note.");

const sitemap = await readFile("dist/sitemap.xml", "utf8");
for (const url of [`${SITE}/biases/${SLUG}/`, `${SITE}/research/${RESEARCH}/`]) {
  if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`Sitemap is missing ${url}.`);
}

console.log("Hungry Judge quality check passed: causal myth corrected, contested evidence preserved, explicit audit exclusion applied, reciprocal research discovery, exports and sitemap aligned.");
