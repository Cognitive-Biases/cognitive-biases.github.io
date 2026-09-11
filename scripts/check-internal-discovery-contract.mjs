import { readFile } from 'node:fs/promises';

const contract = JSON.parse(await readFile('.arwp/internal-discovery.json', 'utf8'));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(contract.version === '0.1', 'Internal Discovery contract version must remain 0.1');
assert(contract.site === 'https://cognitive-biases.github.io/', 'Internal Discovery contract must bind to the canonical site');
assert(contract.arwpRevision === '793483e3404a97f7892e86bcda3fd317d5c7427c', 'Internal Discovery contract must remain pinned to the reviewed ARWP revision');
assert(Array.isArray(contract.findings) && contract.findings.length === 10, 'Internal Discovery must record IDD-01 through IDD-10');
const expected = new Set([
  'IDD-01-crawlable-canonical-internal-links',
  'IDD-02-descriptive-anchor-text',
  'IDD-03-reachability-depth-and-global-only-gaps',
  'IDD-04-semantic-related-and-reverse-links',
  'IDD-05-visible-breadcrumbs-and-breadcrumblist',
  'IDD-06-intentional-continuation-blocks',
  'IDD-07-page-utility-share-copy-save-cite',
  'IDD-08-citation-and-canonical-share-contract',
  'IDD-09-preferred-source-affordance',
  'IDD-10-regression-safe-link-graph-gate'
]);
for (const finding of contract.findings) {
  assert(expected.delete(finding.id), `unexpected or duplicate Internal Discovery finding: ${finding.id}`);
  assert(String(finding.status || '').length > 3, `${finding.id} needs an explicit status`);
  assert(String(finding.evidence || '').length > 60, `${finding.id} needs bounded evidence`);
}
assert(expected.size === 0, 'Internal Discovery contract is missing a required finding');
for (const key of [
  'noRankingGuarantee', 'noMagicLinkCount', 'utilityControlsNotRankingSignals',
  'partialCoverageNeverOrphanProof', 'canonicalTargetsPreferred', 'noFabricatedCitationMetadata',
  'preferredSourcesApplicabilityGated', 'finalArtifactBeforeRelease', 'liveVerificationAfterDeploy'
]) assert(contract.guardrails?.[key] === true, `Internal Discovery guardrail ${key} must remain true`);
const preferred = contract.findings.find((finding) => finding.id === 'IDD-09-preferred-source-affordance');
assert(preferred?.status.includes('not-enabled'), 'Preferred Sources must remain disabled until applicability is verified');

console.log('Internal Discovery ARWP contract passed: IDD-01 through IDD-10 are revision-pinned with distribution/ranking evidence boundaries intact.');
