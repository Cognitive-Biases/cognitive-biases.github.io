import { readFile, writeFile } from "node:fs/promises";

const STUDY_ID = "ai-advice-order-v1";
const TARGET_N = 40;
const BOOTSTRAP_N = 5000;
const SEED = 20260821;

const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const round = (value, digits = 6) => value === null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
function prng(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index), hi = Math.ceil(index);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}
function bootstrapMeanCi(values, resamples = BOOTSTRAP_N, seed = SEED) {
  if (!values.length) return [null, null];
  const random = prng(seed), samples = [];
  for (let i = 0; i < resamples; i++) {
    let sum = 0;
    for (let j = 0; j < values.length; j++) sum += values[Math.floor(random() * values.length)];
    samples.push(sum / values.length);
  }
  return [percentile(samples, 0.025), percentile(samples, 0.975)];
}
function metric(response) {
  const final = Number(response.finalEstimate), reference = Number(response.referenceValue), anchor = Number(response.anchor);
  if (![final, reference, anchor].every(Number.isFinite) || anchor === reference) return null;
  const initial = response.initialEstimate === null || response.initialEstimate === undefined ? null : Number(response.initialEstimate);
  const anchorAlignment = (final - reference) / (anchor - reference);
  const absRelativeError = reference === 0 ? null : Math.abs(final - reference) / Math.abs(reference);
  let weightOfAdvice = null;
  if (response.orderCondition === "independent-first" && Number.isFinite(initial) && anchor !== initial) weightOfAdvice = (final - initial) / (anchor - initial);
  return { anchorAlignment, absRelativeError, weightOfAdvice };
}
function participantSummary(record, excludeKnown = false) {
  const responses = record.responses.filter((response) => !excludeKnown || !response.knownAnswer).map((response) => ({ response, metric: metric(response) })).filter((item) => item.metric);
  const byOrder = (order) => responses.filter((item) => item.response.orderCondition === order);
  const independent = byOrder("independent-first"), advice = byOrder("advice-first");
  if (!independent.length || !advice.length) return null;
  const independentAlignment = mean(independent.map((item) => item.metric.anchorAlignment));
  const adviceAlignment = mean(advice.map((item) => item.metric.anchorAlignment));
  return {
    participantId: record.participantId,
    independentTrials: independent.length,
    adviceFirstTrials: advice.length,
    independentAlignment,
    adviceFirstAlignment: adviceAlignment,
    contrast: adviceAlignment - independentAlignment,
    independentAbsRelativeError: mean(independent.map((item) => item.metric.absRelativeError).filter(Number.isFinite)),
    adviceFirstAbsRelativeError: mean(advice.map((item) => item.metric.absRelativeError).filter(Number.isFinite)),
    independentWeightOfAdvice: mean(independent.map((item) => item.metric.weightOfAdvice).filter(Number.isFinite)),
    independentFinalConfidence: mean(independent.map((item) => Number(item.response.finalConfidence)).filter(Number.isFinite)),
    adviceFirstFinalConfidence: mean(advice.map((item) => Number(item.response.finalConfidence)).filter(Number.isFinite))
  };
}
function validateRecord(record) {
  if (!record || record.studyId !== STUDY_ID) return false;
  if (!record.completedAt || !Array.isArray(record.responses) || record.responses.length !== 6) return false;
  const ids = new Set(record.responses.map((response) => response.taskId));
  if (ids.size !== 6) return false;
  const orders = record.responses.map((response) => response.orderCondition);
  if (orders.filter((value) => value === "independent-first").length !== 3 || orders.filter((value) => value === "advice-first").length !== 3) return false;
  return record.responses.every((response) => metric(response));
}
function analyse(records) {
  const valid = records.filter(validateRecord);
  const participants = valid.map((record) => participantSummary(record)).filter(Boolean);
  const contrasts = participants.map((item) => item.contrast);
  const ci = bootstrapMeanCi(contrasts);
  const knownSensitivity = valid.map((record) => participantSummary(record, true)).filter(Boolean);
  const knownContrasts = knownSensitivity.map((item) => item.contrast);
  const knownCi = bootstrapMeanCi(knownContrasts, BOOTSTRAP_N, SEED + 1);
  return {
    studyId: STUDY_ID,
    analysisPlan: "preregistered-pilot-v1",
    generatedAt: new Date().toISOString(),
    recordsReceived: records.length,
    completeValidParticipants: participants.length,
    excludedRecords: records.length - participants.length,
    targetCompletedParticipants: TARGET_N,
    targetMet: participants.length >= TARGET_N,
    primary: {
      measure: "participant mean advice-first normalized anchor alignment minus participant mean independent-first normalized anchor alignment",
      meanContrast: round(mean(contrasts)),
      medianContrast: round(median(contrasts)),
      bootstrap95Ci: ci.map((value) => round(value)),
      interpretation: "Positive values mean greater final alignment with the standardized AI-labelled anchor when advice was shown first. This output alone is not a project finding until reviewed and published with limitations."
    },
    secondary: {
      independentFirstMeanAnchorAlignment: round(mean(participants.map((item) => item.independentAlignment))),
      adviceFirstMeanAnchorAlignment: round(mean(participants.map((item) => item.adviceFirstAlignment))),
      independentFirstMeanAbsoluteRelativeError: round(mean(participants.map((item) => item.independentAbsRelativeError).filter(Number.isFinite))),
      adviceFirstMeanAbsoluteRelativeError: round(mean(participants.map((item) => item.adviceFirstAbsRelativeError).filter(Number.isFinite))),
      independentFirstMeanWeightOfAdvice: round(mean(participants.map((item) => item.independentWeightOfAdvice).filter(Number.isFinite))),
      independentFirstMeanFinalConfidence: round(mean(participants.map((item) => item.independentFinalConfidence).filter(Number.isFinite))),
      adviceFirstMeanFinalConfidence: round(mean(participants.map((item) => item.adviceFirstFinalConfidence).filter(Number.isFinite)))
    },
    knownAnswerSensitivity: {
      participantsWithBothConditionsAfterExclusion: knownSensitivity.length,
      meanContrast: round(mean(knownContrasts)),
      medianContrast: round(median(knownContrasts)),
      bootstrap95Ci: knownCi.map((value) => round(value))
    },
    publicationGate: {
      automaticPromotion: false,
      targetSampleMet: participants.length >= TARGET_N,
      requiredBeforeResultStage: ["human review of exclusions and scoring output", "anonymized data release or documented reason data cannot be public", "result narrative with uncertainty", "planned limitations and deviations from preregistration"]
    }
  };
}
async function loadRecords(paths) {
  const records = [];
  for (const path of paths) {
    const text = await readFile(path, "utf8");
    if (path.endsWith(".ndjson")) {
      for (const line of text.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) records.push(JSON.parse(line));
    } else {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) records.push(...parsed); else records.push(parsed);
    }
  }
  return records;
}
function syntheticRecord(id, independentFinals, adviceFinals) {
  const values = [100, 200, 300, 400, 500, 600];
  const responses = values.map((referenceValue, index) => {
    const orderCondition = index < 3 ? "independent-first" : "advice-first";
    const anchor = referenceValue * 1.25;
    const finalEstimate = orderCondition === "independent-first" ? independentFinals[index] : adviceFinals[index - 3];
    return { taskId: `t${index}`, orderCondition, anchorDirection: "high", anchor, referenceValue, initialEstimate: orderCondition === "independent-first" ? referenceValue : null, initialConfidence: orderCondition === "independent-first" ? 60 : null, finalEstimate, finalConfidence: 60, knownAnswer: false, elapsedMs: 1000 };
  });
  return { studyId: STUDY_ID, specVersion: 1, participantId: id, consentVersion: "test", startedAt: new Date(0).toISOString(), completedAt: new Date(1).toISOString(), responses };
}
if (process.argv.includes("--self-test")) {
  const records = [
    syntheticRecord("p1", [105, 210, 315], [425, 530, 635]),
    syntheticRecord("p2", [100, 205, 305], [420, 525, 630])
  ];
  const result = analyse(records);
  if (result.completeValidParticipants !== 2 || !(result.primary.meanContrast > 0)) throw new Error("AI Advice Order scorer self-test failed.");
  console.log("AI Advice Order scorer self-test passed.");
  process.exit(0);
}
const inputs = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
if (!inputs.length) {
  console.error("Usage: node scripts/score-ai-advice-order.mjs <session.json|sessions.ndjson> [...] [--write=path]");
  process.exit(1);
}
const records = await loadRecords(inputs);
const result = analyse(records);
const output = JSON.stringify(result, null, 2) + "\n";
const writeArg = process.argv.find((arg) => arg.startsWith("--write="));
if (writeArg) await writeFile(writeArg.slice("--write=".length), output);
console.log(output.trimEnd());
