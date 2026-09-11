import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = 'dist';
const SITE = 'https://cognitive-biases.github.io';
const comparisons = JSON.parse(await readFile('data/comparisons.json', 'utf8')).entries || [];
const sitemap = await readFile(join(OUT, 'sitemap.xml'), 'utf8');
const canonical = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].replaceAll('&amp;', '&')));
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const decode = (value = '') => String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function fileFor(pathname) {
  return join(OUT, pathname.replace(/^\//, '').replace(/\/$/, ''), 'index.html');
}
function titleFromHtml(html) {
  return decode(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
}
function breadcrumbs(title) {
  return `<nav class="breadcrumbs internal-breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/compare/">Compare biases</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(title)}</span></nav>`;
}
function utilityBar() {
  return '<div class="page-utility" data-page-utility><span class="page-utility__meta">Reviewed comparison</span><div class="page-utility__actions" aria-label="Page tools"><button type="button" data-page-action="save" aria-pressed="false">Save</button><button type="button" data-page-action="share">Share</button><button type="button" data-page-action="copy">Copy link</button><button type="button" data-page-action="cite">Cite</button></div><span class="page-utility__status" data-page-utility-status role="status" aria-live="polite"></span></div>';
}
function compareCard(entry) {
  return `<a class="continuation-card" href="/compare/${entry.slug}/"><span>Compare</span><strong>${escapeHtml(entry.title)}</strong><small>Separate two reviewed patterns that can look similar in practice.</small></a>`;
}
function comparisonContinuation() {
  return '<section class="internal-continuation" data-internal-discovery-continuation><p class="kicker">Continue from here</p><h2>Choose the next useful move.</h2><div class="continuation-grid"><a class="continuation-card" href="/compare/"><span>Explore</span><strong>Browse comparisons</strong><small>See other distinctions designed for similar-looking patterns.</small></a><a class="continuation-card" href="/tools/decision-audit/"><span>Apply</span><strong>Use the Decision Audit</strong><small>Test which interpretation is supported by the decision evidence.</small></a><a class="continuation-card" href="/evidence/"><span>Evidence</span><strong>Open evidence reviews</strong><small>Inspect the reviewed evidence and qualification model.</small></a></div></section>';
}
function ensureScript(html) {
  if (html.includes('src="/internal-discovery.js"')) return html;
  return html.replace(/<\/body>/i, '<script src="/internal-discovery.js" defer></script></body>');
}
function ensureContinuationTarget(html, entry) {
  if (html.includes(`href="/compare/${entry.slug}/"`)) return html;
  const match = html.match(/(<div class="continuation-grid">)([\s\S]*?)(<\/div>)/i);
  if (!match) return html;
  const existing = [...match[2].matchAll(/<a class="continuation-card"[\s\S]*?<\/a>/gi)].map((item) => item[0]);
  const next = [compareCard(entry), ...existing].slice(0, 4).join('');
  return html.replace(match[0], `${match[1]}${next}${match[3]}`);
}

let comparisonPages = 0;
let biasBacklinks = 0;
for (const entry of comparisons) {
  const compareUrl = `${SITE}/compare/${entry.slug}/`;
  if (!canonical.has(compareUrl)) throw new Error(`core comparison is missing from canonical sitemap: ${entry.slug}`);
  const compareFile = fileFor(`/compare/${entry.slug}/`);
  let html = await readFile(compareFile, 'utf8');
  if (!html.includes('data-internal-discovery-page="comparison"')) {
    if (!html.includes('internal-breadcrumbs')) html = html.replace(/(<main\b[^>]*>)/i, `$1${breadcrumbs(titleFromHtml(html) || entry.title)}`);
    if (!html.includes('data-page-utility')) html = html.replace(/(<h1\b[^>]*>[\s\S]*?<\/h1>)/i, `$1${utilityBar()}<span data-internal-discovery-page="comparison" hidden></span>`);
    if (!html.includes('data-internal-discovery-continuation')) {
      html = /<\/article>/i.test(html) ? html.replace(/<\/article>/i, `${comparisonContinuation()}</article>`) : html.replace(/<\/main>/i, `${comparisonContinuation()}</main>`);
    }
    html = ensureScript(html);
    await writeFile(compareFile, html);
  }
  comparisonPages += 1;

  for (const slug of [entry.leftSlug, entry.rightSlug]) {
    const biasFile = fileFor(`/biases/${slug}/`);
    let biasHtml;
    try { biasHtml = await readFile(biasFile, 'utf8'); } catch { continue; }
    const next = ensureContinuationTarget(biasHtml, entry);
    if (next !== biasHtml) {
      await writeFile(biasFile, next);
      biasBacklinks += 1;
    }
  }
}

const receiptPath = join(OUT, 'data', 'internal-discovery-distribution.json');
const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
const allComparisonUrls = [...canonical].filter((url) => /\/compare\/[^/]+\/$/.test(url));
let enriched = 0;
for (const url of allComparisonUrls) {
  const html = await readFile(fileFor(new URL(url).pathname), 'utf8');
  if (html.includes('data-page-utility') && html.includes('internal-breadcrumbs')) enriched += 1;
}
receipt.scope.comparisonPages = enriched;
await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

console.log(`Core comparison discovery reconciled: ${comparisonPages} legacy comparison page(s), ${biasBacklinks} bias-to-comparison backlink(s); ${enriched}/${allComparisonUrls.length} canonical comparison pages expose utilities and breadcrumbs.`);
