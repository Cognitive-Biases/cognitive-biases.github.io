import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const TODAY = new Date().toISOString().slice(0, 10);

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const biases = (await readJson("data/biases.json")).filter((item) => item.published);
const contexts = await readJson("data/contexts.json");
const comparisons = await readJson("data/comparisons.json");
const tracker = await readJson("data/ai-era-research-tracker.json");
const countEntries = (value) => Array.isArray(value) ? value.length : value.entries?.length || 0;

const studyFiles = (await readdir("data/studies")).filter((name) => name.endsWith(".json")).sort();
const studyDocs = await Promise.all(studyFiles.map((name) => readJson(join("data/studies", name))));
const studies = studyDocs.filter((study) => study?.studyId);

const evidenceFiles = (await readdir("data")).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name)).sort();
const evidenceBySlug = new Map();
for (const name of evidenceFiles) {
  const payload = await readJson(join("data", name));
  for (const review of payload.reviews || []) evidenceBySlug.set(review.slug, review);
}
const evidence = [...evidenceBySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));

const escape = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
const header = () => `<header class="site-header"><a class="brand" href="/"><img src="/assets/icon2.png" width="48" height="48" alt="Cognitive Biases cat icon"><span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/explore/">Explore</a><a href="/tools/decision-audit/">Decision Audit</a><a href="/evidence/">Evidence</a><a href="/research/">Research</a><a href="/data/">Data</a><a href="/about/">About</a></nav></header>`;
const footer = () => `<footer class="site-footer"><div><a class="brand brand--footer" href="/"><img src="/assets/icon2.png" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p>A public guide to cognitive biases, evidence and better decisions.</p></div><div class="footer-links"><a href="/tools/decision-audit/">Decision Audit</a><a href="/contexts/">Decision contexts</a><a href="/evidence/">Evidence</a><a href="/compare/">Compare</a><a href="/research/">Research</a><a href="/research/lab/">Research Lab</a><a href="/data/">Data</a><a href="/partners/">Partnerships</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p></footer>`;

function page({ title, description, path, eyebrow, heading, intro, body, schemaType = "WebPage" }) {
  const canonical = `${SITE}${path}`;
  const schema = {"@context":"https://schema.org","@type":schemaType,name:title,description,url:canonical,isPartOf:{"@type":"WebSite",name:"Cognitive Biases",url:SITE}};
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${escape(title)}</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE}/assets/icon2.png"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip" href="#main">Skip to content</a>${header()}<main id="main"><section class="page-hero"><p class="eyebrow">${escape(eyebrow)}</p><h1>${escape(heading)}</h1><p class="lede">${escape(intro)}</p></section><article class="article">${body}</article></main>${footer()}</body></html>`;
}

async function emit(path, content) {
  const target = join(OUT, path.replace(/^\//, ""), "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

const researchLabCallout = `<section class="research-lab-callout"><p class="kicker">Research Lab</p><h2>See what is an idea, what has a protocol, and what actually has a result.</h2><p>We publish the maturity of project research explicitly. External papers can motivate a question, but they do not turn our own track into a result. Protocols, instruments, data rules and next milestones stay visible before outcome claims.</p><p><a class="button" href="/research/lab/">Open Research Lab</a></p></section>`;

await emit("/research/", page({
  title: "Research | Cognitive Biases",
  description: "What we are reviewing, what we have learned, and where the evidence around cognitive biases is changing.",
  path: "/research/",
  eyebrow: "What we are learning",
  heading: "Research, without pretending every finding is settled.",
  intro: "We review studies, compare them with what this library already says, and update the project when the evidence gives us a good reason to do so.",
  body: `${researchLabCallout}<h2>What we look for</h2><p>We follow research on cognitive biases, judgment and decision making. We are especially interested in findings that confirm, narrow or challenge familiar claims, and in the growing work on decisions made with AI.</p><h2>How a review works</h2><p>We start with the strongest source we can find, preferably the original paper or a serious review. Then we ask what was actually tested, what the result supports, where the limits are, and whether it changes anything we currently say.</p><p>Not every new paper becomes a new page. Sometimes the right result is simply to add a source, soften a claim, or leave the library unchanged.</p><h2>What we publish</h2><p>Reviewed entries show what we found in the literature, when we last checked it, and where the evidence is strong, limited or mixed. Comparisons help separate ideas that are easy to confuse. Decision pages connect the research to situations where a person may actually need it.</p><h2>Current focus</h2><p>Our current work includes decisions made with AI, forecasting, information evaluation, product decisions, project estimation and well-known findings whose popular versions may be stronger than the evidence.</p><p><a class="button" href="/evidence/">See reviewed evidence</a></p>`
}));

const stageCards = tracker.stageOrder.map((stage, index) => `<article><strong>${index + 1}. ${escape(stage)}</strong><p>${escape(tracker.stageDefinitions[stage])}</p></article>`).join("");
const concreteTracks = tracker.entries.filter((entry) => (entry.studyArtifacts || []).length);
const studyCards = concreteTracks.map((entry) => {
  const matchingStudies = studies.filter((study) => study.track === entry.track);
  const studyNames = matchingStudies.length ? matchingStudies.map((study) => escape(study.title || study.studyId)).join(" · ") : escape(entry.name);
  const links = (entry.studyArtifacts || []).map((artifact, index) => `<a href="${escape(artifact)}">${index === 0 ? "Protocol" : index === 1 ? "Run / instrument" : "Machine-readable artifact"}</a>`).join(" · ");
  return `<article class="research-note"><p class="kicker">Stage: ${escape(entry.stage)}</p><h2>${escape(entry.name)}</h2><p><strong>${studyNames}</strong></p><p>${escape(entry.whyItMatters)}</p><p><strong>Next milestone:</strong> ${escape(entry.nextMilestone)}</p><p>${links}</p></article>`;
}).join("");
const trackCards = tracker.entries.map((entry) => `<article><strong>${escape(entry.name)}</strong><p><span class="kicker">${escape(entry.stage)}</span></p><p>${escape(entry.whyItMatters)}</p><p><strong>Next:</strong> ${escape(entry.nextMilestone)}</p></article>`).join("");

await emit("/research/lab/", page({
  title: "Research Lab | Cognitive Biases",
  description: "Public research maturity tracker, preregistered protocols, experiment kits and reproducible artifacts from Cognitive Biases.",
  path: "/research/lab/",
  eyebrow: "Open research workflow",
  heading: "From interesting idea to result — with the missing steps left visible.",
  intro: "The lab tracks project research by maturity. A protocol is not a result, one run is not a replication, and an external paper is not evidence that our own experiment succeeded.",
  schemaType: "CollectionPage",
  body: `<h2>Five stages, one simple rule</h2><p>Scientific certainty and project maturity are different things. A strong external literature can motivate a new test, but our tracker advances only when the project publishes the matching artifact.</p><div class="feature-list">${stageCards}</div><h2>Project studies with public methods</h2><p>These tracks already have concrete study artifacts. Their methods are public before the project promotes an outcome.</p>${studyCards}<h2>All current research tracks</h2><p>Some tracks have a reusable protocol but no run yet. Others are still hypotheses. Keeping that difference visible is part of the product.</p><div class="feature-list">${trackCards}</div><h2>What counts as a project result?</h2><p>A result needs the method, model or participant metadata, raw or summary data, a reproducible scoring rule, uncertainty, limitations and any deviations from the protocol. A screenshot, one interesting output or a supporting external paper does not pass this gate.</p><h2>Reproduce or challenge a protocol</h2><p>You can inspect the public instruments and machine-readable files, run a compatible comparison, and report where the protocol breaks. A useful contribution can be a replication, a null result, a better control condition or evidence that the question was framed badly.</p><p><a class="button" href="/data/research-lab.json">Research Lab JSON</a> <a class="button button--dark" href="/ai-era/tracker/">AI-era tracker</a></p>`
}));

const researchLab = {
  version: 1,
  updatedAt: tracker.updatedAt,
  canonicalUrl: `${SITE}/research/lab/`,
  interpretationRule: tracker.interpretationRule,
  resultGate: "Project result stage requires methods, raw or summary data, reproducible scoring, uncertainty, limitations and documented protocol deviations. External papers alone do not advance a project track.",
  stageOrder: tracker.stageOrder,
  stageDefinitions: tracker.stageDefinitions,
  tracks: tracker.entries.map((entry) => ({
    track: entry.track,
    name: entry.name,
    stage: entry.stage,
    whyItMatters: entry.whyItMatters,
    nextMilestone: entry.nextMilestone,
    protocolSlugs: entry.protocolSlugs || [],
    studyArtifacts: entry.studyArtifacts || [],
    studyIds: studies.filter((study) => study.track === entry.track).map((study) => study.studyId)
  })),
  studies: studies.map((study) => ({
    studyId: study.studyId,
    title: study.title,
    status: study.status,
    track: study.track,
    researchQuestion: study.researchQuestion,
    hypothesis: study.hypothesis,
    canonicalUrl: study.canonicalUrl || null,
    instrumentUrl: study.instrumentUrl || null
  }))
};

await emit("/data/", page({
  title: "Cognitive Biases Knowledge Dataset | Data",
  description: "Download the Cognitive Biases knowledge dataset: concepts, evidence reviews, decision contexts, comparisons and research notes from the maintained public library.",
  path: "/data/",
  eyebrow: "Public data",
  heading: "Cognitive Biases Knowledge Dataset",
  intro: "This is a downloadable version of the library. It keeps the same concepts, evidence reviews, links and review status as the pages people read on the website.",
  body: `<h2>What is included</h2><p>The current release includes ${biases.length} published concepts, ${evidence.length} evidence reviews, ${countEntries(contexts)} decision contexts and ${countEntries(comparisons)} reviewed comparisons. A record can link back to its public page, so people and tools can check the explanation and sources behind it.</p><h2>What the review status means</h2><p>Some older entries are still waiting for evidence review. We keep that difference visible in the data instead of presenting the whole collection as equally verified.</p><h2>For assistants and agents</h2><p>An assistant can use the files to find a relevant concept, compare nearby ideas, check reviewed evidence and point a person back to a readable source page. The data is another view of the same maintained knowledge, not a separate version of the truth.</p><h2>For researchers and builders</h2><p>You can use the release for search, educational tools, experiments and integrations that fit the licence. The <a href="/data/research-lab.json">Research Lab dataset</a> also exposes project stages, study IDs, protocols and next milestones so tools do not confuse a hypothesis with a result.</p><h2>Download the files</h2><p><a href="/data/biases.json">Concept library</a><br><a href="/data/evidence.json">Evidence reviews</a><br><a href="/data/contexts.json">Decision contexts</a><br><a href="/data/comparisons.json">Comparisons</a><br><a href="/data/research-notes.json">Research notes</a><br><a href="/data/research-lab.json">Research Lab maturity data</a><br><a href="/data/manifest.json">Release information</a></p><h2>Licence</h2><p>The current public content follows the licence in the repository. Attribution and non-commercial reuse conditions still apply. Please check the licence before redistributing or adapting the material.</p>`
}));

await emit("/partners/", page({
  title: "Partnerships | Cognitive Biases",
  description: "Ways to contribute research, translations, decision-making cases and useful integrations to Cognitive Biases.",
  path: "/partners/",
  eyebrow: "Work with the project",
  heading: "Useful contributions beat vague partnerships.",
  intro: "We are open to people and teams who can make the library more accurate, more useful or easier to reuse.",
  body: `<h2>Research review</h2><p>If you work on judgment, decision making, behavioural science or human interaction with AI, you can help us review a concept, challenge a weak claim or point us to evidence we have missed.</p><h2>Translations</h2><p>We plan to support more languages without creating separate versions of the truth. Native speakers and subject-matter reviewers can help us keep translated pages natural while preserving the meaning of reviewed evidence.</p><h2>Real decision cases</h2><p>We are interested in practical situations where several biases can pull a decision in different directions: forecasting, product work, incident response, hiring, experiments and decisions made with AI.</p><h2>Data and agent integrations</h2><p>If you use this library in a search tool, assistant, agent or research project, tell us what worked and what was missing. We would rather improve the data around real use than invent features in isolation.</p><h2>Contact</h2><p>Email <a href="mailto:metalhatscats@gmail.com?subject=Cognitive%20Biases%20partnership">metalhatscats@gmail.com</a> with a short description of what you would like to contribute or build.</p>`
}));

await mkdir(join(OUT, "data"), { recursive: true });
await writeFile(join(OUT, "data", "biases.json"), `${JSON.stringify(biases, null, 2)}\n`);
await writeFile(join(OUT, "data", "evidence.json"), `${JSON.stringify({version:1,updatedAt:TODAY,reviews:evidence}, null, 2)}\n`);
await writeFile(join(OUT, "data", "contexts.json"), `${JSON.stringify(contexts, null, 2)}\n`);
await writeFile(join(OUT, "data", "comparisons.json"), `${JSON.stringify(comparisons, null, 2)}\n`);
await writeFile(join(OUT, "data", "research-lab.json"), `${JSON.stringify(researchLab, null, 2)}\n`);
await writeFile(join(OUT, "data", "manifest.json"), `${JSON.stringify({name:"Cognitive Biases Knowledge Dataset",version:1,generatedAt:TODAY,website:SITE,licence:"CC BY-NC-SA 4.0",counts:{concepts:biases.length,evidenceReviews:evidence.length,comparisons:countEntries(comparisons),contexts:countEntries(contexts),researchTracks:tracker.entries.length,projectStudies:studies.length},files:{concepts:`${SITE}/data/biases.json`,evidence:`${SITE}/data/evidence.json`,contexts:`${SITE}/data/contexts.json`,comparisons:`${SITE}/data/comparisons.json`,researchLab:`${SITE}/data/research-lab.json`}}, null, 2)}\n`);

console.log(`Generated Research, Research Lab, Data and Partnerships pages with ${biases.length} concepts, ${evidence.length} evidence reviews, ${tracker.entries.length} research tracks and ${studies.length} project studies.`);
