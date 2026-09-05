import { access, readFile } from "node:fs/promises";

const spec = JSON.parse(await readFile("data/studies/ai-judge-history-v1.json", "utf8"));
const requiredConditions = ["blind", "history-framing", "history-anchor"];
const errors = [];

if (spec.studyId !== "ai-judge-history-v1") errors.push("Unexpected study id.");
if (spec.status !== "preregistered-benchmark") errors.push("Study must remain preregistered-benchmark before project results exist.");
if (!Array.isArray(spec.tasks) || spec.tasks.length < 6) errors.push("At least six constructed tasks are required.");
if (JSON.stringify(spec.design?.conditions) !== JSON.stringify(requiredConditions)) errors.push("Condition order or names changed unexpectedly.");

const ids = new Set();
for (const task of spec.tasks || []) {
  if (!task.id || ids.has(task.id)) errors.push(`Duplicate or missing task id: ${task.id}`);
  ids.add(task.id);
  for (const field of ["question", "rubric", "candidateAnswer"]) if (!task[field]) errors.push(`${task.id} missing ${field}`);
  if (!Number.isInteger(task.goldScore) || task.goldScore < 1 || task.goldScore > 5) errors.push(`${task.id} invalid goldScore`);
  if (!Number.isInteger(task.priorScore) || task.priorScore < 1 || task.priorScore > 5) errors.push(`${task.id} invalid priorScore`);
  if (task.goldScore === task.priorScore) errors.push(`${task.id} priorScore must differ from goldScore`);
  const expectedPriorVerdict = task.priorScore >= 4 ? "pass" : "fail";
  if (task.priorVerdict !== expectedPriorVerdict) errors.push(`${task.id} priorVerdict inconsistent with priorScore`);
}

const files = [
  "dist/research/ai-judge-history-v1/index.html",
  "dist/experiments/ai-judge-history-v1/index.html",
  "dist/data/studies/ai-judge-history-v1.json",
  "dist/data/studies/ai-judge-history-prompt-pack-v1.json",
  "dist/schemas/ai-judge-history-results.schema.json"
];
for (const file of files) {
  try { await access(file); } catch { errors.push(`Missing generated file: ${file}`); }
}

try {
  const protocol = await readFile("dist/research/ai-judge-history-v1/index.html", "utf8");
  for (const phrase of ["no Cognitive Biases result yet", "signed prior-score pull", "Same answer. Same rubric. Different history."]) {
    if (!protocol.includes(phrase)) errors.push(`Protocol page missing phrase: ${phrase}`);
  }
  const instrument = await readFile("dist/experiments/ai-judge-history-v1/index.html", "utf8");
  if (!instrument.includes("24 prompt cells per repetition")) errors.push("Experiment page missing run-size guidance.");
  if (!instrument.includes("fresh context")) errors.push("Experiment page missing fresh-context warning.");
  const pack = JSON.parse(await readFile("dist/data/studies/ai-judge-history-prompt-pack-v1.json", "utf8"));
  const expectedPromptCount = spec.tasks.length * requiredConditions.length;
  if (pack.prompts?.length !== expectedPromptCount) errors.push(`Prompt pack expected ${expectedPromptCount} prompts.`);
} catch (error) {
  errors.push(`Generated artifact check failed: ${error.message}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`AI Judge History v1 checks passed for ${spec.tasks.length} tasks.`);
