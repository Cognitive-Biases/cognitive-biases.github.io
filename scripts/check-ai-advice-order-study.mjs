import { readFile } from "node:fs/promises";

const study = JSON.parse(await readFile("data/studies/ai-advice-order-v1.json", "utf8"));
const protocols = JSON.parse(await readFile("data/ai-era-experiment-protocols.json", "utf8"));
const tracker = JSON.parse(await readFile("data/ai-era-research-tracker.json", "utf8"));
const schema = JSON.parse(await readFile("schemas/ai-advice-order-session.schema.json", "utf8"));
const researchHtml = await readFile("dist/research/ai-advice-order-v1/index.html", "utf8");
const instrumentHtml = await readFile("dist/experiments/ai-advice-order-v1/index.html", "utf8");
const clientJs = await readFile("dist/assets/ai-advice-order-v1.js", "utf8");
const publicStudy = JSON.parse(await readFile("dist/data/studies/ai-advice-order-v1.json", "utf8"));
const publicSchema = JSON.parse(await readFile("dist/schemas/ai-advice-order-session.schema.json", "utf8"));
const sitemap = await readFile("dist/sitemap.xml", "utf8");

const fail = (message) => { throw new Error(`AI Advice Order study check failed: ${message}`); };
if (study.studyId !== "ai-advice-order-v1") fail("unexpected studyId");
if (study.status !== "preregistered-pilot") fail("study status must remain preregistered-pilot before a real result release");
if (study.samplePlan?.targetCompletedParticipants !== 40) fail("pilot target N must remain frozen at 40 unless the preregistration version changes");
if (!Array.isArray(study.tasks) || study.tasks.length !== 6) fail("exactly six preregistered tasks are required");
const taskIds = new Set();
for (const task of study.tasks) {
  if (!task.id || taskIds.has(task.id)) fail(`duplicate or missing task id: ${task.id}`);
  taskIds.add(task.id);
  if (![task.referenceValue, task.lowAnchor, task.highAnchor].every(Number.isFinite)) fail(`${task.id}: reference and anchors must be numeric`);
  if (!(task.lowAnchor < task.referenceValue && task.referenceValue < task.highAnchor)) fail(`${task.id}: reference must sit between low and high anchors`);
  if (!/^https:\/\//.test(task.sourceUrl || "")) fail(`${task.id}: authoritative source URL required`);
}
const protocol = protocols.protocols?.find((item) => item.slug === study.protocol);
if (!protocol || protocol.track !== study.track) fail("study must resolve to the published AI Advice Order protocol and track");
const trackEntry = tracker.entries?.find((item) => item.track === study.track);
if (!trackEntry) fail("research tracker entry missing");
if (trackEntry.stage !== "protocol") fail("tracker must remain at protocol stage until a documented run exists");
if (tracker.stageOrder.indexOf(trackEntry.stage) >= tracker.stageOrder.indexOf("result")) fail("tracker cannot claim a result before empirical data exists");
if (schema.properties?.studyId?.const !== study.studyId) fail("session schema study id mismatch");
if (publicStudy.studyId !== study.studyId || publicStudy.status !== study.status) fail("public preregistration copy mismatch");
if (publicSchema.$id !== schema.$id) fail("public session schema copy mismatch");
if (!researchHtml.includes("Status: preregistered, no project result yet")) fail("research page must state that no project result exists");
if (!researchHtml.includes(study.primaryOutcome.formula.replaceAll("<", "&lt;").replaceAll(">", "&gt;")) && !researchHtml.includes("normalized anchor alignment")) fail("research page must expose the frozen primary outcome");
if (!instrumentHtml.includes("No automatic upload")) fail("instrument must state the local-only data boundary");
if (!instrumentHtml.includes("/assets/ai-advice-order-v1.js")) fail("participant instrument asset missing");
if (/\bfetch\s*\(/.test(clientJs) || /XMLHttpRequest/.test(clientJs) || /sendBeacon/.test(clientJs)) fail("participant instrument must not contain network upload primitives");
for (const path of ["/research/ai-advice-order-v1/", "/experiments/ai-advice-order-v1/"]) {
  if (!sitemap.includes(`https://cognitive-biases.github.io${path}`)) fail(`${path} missing from sitemap`);
}
console.log("AI Advice Order study checks passed: preregistration, instrument, privacy boundary, tracker gate and public data are consistent.");
