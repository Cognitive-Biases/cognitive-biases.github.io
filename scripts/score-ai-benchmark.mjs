import { readFile, writeFile } from "node:fs/promises";

const spec = JSON.parse(await readFile("data/ai-benchmark.json", "utf8"));
const benchmarkBySlug = new Map((spec.experiments || []).map((entry) => [entry.experimentSlug, entry]));

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const round = (value) => Number(value.toFixed(6));

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--self-test") args.selfTest = true;
    else if (token === "--input") args.input = argv[++index];
    else if (token === "--output") args.output = argv[++index];
  }
  return args;
}

function parseNdjson(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); }
    catch { throw new Error(`Invalid JSON on NDJSON line ${index + 1}`); }
  });
}

function validateRecord(record, index) {
  for (const field of spec.resultFormat.requiredFields) {
    if (record[field] === undefined || record[field] === null) throw new Error(`Record ${index + 1}: missing ${field}`);
  }
  const benchmark = benchmarkBySlug.get(record.experimentSlug);
  if (!benchmark) throw new Error(`Record ${index + 1}: unknown experiment ${record.experimentSlug}`);
  if (![0, 1].includes(record.conditionIndex)) throw new Error(`Record ${index + 1}: conditionIndex must be 0 or 1`);
  if (record.caseId !== `${record.experimentSlug}:${record.conditionIndex}`) throw new Error(`Record ${index + 1}: caseId mismatch`);
  if (!Number.isInteger(record.sample) || record.sample < 1) throw new Error(`Record ${index + 1}: sample must be a positive integer`);
  for (const field of ["provider", "name", "version", "date"]) {
    if (!String(record.model?.[field] ?? "").trim()) throw new Error(`Record ${index + 1}: model.${field} is required`);
  }
  if (benchmark.metric.type === "mean-difference") {
    const value = Number(record.response?.[benchmark.metric.valueField]);
    if (!Number.isFinite(value)) throw new Error(`Record ${index + 1}: numeric response is required`);
  } else if (benchmark.metric.type === "choice-share-difference") {
    if (!String(record.response?.[benchmark.metric.choiceField] ?? "").trim()) throw new Error(`Record ${index + 1}: choice response is required`);
  } else {
    throw new Error(`${record.experimentSlug}: unsupported metric ${benchmark.metric.type}`);
  }
}

function identityOf(model) {
  return [model.provider, model.name, model.version, model.temperature ?? "", model.topP ?? "", model.date].join("|");
}

function score(records) {
  if (!records.length) throw new Error("No benchmark records found");
  records.forEach(validateRecord);
  const identities = new Set(records.map((record) => identityOf(record.model)));
  if (identities.size !== 1) throw new Error("Score one model/configuration/date per result file");
  const model = records[0].model;
  const experiments = [];
  const warnings = [];

  for (const benchmark of spec.experiments) {
    const rows = records.filter((record) => record.experimentSlug === benchmark.experimentSlug);
    if (!rows.length) continue;
    const byCondition = [0, 1].map((conditionIndex) => rows.filter((record) => record.conditionIndex === conditionIndex));
    if (byCondition.some((rowsForCondition) => !rowsForCondition.length)) {
      warnings.push(`${benchmark.experimentSlug}: both conditions are required`);
      continue;
    }

    let conditionValues;
    if (benchmark.metric.type === "mean-difference") {
      conditionValues = byCondition.map((conditionRows) => mean(conditionRows.map((record) => Number(record.response[benchmark.metric.valueField]))));
    } else {
      conditionValues = byCondition.map((conditionRows) => {
        const hits = conditionRows.filter((record) => record.response[benchmark.metric.choiceField] === benchmark.metric.targetOption).length;
        return hits / conditionRows.length;
      });
    }
    const rawDelta = benchmark.metric.direction === "condition0-minus-condition1"
      ? conditionValues[0] - conditionValues[1]
      : conditionValues[1] - conditionValues[0];
    const adequate = byCondition.every((conditionRows) => conditionRows.length >= spec.protocol.minimumSamplesPerCondition);
    if (!adequate) warnings.push(`${benchmark.experimentSlug}: fewer than ${spec.protocol.minimumSamplesPerCondition} samples in at least one condition`);

    experiments.push({
      experimentSlug: benchmark.experimentSlug,
      metric: benchmark.metric.label,
      unit: benchmark.metric.unit,
      conditionMeansOrShares: conditionValues.map(round),
      samplesPerCondition: byCondition.map((rowsForCondition) => rowsForCondition.length),
      signedSensitivity: round(rawDelta),
      predictedDirectionObserved: rawDelta > 0 ? true : rawDelta < 0 ? false : null,
      sampleAdequacy: adequate ? "recommended-minimum-met" : "exploratory-low-sample"
    });
  }

  return {
    benchmarkVersion: spec.version,
    benchmarkStatus: "measured-run",
    model,
    generatedAt: new Date().toISOString(),
    interpretation: "Per-experiment condition sensitivity only. This report does not produce a universal bias score or diagnose a model.",
    experiments,
    warnings
  };
}

async function selfTest() {
  const model = { provider: "test", name: "fixture", version: "1", temperature: 0, topP: 1, date: "2026-08-19" };
  const rows = [];
  for (let sample = 1; sample <= 20; sample += 1) {
    rows.push({ caseId:"anchoring-first-number:0", experimentSlug:"anchoring-first-number", conditionIndex:0, sample, model, response:{value:1000} });
    rows.push({ caseId:"anchoring-first-number:1", experimentSlug:"anchoring-first-number", conditionIndex:1, sample, model, response:{value:800} });
  }
  const report = score(rows);
  if (report.experiments.length !== 1) throw new Error("Self-test experiment count failed");
  if (report.experiments[0].signedSensitivity !== 200) throw new Error("Self-test sensitivity failed");
  if (!report.experiments[0].predictedDirectionObserved) throw new Error("Self-test direction failed");
  if (report.warnings.length) throw new Error("Self-test unexpectedly produced warnings");
  console.log("AI benchmark scorer self-test passed.");
}

const args = parseArgs(process.argv.slice(2));
if (args.selfTest) {
  await selfTest();
} else {
  if (!args.input) throw new Error("Usage: node scripts/score-ai-benchmark.mjs --input results.ndjson [--output report.json]");
  const rows = parseNdjson(await readFile(args.input, "utf8"));
  const report = score(rows);
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (args.output) await writeFile(args.output, output);
  else process.stdout.write(output);
}
