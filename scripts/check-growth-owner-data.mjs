import { readFile } from 'node:fs/promises';

const SITE = 'https://cognitive-biases.github.io/';
const path = 'dist/ai/growth-owner-data.json';
const externalActionIds = new Set([
  'growth:google-generative-ai-measurement-global',
  'growth:bing-ai-citation-measurement',
  'growth:google-platform-properties',
  'trend-owner:google-generative-ai-control-global'
]);
const forbiddenKeys = new Set([
  'metrics',
  'queries',
  'pages',
  'clicks',
  'impressions',
  'top_queries_28d',
  'top_pages_28d'
]);
const assert = (condition, message) => { if (!condition) throw new Error(message); };

let text;
try {
  text = await readFile(path, 'utf8');
} catch (error) {
  if (error?.code === 'ENOENT') {
    console.log('Growth owner-data check: no receipt published because no authenticated owner artifact was available.');
    process.exit(0);
  }
  throw error;
}

const receipt = JSON.parse(text);
assert(receipt.version === '0.1', 'owner-data receipt version must be 0.1');
assert(receipt.site === SITE, 'owner-data receipt site must match the canonical site');
assert(receipt.evidenceClass === 'owner-data', 'owner-data receipt evidenceClass is invalid');
assert(receipt.guardrails?.notIndependentEvidence === true, 'owner-data receipt must remain non-independent evidence');
assert(receipt.guardrails?.noRankingClaim === true, 'owner-data receipt must not claim ranking impact');
assert(receipt.guardrails?.noCrossSurfaceInference === true, 'owner-data receipt must prohibit cross-surface inference');
assert(receipt.guardrails?.noProviderInference === true, 'owner-data receipt must prohibit cross-provider inference');
assert(receipt.guardrails?.sensitiveDataOmitted === true, 'owner-data receipt must declare sensitive data omission');
assert(Array.isArray(receipt.records) && receipt.records.length === 1, 'current standard GSC receipt must contain exactly one bounded baseline observation');

const record = receipt.records[0];
assert(record.actionId === 'observation:google-search-console-baseline', 'standard GSC evidence must stay an observation, not an AI action completion');
assert(record.evidenceType === 'measurement', 'GSC baseline must be measurement evidence');
assert(record.provider === 'google-search-console', 'GSC baseline provider mismatch');
assert(record.kind === 'search-performance', 'ordinary GSC data must use search-performance kind');
assert(record.status === 'observed', 'GSC baseline must be observed owner data');
assert(/^sha256:[a-f0-9]{64}$/.test(record.sourceDigest || ''), 'GSC baseline source digest is missing');
assert(!externalActionIds.has(record.actionId), 'ordinary Search Console evidence must not close AI/platform owner actions');

function inspect(value, trail = '$') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspect(item, `${trail}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    assert(!forbiddenKeys.has(key), `public owner-data receipt leaked forbidden field ${trail}.${key}`);
    inspect(child, `${trail}.${key}`);
  }
}
inspect(receipt);

console.log('Growth owner-data checks passed: authenticated standard GSC evidence is sanitized and cannot masquerade as generative-AI, Bing AI, platform-property or owner-control evidence.');
