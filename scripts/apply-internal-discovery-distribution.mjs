import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, 'dist');
const SITE = 'https://cognitive-biases.github.io';
const ARWP_REVISION = '793483e3404a97f7892e86bcda3fd317d5c7427c';

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const decode = (value = '') => String(value).replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").trim();

const biases = JSON.parse(await readFile(join(ROOT, 'data', 'biases.json'), 'utf8')).filter((bias) => bias.published);
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
const contextsDoc = JSON.parse(await readFile(join(ROOT, 'data', 'contexts.json'), 'utf8'));
const relationsDoc = JSON.parse(await readFile(join(ROOT, 'data', 'relations-v2.json'), 'utf8'));
const duplicateDoc = JSON.parse(await readFile(join(ROOT, 'data', 'duplicate-dispositions.json'), 'utf8'));
const duplicateIds = new Set((duplicateDoc.groups || []).flatMap((group) => group.duplicateIds || []));

const evidenceFiles = (await readdir(join(ROOT, 'data')))
  .filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name))
  .sort();
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join(ROOT, 'data', name), 'utf8'))));
const reviewedSlugs = new Set(evidenceDocs.flatMap((doc) => doc.reviews || []).map((review) => review.slug));

const comparisonFiles = (await readdir(join(ROOT, 'data')))
  .filter((name) => /^comparisons-[a-z0-9-]+\.json$/i.test(name))
  .sort();
const comparisonDocs = await Promise.all(comparisonFiles.map(async (name) => JSON.parse(await readFile(join(ROOT, 'data', name), 'utf8'))));
const comparisonByBias = new Map();
for (const entry of comparisonDocs.flatMap((doc) => doc.entries || [])) {
  for (const slug of [entry.leftSlug, entry.rightSlug]) {
    if (!slug) continue;
    if (!comparisonByBias.has(slug)) comparisonByBias.set(slug, []);
    comparisonByBias.get(slug).push(entry);
  }
}

const contextsByBias = new Map();
for (const context of contextsDoc.entries || []) {
  for (const lens of context.lenses || []) {
    if (!lens.slug) continue;
    if (!contextsByBias.has(lens.slug)) contextsByBias.set(lens.slug, []);
    contextsByBias.get(lens.slug).push(context);
  }
}

const relationsByBias = new Map();
for (const relation of relationsDoc.relations || []) {
  const left = bySlug.get(relation.leftSlug);
  const right = bySlug.get(relation.rightSlug);
  if (!left || !right) continue;
  for (const [source, target] of [[left, right], [right, left]]) {
    if (!relationsByBias.has(source.slug)) relationsByBias.set(source.slug, []);
    relationsByBias.get(source.slug).push({ relation, target });
  }
}

const sitemap = await readFile(join(OUT, 'sitemap.xml'), 'utf8');
const canonicalUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decode(match[1])));
const canonicalPaths = new Set([...canonicalUrls].map((value) => new URL(value).pathname));

function pagePath(pathname) {
  if (pathname === '/') return join(OUT, 'index.html');
  return join(OUT, pathname.replace(/^\//, '').replace(/\/$/, ''), 'index.html');
}
function titleFromHtml(html) {
  return decode(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, ' ') || '');
}
function canonicalFromHtml(html) {
  return decode(html.match(/<link\b(?=[^>]*rel=["']canonical["'])[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1] || '');
}
function breadcrumbs(items) {
  return `<nav class="breadcrumbs internal-breadcrumbs" aria-label="Breadcrumb">${items.map((item, index) => {
    const separator = index ? '<span aria-hidden="true">/</span>' : '';
    if (item.href) return `${separator}<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`;
    return `${separator}<span aria-current="page">${escapeHtml(item.label)}</span>`;
  }).join('')}</nav>`;
}
function utilityBar(kind, reviewed = false) {
  const meta = reviewed ? 'Evidence reviewed' : kind;
  return `<div class="page-utility" data-page-utility><span class="page-utility__meta">${escapeHtml(meta)}</span><div class="page-utility__actions" aria-label="Page tools"><button type="button" data-page-action="save" aria-pressed="false">Save</button><button type="button" data-page-action="share">Share</button><button type="button" data-page-action="copy">Copy link</button><button type="button" data-page-action="cite">Cite</button></div><span class="page-utility__status" data-page-utility-status role="status" aria-live="polite"></span></div>`;
}
function continuation(items) {
  const unique = [];
  const seen = new Set();
  for (const item of items) {
    const key = item.href.split('#')[0];
    if (!item.href || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
    if (unique.length >= 4) break;
  }
  if (unique.length < 2) return '';
  const cards = unique.map((item) => `<a class="continuation-card" href="${escapeHtml(item.href)}"><span>${escapeHtml(item.job)}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.note)}</small></a>`).join('');
  return `<section class="internal-continuation" data-internal-discovery-continuation><p class="kicker">Continue from here</p><h2>Choose the next useful move.</h2><div class="continuation-grid">${cards}</div></section>`;
}
function ensureUtilityScript(html) {
  if (!html.includes('data-page-utility')) return html;
  if (html.includes('src="/internal-discovery.js"')) return html;
  return html.replace(/<\/body>/i, '<script src="/internal-discovery.js" defer></script></body>');
}
function updateBreadcrumbJsonLd(value, items) {
  if (Array.isArray(value)) return value.map((item) => updateBreadcrumbJsonLd(item, items));
  if (!value || typeof value !== 'object') return value;
  const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
  if (types.includes('BreadcrumbList')) {
    value.itemListElement = items.map((item, index) => ({
      '@type': 'ListItem', position: index + 1, name: item.label, item: item.url
    }));
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'itemListElement' && types.includes('BreadcrumbList')) continue;
    value[key] = updateBreadcrumbJsonLd(child, items);
  }
  return value;
}
function alignBreadcrumbSchema(html, items) {
  return html.replace(/(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi, (whole, open, raw, close) => {
    try { return `${open}${JSON.stringify(updateBreadcrumbJsonLd(JSON.parse(raw), items))}${close}`; }
    catch { return whole; }
  });
}
function insertAfterH1(html, block) {
  if (!block || html.includes('data-page-utility')) return html;
  return html.replace(/(<h1\b[^>]*>[\s\S]*?<\/h1>)/i, `$1${block}`);
}
function insertBeforeArticleEnd(html, block) {
  if (!block || html.includes('data-internal-discovery-continuation')) return html;
  if (html.includes('<section class="evidence-relations"')) return html.replace('<section class="evidence-relations"', `${block}<section class="evidence-relations"`);
  if (html.includes('<section class="related legacy-related"')) return html.replace('<section class="related legacy-related"', `${block}<section class="related legacy-related"`);
  if (html.includes('<section class="related"')) return html.replace('<section class="related"', `${block}<section class="related"`);
  return html.replace(/<\/article>/i, `${block}</article>`);
}
function injectVisibleBreadcrumb(html, block) {
  if (html.includes('internal-breadcrumbs')) return html;
  if (/<p class="breadcrumbs">[\s\S]*?<\/p>/i.test(html)) return html.replace(/<p class="breadcrumbs">[\s\S]*?<\/p>/i, block);
  return html.replace(/(<main\b[^>]*>)/i, `$1${block}`);
}

let biasPages = 0;
let priorityBiasPages = 0;
let contextPages = 0;
let comparisonPages = 0;
let researchPages = 0;

for (const bias of biases) {
  if (duplicateIds.has(bias.id)) continue;
  const pathname = `/biases/${bias.slug}/`;
  if (!canonicalPaths.has(pathname)) continue;
  const file = pagePath(pathname);
  let html = await readFile(file, 'utf8');
  const title = bias.title || titleFromHtml(html);
  const visibleItems = [
    { label: 'Home', href: '/' },
    { label: 'Explore biases', href: '/explore/' },
    { label: bias.typeOfBias || 'Bias', href: null }
  ];
  const schemaItems = [
    { label: 'Home', url: `${SITE}/` },
    { label: 'Explore biases', url: `${SITE}/explore/` },
    { label: title, url: `${SITE}${pathname}` }
  ];
  html = injectVisibleBreadcrumb(html, breadcrumbs(visibleItems));
  html = alignBreadcrumbSchema(html, schemaItems);
  html = insertAfterH1(html, utilityBar('Reference entry', reviewedSlugs.has(bias.slug)));
  html = html.replace('<aside class="context-teaser"><span>Decision contexts</span>', '<aside class="context-teaser" data-internal-discovery-reverse="contexts"><span>Appears in</span>');
  html = html.replace('<section class="evidence-relations"', '<section class="evidence-relations" data-internal-discovery-relations="reviewed"');

  const next = [];
  const contexts = contextsByBias.get(bias.slug) || [];
  const comparisons = comparisonByBias.get(bias.slug) || [];
  const relations = relationsByBias.get(bias.slug) || [];
  if (contexts[0]) next.push({ job: 'Apply', title: contexts[0].title, href: `/contexts/${contexts[0].slug}/`, note: 'See how this pattern changes a real decision context.' });
  if (comparisons[0]) next.push({ job: 'Compare', title: comparisons[0].title, href: `/compare/${comparisons[0].slug}/`, note: 'Separate two patterns that can look similar in practice.' });
  else if (relations[0]) next.push({ job: 'Compare', title: relations[0].target.title, href: `/biases/${relations[0].target.slug}/`, note: relations[0].relation.note });
  if (reviewedSlugs.has(bias.slug)) next.push({ job: 'Evidence', title: 'Review the evidence layer', href: '/evidence/', note: 'See how reviewed claims, uncertainty and source status are handled.' });
  if (next.length) {
    next.push({ job: 'Practice', title: 'Test the pattern in a Decision Audit', href: '/tools/decision-audit/', note: 'Turn the idea into observable questions before naming the bias.' });
    html = insertBeforeArticleEnd(html, continuation(next));
    priorityBiasPages += 1;
  }
  html = ensureUtilityScript(html);
  await writeFile(file, html);
  biasPages += 1;
}

for (const context of contextsDoc.entries || []) {
  const pathname = `/contexts/${context.slug}/`;
  if (!canonicalPaths.has(pathname)) continue;
  const file = pagePath(pathname);
  let html = await readFile(file, 'utf8');
  const title = titleFromHtml(html) || context.title;
  html = injectVisibleBreadcrumb(html, breadcrumbs([
    { label: 'Home', href: '/' }, { label: 'Decision contexts', href: '/contexts/' }, { label: title, href: null }
  ]));
  html = insertAfterH1(html, utilityBar('Decision context'));
  const firstLens = (context.lenses || []).map((lens) => bySlug.get(lens.slug)).find(Boolean);
  html = insertBeforeArticleEnd(html, continuation([
    firstLens ? { job: 'Understand', title: firstLens.title, href: `/biases/${firstLens.slug}/`, note: 'Open one evidence-reviewed lens used in this context.' } : null,
    { job: 'Apply', title: 'Open a blank Decision Audit', href: '/tools/decision-audit/', note: 'Turn the situation into observable questions before choosing a label.' },
    { job: 'Explore', title: 'Browse all decision contexts', href: '/contexts/', note: 'Move to another situation-first guide.' }
  ].filter(Boolean)));
  html = ensureUtilityScript(html);
  await writeFile(file, html);
  contextPages += 1;
}

for (const entries of comparisonByBias.values()) {
  for (const entry of entries) {
    const pathname = `/compare/${entry.slug}/`;
    if (!canonicalPaths.has(pathname)) continue;
    const file = pagePath(pathname);
    let html = await readFile(file, 'utf8');
    if (html.includes('data-internal-discovery-page="comparison"')) continue;
    const title = titleFromHtml(html) || entry.title;
    html = injectVisibleBreadcrumb(html, breadcrumbs([
      { label: 'Home', href: '/' }, { label: 'Compare biases', href: '/compare/' }, { label: title, href: null }
    ]));
    html = insertAfterH1(html, `${utilityBar('Reviewed comparison')}<span data-internal-discovery-page="comparison" hidden></span>`);
    html = insertBeforeArticleEnd(html, continuation([
      { job: 'Explore', title: 'Browse comparisons', href: '/compare/', note: 'See other distinctions designed for similar-looking patterns.' },
      { job: 'Apply', title: 'Use the Decision Audit', href: '/tools/decision-audit/', note: 'Test which interpretation is actually supported by the decision evidence.' },
      { job: 'Evidence', title: 'Open evidence reviews', href: '/evidence/', note: 'Inspect the reviewed evidence and qualification model.' }
    ]));
    html = ensureUtilityScript(html);
    await writeFile(file, html);
    comparisonPages += 1;
  }
}
comparisonPages /= 2;

for (const url of canonicalUrls) {
  const pathname = new URL(url).pathname;
  if (!/^\/research\/[^/]+\/$/.test(pathname)) continue;
  const file = pagePath(pathname);
  let html;
  try { html = await readFile(file, 'utf8'); } catch { continue; }
  if (html.includes('data-page-utility')) continue;
  const title = titleFromHtml(html);
  html = injectVisibleBreadcrumb(html, breadcrumbs([
    { label: 'Home', href: '/' }, { label: 'Research', href: '/research/' }, { label: title || 'Research note', href: null }
  ]));
  html = insertAfterH1(html, utilityBar('Research note'));
  html = insertBeforeArticleEnd(html, continuation([
    { job: 'Research', title: 'Browse research notes', href: '/research/', note: 'Continue through source-backed notes and open questions.' },
    { job: 'Evidence', title: 'Open evidence reviews', href: '/evidence/', note: 'See the reviewed evidence layer used by the library.' },
    { job: 'Explore', title: 'Explore cognitive biases', href: '/explore/', note: 'Return to the canonical concept library.' }
  ]));
  html = ensureUtilityScript(html);
  await writeFile(file, html);
  researchPages += 1;
}

const stylesPath = join(OUT, 'styles.css');
let styles = await readFile(stylesPath, 'utf8');
if (!styles.includes('/* internal-discovery-distribution */')) {
  styles += `\n/* internal-discovery-distribution */\n.internal-breadcrumbs{display:flex;gap:.45rem;align-items:center;flex-wrap:wrap;margin:0 0 1rem;font-size:.84rem;font-weight:900}.internal-breadcrumbs a{text-decoration:none}.internal-breadcrumbs a:hover{text-decoration:underline}.page-utility{display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;margin:1rem 0 1.5rem;padding:.65rem .75rem;border:2px solid var(--ink);background:#fff}.page-utility__meta{font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.04em;background:var(--yellow);border:2px solid var(--ink);padding:.2rem .42rem}.page-utility__actions{display:flex;gap:.4rem;flex-wrap:wrap}.page-utility button{appearance:none;border:2px solid var(--ink);background:var(--paper);color:var(--ink);padding:.34rem .58rem;font:800 .78rem/1 Nunito,Arial,sans-serif;cursor:pointer}.page-utility button:hover,.page-utility button:focus-visible{background:var(--cyan)}.page-utility button[aria-pressed="true"]{background:var(--cyan)}.page-utility__status{min-height:1em;font-size:.76rem;font-weight:800;color:#4f596b}.internal-continuation{margin:2.7rem 0 0;padding-top:1.5rem;border-top:var(--line)}.internal-continuation h2{margin:.35rem 0 1rem}.continuation-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-left:var(--line);border-top:var(--line)}.continuation-card{display:flex;flex-direction:column;gap:.42rem;min-height:145px;padding:1rem;border-right:var(--line);border-bottom:var(--line);background:#fff;text-decoration:none}.continuation-card:hover{background:var(--cyan)}.continuation-card>span{font-size:.7rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em}.continuation-card>strong{font:1rem/1.12 Archivo Black,sans-serif;letter-spacing:-.03em}.continuation-card>small{font-size:.82rem;line-height:1.35;color:#465061}.comparison-teaser{margin:1.2rem 0}@media(max-width:760px){.page-utility{align-items:flex-start}.continuation-grid{grid-template-columns:1fr}}\n`;
  await writeFile(stylesPath, styles);
}

await writeFile(join(OUT, 'data', 'internal-discovery-distribution.json'), `${JSON.stringify({
  version: '0.1',
  site: `${SITE}/`,
  arwpRevision: ARWP_REVISION,
  generatedAt: new Date().toISOString(),
  scope: { biasPages, priorityBiasPages, contextPages, comparisonPages, researchPages },
  preferredSources: { status: 'applicability-watch', reason: 'No prominent Preferred Sources control is published until site availability is verified in Google source preferences.' }
}, null, 2)}\n`);

console.log(`Internal Discovery & Distribution applied: ${biasPages} canonical bias pages (${priorityBiasPages} curated continuation pages), ${contextPages} contexts, ${comparisonPages} comparisons, ${researchPages} research notes.`);
