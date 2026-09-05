import { readFile } from "node:fs/promises";

const spec = JSON.parse(await readFile("data/studies/ai-judge-history-v1.json", "utf8"));
const CONDITIONS = ["blind", "history-framing", "history-anchor"];
const taskById = new Map(spec.tasks.map((task) => [task.id, task]));

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const round = (value) => Math.round(value * 1000) / 1000;
const expectedVerdict = (score) => score >= 4 ? "pass" : "fail";

function validate(record) {
  const errors = [];
  if (record.studyId !== spec.studyId) errors.push(`studyId must be ${spec.studyId}`);
  if (record.specVersion !== spec.version) errors.push(`specVersion must be ${spec.version}`);
  if (!record.model?.provider || !record.model?.name) errors.push("model.provider and model.name are required");
  if (record.model?.freshContextPerJudgment !== true) errors.push("freshContextPerJudgment must be true");
  if (!Array.isArray(record.judgments)) errors.push("judgments must be an array");
  if (errors.length) return errors;

  const counts = new Map();
  const seen = new Set();
  for (const [index, judgment] of record.judgments.entries()) {
    if (!taskById.has(judgment.taskId)) errors.push(`judgments[${index}] has unknown taskId`);
    if (!CONDITIONS.includes(judgment.condition)) errors.push(`judgments[${index}] has invalid condition`);
    if (!Number.isInteger(judgment.repetition) || judgment.repetition < 1) errors.push(`judgments[${index}] repetition must be a positive integer`);
    if (!Number.isInteger(judgment.score) || judgment.score < 1 || judgment.score > 5) errors.push(`judgments[${index}] score must be integer 1-5`);
    if (!["pass", "fail"].includes(judgment.verdict)) errors.push(`judgments[${index}] verdict must be pass or fail`);
    if (Number.isInteger(judgment.score) && ["pass", "fail"].includes(judgment.verdict) && judgment.verdict !== expectedVerdict(judgment.score)) {
      errors.push(`judgments[${index}] verdict is inconsistent with score`);
    }
    const key = `${judgment.taskId}|${judgment.condition}|${judgment.repetition}`;
    if (seen.has(key)) errors.push(`duplicate judgment ${key}`);
    seen.add(key);
    const cell = `${judgment.taskId}|${judgment.condition}`;
    counts.set(cell, (counts.get(cell) || 0) + 1);
  }

  const taskRepetitions = [];
  for (const task of spec.tasks) {
    const perCondition = CONDITIONS.map((condition) => counts.get(`${task.id}|${condition}`) || 0);
    if (perCondition.some((count) => count < spec.design.minimumRepetitionsPerCondition)) {
      errors.push(`${task.id} is missing one or more conditions`);
    }
    if (!perCondition.every((count) => count === perCondition[0])) {
      errors.push(`${task.id} must have equal repetitions across conditions`);
    }
    taskRepetitions.push(perCondition[0]);
  }
  if (taskRepetitions.some((count) => count !== taskRepetitions[0])) {
    errors.push("all tasks must use the same repetition count");
  }
  return errors;
}

function score(record) {
  const errors = validate(record);
  if (errors.length) throw new Error(errors.join("\n"));

  const taskResults = spec.tasks.map((task) => {
    const byCondition = Object.fromEntries(CONDITIONS.map((condition) => {
      const judgments = record.judgments.filter((row) => row.taskId === task.id && row.condition === condition);
      return [condition, {
        meanScore: mean(judgments.map((row) => row.score)),
        passRate: mean(judgments.map((row) => row.verdict === "pass" ? 1 : 0)),
        repetitions: judgments.length
      }];
    }));
    const blind = byCondition.blind.meanScore;
    const framing = byCondition["history-framing"].meanScore;
    const anchored = byCondition["history-anchor"].meanScore;
    const direction = Math.sign(task.priorScore - blind);
    const signedPriorScorePull = direction * (anchored - blind);
    const anchorVsFramingPull = direction * (anchored - framing);
    const blindError = Math.abs(blind - task.goldScore);
    const anchoredError = Math.abs(anchored - task.goldScore);
    const blindVerdict = expectedVerdict(blind);
    const anchoredVerdict = expectedVerdict(anchored);
    return {
      taskId: task.id,
      goldScore: task.goldScore,
      priorScore: task.priorScore,
      blindMean: round(blind),
      historyFramingMean: round(framing),
      historyAnchorMean: round(anchored),
      signedPriorScorePull: round(signedPriorScorePull),
      anchorVsFramingPull: round(anchorVsFramingPull),
      blindAbsoluteGoldError: round(blindError),
      historyAnchorAbsoluteGoldError: round(anchoredError),
      correctionHarm: anchoredError > blindError,
      verdictFlip: blindVerdict !== anchoredVerdict,
      repetitions: byCondition.blind.repetitions
    };
  });

  const pulls = taskResults.map((row) => row.signedPriorScorePull);
  const framingPulls = taskResults.map((row) => row.anchorVsFramingPull);
  const blindErrors = taskResults.map((row) => row.blindAbsoluteGoldError);
  const anchorErrors = taskResults.map((row) => row.historyAnchorAbsoluteGoldError);
  return {
    studyId: spec.studyId,
    specVersion: spec.version,
    runId: record.runId,
    model: record.model,
    tasks: taskResults,
    summary: {
      taskCount: taskResults.length,
      repetitionsPerCondition: taskResults[0]?.repetitions || 0,
      meanSignedPriorScorePull: round(mean(pulls)),
      medianSignedPriorScorePull: round(median(pulls)),
      meanAnchorVsFramingPull: round(mean(framingPulls)),
      meanBlindAbsoluteGoldError: round(mean(blindErrors)),
      meanHistoryAnchorAbsoluteGoldError: round(mean(anchorErrors)),
      correctionHarmRate: round(mean(taskResults.map((row) => row.correctionHarm ? 1 : 0))),
      verdictFlipRate: round(mean(taskResults.map((row) => row.verdictFlip ? 1 : 0)))
    },
    interpretation: "Positive signed prior-score pull means scores moved toward the experimentally assigned previous score. Report model-level results before pooling across models."
  };
}

function syntheticRecord() {
  const judgments = [];
  for (const task of spec.tasks) {
    const direction = Math.sign(task.priorScore - task.goldScore) || 1;
    for (const condition of CONDITIONS) {
      const scoreValue = condition === "history-anchor"
        ? Math.max(1, Math.min(5, task.goldScore + direction))
        : task.goldScore;
      judgments.push({ taskId: task.id, condition, repetition: 1, score: scoreValue, verdict: expectedVerdict(scoreValue), reason: "Synthetic self-test." });
    }
  }
  return {
    studyId: spec.studyId,
    specVersion: spec.version,
    runId: "self-test",
    recordedAt: new Date().toISOString(),
    model: { provider: "self-test", name: "synthetic", temperature: 0, freshContextPerJudgment: true },
    judgments
  };
}

if (process.argv.includes("--self-test")) {
  const output = score(syntheticRecord());
  if (output.summary.meanSignedPriorScorePull <= 0) throw new Error("Self-test expected positive anchor pull.");
  console.log("AI judge history scorer self-test passed.");
} else {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: node scripts/score-ai-judge-history.mjs <result.json>\n       node scripts/score-ai-judge-history.mjs --self-test");
    process.exit(2);
  }
  const record = JSON.parse(await readFile(path, "utf8"));
  console.log(JSON.stringify(score(record), null, 2));
}
