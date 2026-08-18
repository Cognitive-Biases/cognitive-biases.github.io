import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const TODAY = new Date().toISOString().slice(0, 10);

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const biases = (await readJson("data/biases.json")).filter((item) => item.published);
const contexts = await readJson("data/contexts.json");
const comparisons = await readJson("data/comparisons.json");
const contextCount = Array.isArray(contexts) ? contexts.length : contexts.entries?.length || 0;
const comparisonCount = Array.isArray(comparisons) ? comparisons.length : comparisons.entries?.length || 0;

const evidenceFiles = [
  "data/evidence-reviews.json",
  "data/evidence-reviews-pilot-2.json",
  "data/evidence-reviews-pilot-3.json",
  "data/evidence-reviews-ai.json",
  "data/evidence-reviews-generic-1.json"
];

const evidenceBySlug = new Map();
for (const path of evidenceFiles) {
  if (!(await exists(path))) continue;
  const payload = await readJson(path);
  for (const review of payload.reviews || []) evidenceBySlug.set(review.slug, review);
}
const evidence = [...evidenceBySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));

const escape = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character]);

const header = () => `<header class="site-header"><a class="brand" href="/"><img src="/assets/icon2.png" width="48" height="48" alt="Cognitive Biases cat icon"><span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/explore/">Explore</a><a href="/evidence/">Evidence</a><a href="/research/">Research</a><a href="/about/">About</a><a class="nav-cta" href="/data/">Use the data</a></nav></header>`;
const footer = () => `<footer class="site-footer"><div><a class="brand brand--footer" href="/"><img src="/assets/icon2.png" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p>A public guide to cognitive biases, evidence and better decisions.</p></div><div class="footer-links"><a href="/explore/">Explore biases</a><a href="/research/">Research</a><a href="/data/">Data</a><a href="/partners/">Partnerships</a><a href="/about/">About</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p></footer>`;

function page({ title, description, path, eyebrow, heading, intro, body }) {
  const canonical = `${SITE}${path}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: canonical,
    isPartOf: { "@type": "WebSite", name: "Cognitive Biases", url: SITE }
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${escape(title)}</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE}/assets/icon2.png"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip" href="#main">Skip to content</a>${header()}<main id="main"><section class="page-hero"><p class="eyebrow">${escape(eyebrow)}</p><h1>${escape(heading)}</h1><p class="lede">${escape(intro)}</p></section><article class="article">${body}</article></main>${footer()}</body></html>`;
}

async function emit(path, content) {
  const target = join(OUT, path.replace(/^\//, ""), "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

await emit("/research/", page({
  title: "Research | Cognitive Biases",
  description: "What we are reviewing, what we have learned, and where the evidence around cognitive biases is changing.",
  path: "/research/",
  eyebrow: "What we are learning",
  heading: "Research, without pretending every finding is settled.",
  intro: "We review studies, compare them with what this library already says, and update the project when the evidence gives us a good reason to do so.",
  body: `<h2>What we look for</h2><p>We follow research on cognitive biases, judgment and decision making. We are especially interested in findings that confirm, narrow or challenge familiar claims, and in the growing work on decisions made with AI.</p><h2>How a review works</h2><p>We start with the strongest source we can find, preferably the original paper or a serious review. Then we ask what was actually tested, what the result supports, where the limits are, and whether it changes anything we currently say.</p><p>Not every new paper becomes a new page. Sometimes the right result is simply to add a source, soften a claim, or leave the library unchanged.</p><h2>What we publish</h2><p>Reviewed entries show what we found in the literature, when we last checked it, and where the evidence is strong, limited or mixed. Comparisons help separate ideas that are easy to confuse. Decision pages connect the research to situations where a person may actually need it.</p><h2>Current focus</h2><p>Our current work includes decisions made with AI, forecasting, information evaluation, product decisions, project estimation and well-known findings whose popular versions may be stronger than the evidence.</p><p><a class="button" href="/evidence/">See reviewed evidence</a></p>`
}));

await emit("/data/", page({
  title: "Data | Cognitive Biases",
  description: "Use the Cognitive Biases library as public structured data for research, search tools and AI-assisted projects.",
  path: "/data/",
  eyebrow: "The library beyond the website",
  heading: "Use the knowledge, not just the pages.",
  intro: "The same material that powers this website is available as public data so other projects can search it, connect it and build on it under the project licence.",
  body: `<h2>What is available</h2><p>The public release includes ${biases.length} published concepts, ${evidence.length} evidence reviews, ${contextCount} decision contexts and ${comparisonCount} reviewed comparisons. The files use the same names and links as the website so a tool can move from a record to the page a person can read.</p><h2>For assistants and agents</h2><p>An assistant can use the data to find a relevant bias, compare related ideas, show the reviewed evidence and point a person back to the source page. The project does not require an assistant to treat every older entry as verified. Review status stays part of the record.</p><h2>For researchers and builders</h2><p>You can use the release for search, educational tools, experiments and integrations that fit the licence. If you build something useful with it, we would like to know. Real reuse helps us decide which parts of the library deserve more attention.</p><h2>Download</h2><p><a href="/data/biases.json">Bias library</a><br><a href="/data/evidence.json">Evidence reviews</a><br><a href="/data/contexts.json">Decision contexts</a><br><a href="/data/comparisons.json">Comparisons</a><br><a href="/data/manifest.json">Release information</a></p><h2>Licence</h2><p>The current public content follows the licence in the repository. Attribution and non-commercial reuse conditions still apply. Please check the licence before redistributing or adapting the material.</p><p><a class="button" href="/partners/">Tell us what you are building</a></p>`
}));

await emit("/partners/", page({
  title: "Partnerships | Cognitive Biases",
  description: "Ways to contribute research, translations, decision-making cases and useful integrations to Cognitive Biases.",
  path: "/partners/",
  eyebrow: "Work with the project",
  heading: "Useful contributions beat vague partnerships.",
  intro: "We are open to people and teams who can make the library more accurate, more useful or easier to reuse.",
  body: `<h2>Research review</h2><p>If you work on judgment, decision making, behavioural science or human interaction with AI, you can help us review a concept, challenge a weak claim or point us to evidence we have missed.</p><h2>Translations</h2><p>We plan to support more languages without creating separate versions of the truth. Native speakers and subject-matter reviewers can help us keep translated pages natural while preserving the meaning of reviewed evidence.</p><h2>Real decision cases</h2><p>We are interested in practical situations where several biases can pull a decision in different directions: forecasting, product work, incident response, hiring, experiments and decisions made with AI. Good cases can become new context pages or comparisons.</p><h2>Data and agent integrations</h2><p>If you use this library in a search tool, assistant, agent or research project, tell us what worked and what was missing. We would rather improve the data around real use than invent features in isolation.</p><h2>Contact</h2><p>Email <a href="mailto:metalhatscats@gmail.com?subject=Cognitive%20Biases%20partnership">metalhatscats@gmail.com</a> with a short description of what you would like to contribute or build.</p>`
}));

await mkdir(join(OUT, "data"), { recursive: true });
await writeFile(join(OUT, "data", "biases.json"), `${JSON.stringify(biases, null, 2)}\n`);
await writeFile(join(OUT, "data", "evidence.json"), `${JSON.stringify({ version: 1, updatedAt: TODAY, reviews: evidence }, null, 2)}\n`);
await writeFile(join(OUT, "data", "contexts.json"), `${JSON.stringify(contexts, null, 2)}\n`);
await writeFile(join(OUT, "data", "comparisons.json"), `${JSON.stringify(comparisons, null, 2)}\n`);
await writeFile(join(OUT, "data", "manifest.json"), `${JSON.stringify({
  name: "Cognitive Biases public knowledge release",
  version: 1,
  generatedAt: TODAY,
  website: SITE,
  licence: "CC BY-NC-SA 4.0",
  counts: {
    concepts: biases.length,
    evidenceReviews: evidence.length,
    comparisons: comparisonCount,
    contexts: contextCount
  },
  files: {
    concepts: `${SITE}/data/biases.json`,
    evidence: `${SITE}/data/evidence.json`,
    contexts: `${SITE}/data/contexts.json`,
    comparisons: `${SITE}/data/comparisons.json`
  }
}, null, 2)}\n`);

console.log(`Generated Research, Data and Partnerships pages with ${biases.length} concepts, ${evidence.length} evidence reviews, ${contextCount} contexts and ${comparisonCount} comparisons.`);
