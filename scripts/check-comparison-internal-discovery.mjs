import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = 'dist';
const files = ['comparisons.json', ...(await readdir('data')).filter((name) => /^comparisons-[a-z0-9-]+\.json$/i.test(name)).sort()];
const docs = await Promise.all(files.map(async (name) => JSON.parse(await readFile(join('data', name), 'utf8'))));
const entries = docs.flatMap((doc) => doc.entries || []);
const unique = new Map(entries.map((entry) => [entry.slug, entry]));
let backlinks = 0;

for (const entry of unique.values()) {
  const page = await readFile(join(OUT, 'compare', entry.slug, 'index.html'), 'utf8');
  if (!page.includes('internal-breadcrumbs')) throw new Error(`${entry.slug}: comparison breadcrumb missing`);
  if (!page.includes('data-page-utility')) throw new Error(`${entry.slug}: comparison utility bar missing`);
  if (!page.includes('data-internal-discovery-continuation')) throw new Error(`${entry.slug}: comparison continuation missing`);
  if (!page.includes('src="/internal-discovery.js"')) throw new Error(`${entry.slug}: comparison utility script missing`);
  for (const biasSlug of [entry.leftSlug, entry.rightSlug]) {
    const bias = await readFile(join(OUT, 'biases', biasSlug, 'index.html'), 'utf8');
    if (!bias.includes(`href="/compare/${entry.slug}/"`)) throw new Error(`${biasSlug}: missing reverse link to comparison ${entry.slug}`);
    backlinks += 1;
  }
}

const receipt = JSON.parse(await readFile(join(OUT, 'data', 'internal-discovery-distribution.json'), 'utf8'));
if (receipt.scope.comparisonPages !== unique.size) throw new Error(`comparison receipt mismatch: ${receipt.scope.comparisonPages} != ${unique.size}`);

console.log(`Comparison Internal Discovery passed: ${unique.size} canonical comparison pages with utilities/breadcrumbs/continuation and ${backlinks} bias-to-comparison reverse links.`);
