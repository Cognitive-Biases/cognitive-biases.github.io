import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const ID = 80;
const SLUG = "self-assessment-dunning";
const RESEARCH = "dunning-kruger-effect-what-research-shows";
const json = async (path) => JSON.parse(await readFile(path, "utf8"));

const biases = await json("data/biases.json");
const dunning = biases.find((entry) => entry.id === ID);
if (!dunning || dunning.slug !== SLUG) throw new Error("Dunning-Kruger #80 canonical record is missing.");
if (!/^Dunning–Kruger Effect\b/.test(dunning.title || "")) throw new Error("Dunning-Kruger reviewed title is missing.");
if (/the less you know, the more confident you are/i.test(dunning.title || "") || /true experts underestimate/i.test(dunning.description || "")) throw new Error("Dunning-Kruger page regressed to the popular caricature.");
if (/🔍|💡/u.test(dunning.description || "")) throw new Error("Dunning-Kruger reviewed top copy must stay plain and marker-free.");
if (!/not a rule that the least skilled person is always the most confident/i.test(dunning.description || "")) throw new Error("Dunning-Kruger top copy lost its calibration qualification.");
if (!/Do not use Dunning–Kruger as a label for people you think are wrong/i.test(dunning.description || "")) throw new Error("Dunning-Kruger top copy lost its anti-label guidance.");

const evidence = await json("dist/data/evidence.json");
const review = (evidence.reviews || []).find((entry) => entry.slug === SLUG);
if (!review || !/supported but often overstated/i.test(review.evidenceStatus || "")) throw new Error("Dunning-Kruger evidence review/status is missing.");
for (const doi of ["10.1037/0022-3514.77.6.1121", "10.1016/j.intell.2020.101449", "10.1016/j.intell.2022.101717"]) {
  if (!review.sources?.some((source) => source.doi === doi)) throw new Error(`Dunning-Kruger evidence review is missing ${doi}.`);
}

const notes = await json("data/research-notes.json");
const note = (notes.entries || []).find((entry) => entry.slug === RESEARCH);
if (!note || !note.related?.includes(SLUG)) throw new Error("Dunning-Kruger research synthesis is missing or not related to the canonical concept.");
if (!/calibration between performance and self-assessment/i.test(note.summary || "")) throw new Error("Dunning-Kruger research summary lost the calibration framing.");
if (!note.sources?.some((source) => source.doi === "10.1016/j.intell.2020.101449") || !note.sources?.some((source) => source.doi === "10.1016/j.intell.2022.101717")) throw new Error("Dunning-Kruger research note must preserve both sides of the recent methodological debate.");

const html = await readFile(resolve("dist", "biases", SLUG, "index.html"), "utf8");
for (const required of [
  'class="evidence-review"',
  'data-seo-schema="defined-term"',
  `"termCode":"${ID}"`,
  'class="research-teaser"',
  `/research/${RESEARCH}/`
]) if (!html.includes(required)) throw new Error(`Dunning-Kruger canonical page is missing ${required}.`);

const researchHtml = await readFile(resolve("dist", "research", RESEARCH, "index.html"), "utf8");
if (!researchHtml.includes('data-seo-schema="research-article"')) throw new Error("Dunning-Kruger research note is missing Article structured data.");
if (!researchHtml.includes("10.1016/j.intell.2020.101449") || !researchHtml.includes("10.1016/j.intell.2022.101717")) throw new Error("Dunning-Kruger research page does not expose both methodological sources.");

const publicBiases = await json("dist/data/biases.json");
const publicResearch = await json("dist/data/research-notes.json");
if (!publicBiases.some((entry) => entry.id === ID && entry.slug === SLUG && /performance and self-assessment do not line up/i.test(entry.title || ""))) throw new Error("Public dataset is missing corrected Dunning-Kruger top copy.");
if (!(publicResearch.entries || []).some((entry) => entry.slug === RESEARCH)) throw new Error("Public dataset is missing Dunning-Kruger research note.");

const sitemap = await readFile("dist/sitemap.xml", "utf8");
for (const url of [`${SITE}/biases/${SLUG}/`, `${SITE}/research/${RESEARCH}/`]) {
  if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`Sitemap is missing ${url}.`);
}

console.log("Dunning-Kruger quality check passed: calibrated top copy, evidence debate, reciprocal research discovery, structured data, exports and sitemap are aligned.");
