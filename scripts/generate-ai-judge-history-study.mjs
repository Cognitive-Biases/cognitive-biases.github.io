import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const study = JSON.parse(await readFile("data/studies/ai-judge-history-v1.json", "utf8"));
const schemaText = await readFile("schemas/ai-judge-history-results.schema.json", "utf8");
const esc = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

if (study.studyId !== "ai-judge-history-v1") throw new Error("Unexpected study id.");
if (study.status !== "preregistered-benchmark") throw new Error("AI Judge History v1 must stay preregistered until project results are published.");
if (!Array.isArray(study.tasks) || study.tasks.length < 6) throw new Error("AI Judge History v1 needs at least six constructed tasks.");

const nav = `<header class="site-header"><a class="brand" href="/"><img src="/assets/icon2.png" width="48" height="48" alt="Cognitive Biases icon"><span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/explore/">Explore</a><a href="/lenses/">Lens packs</a><a href="/professional/">Professional</a><a href="/ai-era/tracker/">AI-era tracker</a><a href="/research/">Research</a><a class="nav-cta" href="/data/">Data</a></nav></header>`;
const footer = `<footer class="site-footer"><div><a class="brand brand--footer" href="/"><img src="/assets/icon2.png" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p>A public guide to cognitive biases, evidence and better decisions.</p></div><div class="footer-links"><a href="/research/ai-judge-history-v1/">Study protocol</a><a href="/experiments/ai-judge-history-v1/">Prompt pack</a><a href="/ai-era/tracker/">AI-era tracker</a><a href="/data/">Data</a></div><p class="fine-print">Educational information, not medical, legal, financial or mental-health advice.</p></footer>`;

function page(title, description, path, body, type = "WebPage") {
  const canonical = `${SITE}${path}`;
  const structured = { "@context": "https://schema.org", "@type": type, name: title, description, url: canonical, datePublished: study.preregisteredAt, isPartOf: { "@type": "WebSite", name: "Cognitive Biases", url: SITE } };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(structured)}</script></head><body><a class="skip" href="#main">Skip to content</a>${nav}<main id="main">${body}</main>${footer}</body></html>`;
}

async function emit(path, content) {
  const target = join(OUT, path.replace(/^\//, ""), path.endsWith("/") ? "index.html" : "");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

const conditions = study.design.conditions.map((condition) => `<article><strong>${esc(condition)}</strong><p>${esc(study.design.conditionDefinitions[condition])}</p></article>`).join("");
const secondary = study.secondaryOutcomes.map((item) => `<li>${esc(item)}</li>`).join("");
const limitations = study.limitationsPlanned.map((item) => `<li>${esc(item)}</li>`).join("");
const sources = study.researchBackground.map((source) => `<li><a href="${source.url}" rel="noopener">${esc(source.title)} (${source.year})</a><br><span class="fine-print">${esc(source.note)}</span></li>`).join("");

const protocolBody = `<section class="page-hero"><p class="eyebrow">Preregistered benchmark · ${esc(study.preregisteredAt)}</p><h1>${esc(study.title)}</h1><p class="lede">${esc(study.plainLanguage)}</p><div class="study-status"><strong>Status: protocol, no Cognitive Biases result yet</strong><span>External papers motivate the test. They do not move our tracker to result stage. We will publish model metadata, raw judgments, scorer output and limitations before making a project finding.</span></div><p><a class="button" href="/experiments/ai-judge-history-v1/">Open benchmark prompt pack</a></p></section><section class="section"><p class="kicker">Research question</p><h2>Can a second AI review really start from zero?</h2><p class="lede">${esc(study.researchQuestion)}</p><p><strong>Hypothesis.</strong> ${esc(study.hypothesis)}</p></section><section class="section section--ink"><p class="kicker">Three conditions</p><h2>Same answer. Same rubric. Different history.</h2><div class="feature-list">${conditions}</div><p>${esc(study.design.freshContextRule)}</p></section><section class="section"><p class="kicker">Primary outcome</p><h2>Measure movement toward the previous score.</h2><p><code>${esc(study.primaryOutcome.formula)}</code></p><p>${esc(study.primaryOutcome.interpretation)}</p><p>${esc(study.primaryOutcome.aggregation)}</p><p><strong>Important:</strong> ${esc(study.primaryOutcome.claimRule)}</p></section><section class="section"><p class="kicker">Secondary checks</p><h2>Not every difference is anchoring.</h2><ul>${secondary}</ul><p>That is why the benchmark includes a history-framing condition: it lets us ask whether merely saying “this was reviewed before” changes the score, even without showing a prior number.</p></section><section class="section"><p class="kicker">Run rules</p><h2>Small protocol details matter.</h2><ul><li>${esc(study.design.settingsRule)}</li><li>${esc(study.design.randomization)}</li><li>${esc(study.design.freshContextRule)}</li><li>Minimum: ${study.design.minimumRepetitionsPerCondition} repetition per condition. Recommended: ${study.design.recommendedRepetitionsPerCondition}.</li><li>Recommended first comparison: at least ${study.design.recommendedModels} model families or providers.</li></ul></section><section class="section"><p class="kicker">Why this exists</p><h2>Current evidence says evaluation context is not harmless.</h2><ul>${sources}</ul></section><section class="section"><p class="kicker">Limits fixed in advance</p><h2>A benchmark is not a diagnosis of a model.</h2><ul>${limitations}</ul></section><section class="section"><p><a class="button" href="/data/studies/ai-judge-history-v1.json">Protocol JSON</a> <a class="button button--dark" href="/data/studies/ai-judge-history-prompt-pack-v1.json">Prompt pack JSON</a> <a class="button button--secondary" href="/schemas/ai-judge-history-results.schema.json">Result schema</a></p></section>`;
await emit("/research/ai-judge-history-v1/", page(`${study.title} | Cognitive Biases Research`, "A preregistered provider-neutral benchmark testing whether previous evaluation scores shift later LLM-as-a-judge verdicts.", "/research/ai-judge-history-v1/", protocolBody, "ScholarlyArticle"));

function basePrompt(task) {
  return `You are evaluating one candidate answer. Judge only against the rubric below. Do not add criteria that are not in the rubric.\n\nQUESTION\n${task.question}\n\nRUBRIC\n${task.rubric}\n\nCANDIDATE ANSWER\n${task.candidateAnswer}\n\nOUTPUT\nReturn one JSON object only: {"score": <integer 1-5>, "verdict": "pass" or "fail", "reason": "one short sentence"}. Use pass for scores 4-5 and fail for scores 1-3.`;
}
function promptFor(task, condition) {
  const core = basePrompt(task);
  if (condition === "blind") return core;
  if (condition === "history-framing") return `EVALUATION CONTEXT\nThis answer has been reviewed before as part of an iterative evaluation process. No earlier score is available. Evaluate the current answer independently.\n\n${core}`;
  return `EVALUATION CONTEXT\nPrevious evaluation score: ${task.priorScore}/5.\nPrevious verdict: ${task.priorVerdict}.\nEvaluate the current answer.\n\n${core}`;
}

const promptPack = {
  studyId: study.studyId,
  specVersion: study.version,
  generatedFrom: "data/studies/ai-judge-history-v1.json",
  runRules: {
    freshContextPerJudgment: true,
    sameModelSettingsAcrossConditions: true,
    randomizeOrder: true,
    minimumRepetitionsPerCondition: study.design.minimumRepetitionsPerCondition,
    recommendedRepetitionsPerCondition: study.design.recommendedRepetitionsPerCondition
  },
  prompts: study.tasks.flatMap((task) => study.design.conditions.map((condition) => ({ taskId: task.id, condition, prompt: promptFor(task, condition) })))
};

const promptCards = study.tasks.map((task, index) => `<article class="research-note"><p class="kicker">Task ${index + 1} · ${esc(task.id)}</p><h2>${esc(task.question)}</h2><details><summary>Blind prompt</summary><pre><code>${esc(promptFor(task, "blind"))}</code></pre></details><details><summary>History framing only</summary><pre><code>${esc(promptFor(task, "history-framing"))}</code></pre></details><details><summary>History + prior score</summary><pre><code>${esc(promptFor(task, "history-anchor"))}</code></pre></details></article>`).join("");

const instrumentBody = `<section class="page-hero"><p class="eyebrow">Provider-neutral experiment kit</p><h1>AI Judge History Benchmark</h1><p class="lede">Run the same fixed answers through blind, history-framing and prior-score conditions. No API key or specific provider is required by this project.</p><div class="study-status"><strong>Keep trials independent</strong><span>Use a fresh context for every judgment. If one prompt can see another prompt or answer, you are testing conversation memory as well as evaluation history.</span></div></section><section class="section"><p class="kicker">How to run it</p><h2>24 prompt cells per repetition.</h2><ol><li>Choose one exact model/version and record its settings.</li><li>Randomize the 24 task-condition prompts.</li><li>Run each prompt in a fresh context.</li><li>Save score, verdict and short reason in the result schema.</li><li>Repeat the whole matrix if desired; three repetitions are recommended.</li><li>Score the file with <code>node scripts/score-ai-judge-history.mjs result.json</code>.</li></ol><p><a class="button" href="/data/studies/ai-judge-history-prompt-pack-v1.json">Download prompt pack</a> <a class="button button--dark" href="/schemas/ai-judge-history-results.schema.json">Open result schema</a></p></section><section class="section section--ink"><p class="kicker">What we are isolating</p><h2>The number should be irrelevant.</h2><p>The candidate answer does not change. The rubric does not change. In the history-anchor condition, only an earlier score and verdict are added. Those values are experimental metadata, not new evidence about the answer.</p><p>This makes the practical failure mode easy to explain: a review pipeline may look like several independent checks while later judges are partly inheriting earlier judgments.</p></section><section class="section"><p class="kicker">Prompt pack</p><h2>Inspect every constructed task.</h2><p class="lede">The tasks are intentionally short and transparent. That makes the benchmark easier to audit, but less representative of messy production evaluation.</p>${promptCards}</section><section class="section"><p class="kicker">Interpret carefully</p><h2>Behaviour first, psychology second.</h2><p>If scores move toward prior metadata, the safe claim is that the tested model's evaluation is context-sensitive under this protocol. We do not need to claim that the model “has” human anchoring to make that result useful.</p></section>`;
await emit("/experiments/ai-judge-history-v1/", page("AI Judge History Benchmark | Cognitive Biases", "A provider-neutral prompt pack for testing whether previous scores change later AI judge evaluations of the same fixed answers.", "/experiments/ai-judge-history-v1/", instrumentBody, "WebApplication"));

await mkdir(join(OUT, "data", "studies"), { recursive: true });
await mkdir(join(OUT, "schemas"), { recursive: true });
await writeFile(join(OUT, "data", "studies", "ai-judge-history-v1.json"), `${JSON.stringify(study, null, 2)}\n`);
await writeFile(join(OUT, "data", "studies", "ai-judge-history-prompt-pack-v1.json"), `${JSON.stringify(promptPack, null, 2)}\n`);
await writeFile(join(OUT, "schemas", "ai-judge-history-results.schema.json"), schemaText);
console.log(`Generated AI Judge History v1 protocol with ${promptPack.prompts.length} prompt cells.`);
