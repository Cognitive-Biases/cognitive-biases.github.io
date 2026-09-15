import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const summary = JSON.parse(await readFile("research/studies/study-001/result/summary.json", "utf8"));
const tracker = JSON.parse(await readFile("data/ai-era-research-tracker.json", "utf8"));
const fail = (message) => { throw new Error(`Study 001 check failed: ${message}`); };

if (summary.study_id !== "study-001") fail("wrong study id");
if (summary.study_type !== "independent re-analysis of public model outputs") fail("study type must preserve re-analysis boundary");
if (summary.source?.source_commit !== "0083e9ec780469d91d52c5411e59d0efbd82fe9e") fail("source commit is not pinned to the reviewed dataset");
if (summary.preregistered_primary_outcome !== "Question-level direction alignment between anchor delta (B-A) and trimmed mean model-response delta (B-A).") fail("primary outcome changed after preregistration");
if (summary.overall?.question_model_pairs !== 248 || summary.overall?.direction_aligned !== 185) fail("published primary counts do not match verified workflow output");
if (summary.sensitivity_unambiguous_anchors?.question_model_pairs !== 144 || summary.sensitivity_unambiguous_anchors?.direction_aligned !== 116) fail("sensitivity counts do not match verified workflow output");
if (!Array.isArray(summary.limitations) || summary.limitations.length < 4) fail("limitations are missing");

const entry = tracker.entries?.find((item) => item.track === "ai-anchoring-loop");
if (!entry) fail("AI Anchoring Loop tracker entry is missing");
if (entry.stage !== "protocol") fail("external-data re-analysis must not promote the human-AI track beyond protocol");
if (!entry.supportingArtifacts?.some((item) => item.id === "study-001" && item.kind === "independent re-analysis")) fail("tracker does not expose Study 001 as supporting evidence");

const page = await readFile(join(OUT, "research", "studies", "study-001", "index.html"), "utf8");
for (const expected of [
  "Does the answer move with the anchor?",
  "74.6% moved with the anchor.",
  "80.6%",
  "Independent re-analysis",
  "does not yet test the full human → AI → human loop",
  "/data/studies/study-001/summary.json",
  "/data/studies/study-001/question-level.csv",
  "0083e9ec780469d91d52c5411e59d0efbd82fe9e"
]) if (!page.includes(expected)) fail(`page is missing: ${expected}`);

for (const path of [
  join(OUT, "data", "studies", "study-001", "summary.json"),
  join(OUT, "data", "studies", "study-001", "question-level.csv")
]) {
  const info = await stat(path);
  if (!info.isFile() || info.size < 100) fail(`public data file missing or too small: ${path}`);
}

const publicSummary = JSON.parse(await readFile(join(OUT, "data", "studies", "study-001", "summary.json"), "utf8"));
if (publicSummary.overall.direction_alignment_rate !== summary.overall.direction_alignment_rate) fail("public summary differs from source result");

const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
if (!sitemap.includes("https://cognitive-biases.github.io/research/studies/study-001/")) fail("study page is absent from sitemap");

const research = await readFile(join(OUT, "research", "index.html"), "utf8");
if (!research.includes("/research/studies/study-001/")) fail("research hub does not link Study 001");

const trackerPage = await readFile(join(OUT, "ai-era", "tracker", "index.html"), "utf8");
if (!trackerPage.includes("study-001-supporting-result") || !trackerPage.includes("does not advance the project stage beyond protocol")) fail("tracker page does not preserve Study 001 boundary");

const llms = await readFile(join(OUT, "llms.txt"), "utf8");
if (!llms.includes("Study 001 anchoring re-analysis:") || !llms.includes("not a fresh model run and not evidence of a human effect")) fail("AI consumer guidance is missing Study 001 boundary");

console.log("Study 001 publication checks passed.");
