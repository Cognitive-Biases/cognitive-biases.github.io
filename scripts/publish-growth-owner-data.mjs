import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const SITE = 'https://cognitive-biases.github.io/';
const SOURCE_WORKFLOW = 'https://github.com/Cognitive-Biases/cognitive-biases.github.io/actions/workflows/google-search.yml';
const outputPath = 'dist/ai/growth-owner-data.json';
const reportPath = process.argv[2] || '.owner-data/google-search/google-indexing.json';

let raw;
try {
  raw = await readFile(reportPath);
} catch (error) {
  if (error?.code === 'ENOENT') {
    console.log('Growth owner-data receipt not published: no authenticated Google Search report artifact was restored.');
    process.exit(0);
  }
  throw error;
}

const report = JSON.parse(raw.toString('utf8'));
if (report.site_url !== SITE) throw new Error(`Google Search report site mismatch: ${report.site_url || 'missing'}`);
if (report.setup_required !== false) throw new Error('Google Search report is setup-only and cannot be published as owner measurement evidence.');
if (report.search_analytics?.status !== 'available') throw new Error('Google Search Analytics owner data is not available in the restored report.');
if (!report.generated_at || Number.isNaN(Date.parse(report.generated_at))) throw new Error('Google Search report generated_at is invalid.');
if (!/^\d{4}-\d{2}-\d{2}$/.test(String(report.search_analytics.data_through || ''))) throw new Error('Google Search report data_through is invalid.');
if (report.sitemap_submission?.status !== 'submitted') throw new Error('Google Search report does not confirm sitemap submission.');

const digest = createHash('sha256').update(raw).digest('hex');
const receipt = {
  $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/growth-owner-data.schema.json',
  version: '0.1',
  site: SITE,
  evidenceClass: 'owner-data',
  generatedAt: new Date().toISOString(),
  guardrails: {
    notIndependentEvidence: true,
    noRankingClaim: true,
    noCrossSurfaceInference: true,
    noProviderInference: true,
    sensitiveDataOmitted: true
  },
  records: [
    {
      actionId: 'observation:google-search-console-baseline',
      evidenceType: 'measurement',
      provider: 'google-search-console',
      kind: 'search-performance',
      status: 'observed',
      observedAt: report.generated_at,
      dataThrough: report.search_analytics.data_through,
      summary: 'Authenticated standard Search Analytics, sitemap submission and URL Inspection pipeline evidence is available. This record intentionally does not assert Google generative-AI performance, platform-property performance, Bing AI citations or an authenticated generative-AI inclusion setting.',
      scope: [SITE],
      evidence: [SOURCE_WORKFLOW],
      sourceDigest: `sha256:${digest}`
    }
  ]
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
console.log(`Growth owner-data receipt published from standard GSC evidence through ${receipt.records[0].dataThrough}; AI-specific owner actions remain unasserted.`);
