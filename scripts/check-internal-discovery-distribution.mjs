import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, 'dist');
const SITE = 'https://cognitive-biases.github.io';
const fail = (message) => { throw new Error(`internal_discovery:${message}`); };
const decode = (value = '') => String(value).replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").trim();

const sitemap = await readFile(join(OUT, 'sitemap.xml'), 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decode(match[1]));
const canonical = new Set(urls);
const canonicalPaths = new Set(urls.map((value) => new URL(value).pathname));
const biases = JSON.parse(await readFile(join(ROOT, 'data', 'biases.json'), 'utf8')).filter((bias) => bias.published);
const duplicates = JSON.parse(await readFile(join(ROOT, 'data', 'duplicate-dispositions.json'), 'utf8'));
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const contexts = JSON.parse(await readFile(join(ROOT, 'data', 'contexts.json'), 'utf8')).entries || [];
const relations = JSON.parse(await readFile(join(ROOT, 'data', 'relations-v2.json'), 'utf8')).relations || [];

const evidenceFiles = (await readdir(join(ROOT, 'data'))).filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name));
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join(ROOT, 'data', name), 'utf8'))));
const reviewed = new Set(evidenceDocs.flatMap((doc) => doc.reviews || []).map((item) => item.slug));
const comparisonFiles = (await readdir(join(ROOT, 'data'))).filter((name) => /^comparisons-[a-z0-9-]+\.json$/i.test(name));
const comparisonDocs = await Promise.all(comparisonFiles.map(async (name) => JSON.parse(await readFile(join(ROOT, 'data', name), 'utf8'))));
const comparisonEntries = comparisonDocs.flatMap((doc) => doc.entries || []);

const priorityBiases = new Set(reviewed);
for (const context of contexts) for (const lens of context.lenses || []) priorityBiases.add(lens.slug);
for (const relation of relations) { priorityBiases.add(relation.leftSlug); priorityBiases.add(relation.rightSlug); }
for (const entry of comparisonEntries) { priorityBiases.add(entry.leftSlug); priorityBiases.add(entry.rightSlug); }

function fileFor(pathname) {
  if (pathname === '/') return join(OUT, 'index.html');
  return join(OUT, pathname.replace(/^\//, '').replace(/\/$/, ''), 'index.html');
}
function canonicalFromHtml(html) {
  return decode(html.match(/<link\b(?=[^>]*rel=["']canonical["'])[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1] || '');
}
function anchors(html) {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((match) => ({
    href: decode(match[1]), text: decode(match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '))
  }));
}
function normalizeTarget(href, base) {
  try {
    const url = new URL(href, base);
    if (url.origin !== SITE) return null;
    url.hash = '';
    url.search = '';
    return url.href;
  } catch { return null; }
}
function jsonLd(html) {
  return [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((match) => {
    try { return JSON.parse(match[1]); } catch (error) { fail(`invalid JSON-LD: ${error.message}`); }
  });
}
function collectType(value, type, found = []) {
  if (!value || typeof value !== 'object') return found;
  if (Array.isArray(value)) { for (const item of value) collectType(item, type, found); return found; }
  const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
  if (types.includes(type)) found.push(value);
  for (const child of Object.values(value)) collectType(child, type, found);
  return found;
}

const incoming = new Map(urls.map((url) => [url, []]));
const contextualIncoming = new Map(urls.map((url) => [url, []]));
for (const url of urls) {
  const pathname = new URL(url).pathname;
  let html;
  try { html = await readFile(fileFor(pathname), 'utf8'); } catch { continue; }
  for (const link of anchors(html)) {
    const target = normalizeTarget(link.href, url);
    if (!target || !canonical.has(target) || target === url) continue;
    incoming.get(target)?.push(url);
  }
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || '';
  for (const link of anchors(main)) {
    const target = normalizeTarget(link.href, url);
    if (!target || !canonical.has(target) || target === url) continue;
    contextualIncoming.get(target)?.push(url);
  }
}

const canonicalBiases = biases.filter((bias) => !duplicateIds.has(bias.id) && canonicalPaths.has(`/biases/${bias.slug}/`));
let priorityContinuation = 0;
for (const bias of canonicalBiases) {
  const pathname = `/biases/${bias.slug}/`;
  const url = `${SITE}${pathname}`;
  const html = await readFile(fileFor(pathname), 'utf8');
  if (canonicalFromHtml(html) !== url) fail(`${bias.slug}: canonical mismatch`);
  if (!/<nav class="breadcrumbs internal-breadcrumbs"[^>]*aria-label="Breadcrumb"/i.test(html)) fail(`${bias.slug}: visible breadcrumb missing`);
  if (!html.includes('data-page-utility')) fail(`${bias.slug}: page utility bar missing`);
  for (const action of ['save', 'share', 'copy', 'cite']) if (!html.includes(`data-page-action="${action}"`)) fail(`${bias.slug}: ${action} utility missing`);
  if (!html.includes('src="/internal-discovery.js"')) fail(`${bias.slug}: utility script missing`);
  const lists = jsonLd(html).flatMap((value) => collectType(value, 'BreadcrumbList'));
  if (!lists.length) fail(`${bias.slug}: BreadcrumbList missing`);
  const items = lists[0].itemListElement || [];
  if (items.length < 3 || items[0]?.item !== `${SITE}/` || items[1]?.item !== `${SITE}/explore/` || items.at(-1)?.item !== url) fail(`${bias.slug}: BreadcrumbList hierarchy mismatch`);
  if (!(incoming.get(url) || []).length) fail(`${bias.slug}: no inbound canonical link observed`);
  if (!(contextualIncoming.get(url) || []).length) fail(`${bias.slug}: only global/no contextual inbound discovery observed`);

  if (priorityBiases.has(bias.slug)) {
    if (!html.includes('data-internal-discovery-continuation')) fail(`${bias.slug}: curated continuation block missing`);
    const block = html.match(/<section class="internal-continuation"[\s\S]*?<\/section>/i)?.[0] || '';
    const links = anchors(block);
    if (links.length < 2 || links.length > 4) fail(`${bias.slug}: continuation must contain 2-4 useful links`);
    const targets = new Set();
    for (const link of links) {
      if (/^(click here|read more|article)$/i.test(link.text)) fail(`${bias.slug}: generic continuation anchor ${JSON.stringify(link.text)}`);
      const target = normalizeTarget(link.href, url);
      if (!target || !canonical.has(target)) fail(`${bias.slug}: continuation target is not canonical: ${link.href}`);
      if (targets.has(target)) fail(`${bias.slug}: duplicate continuation target ${target}`);
      targets.add(target);
    }
    priorityContinuation += 1;
  }
}

for (const context of contexts) {
  const pathname = `/contexts/${context.slug}/`;
  const url = `${SITE}${pathname}`;
  if (!canonical.has(url)) continue;
  const html = await readFile(fileFor(pathname), 'utf8');
  if (!html.includes('internal-breadcrumbs')) fail(`${context.slug}: context visible breadcrumb missing`);
  if (!html.includes('data-page-utility')) fail(`${context.slug}: context page utility missing`);
  if (!(incoming.get(url) || []).length) fail(`${context.slug}: context has no inbound canonical link`);
  if (!(contextualIncoming.get(url) || []).length) fail(`${context.slug}: context lacks contextual inbound discovery`);
}

for (const relation of relations) {
  const leftUrl = `${SITE}/biases/${relation.leftSlug}/`;
  const rightUrl = `${SITE}/biases/${relation.rightSlug}/`;
  if (!canonical.has(leftUrl) || !canonical.has(rightUrl)) fail(`relation target left canonical cohort: ${relation.leftSlug} ↔ ${relation.rightSlug}`);
  const left = await readFile(fileFor(new URL(leftUrl).pathname), 'utf8');
  const right = await readFile(fileFor(new URL(rightUrl).pathname), 'utf8');
  if (!anchors(left).some((link) => normalizeTarget(link.href, leftUrl) === rightUrl)) fail(`reviewed reverse relation missing ${relation.leftSlug} → ${relation.rightSlug}`);
  if (!anchors(right).some((link) => normalizeTarget(link.href, rightUrl) === leftUrl)) fail(`reviewed reverse relation missing ${relation.rightSlug} → ${relation.leftSlug}`);
}

const utilityScript = await readFile(join(OUT, 'internal-discovery.js'), 'utf8');
for (const marker of ['navigator.share', 'navigator.clipboard', 'localStorage', 'Cognitive Biases']) if (!utilityScript.includes(marker)) fail(`utility script missing ${marker}`);
if (!utilityScript.includes("link[rel=\"canonical\"]")) fail('utility script must derive copy/share/citation URL from canonical link');

const receipt = JSON.parse(await readFile(join(OUT, 'data', 'internal-discovery-distribution.json'), 'utf8'));
if (receipt.arwpRevision !== '793483e3404a97f7892e86bcda3fd317d5c7427c') fail('receipt ARWP revision mismatch');
if (receipt.preferredSources?.status !== 'applicability-watch') fail('Preferred Sources must remain applicability-gated until verified');

console.log(`Internal Discovery & Distribution gate passed: ${canonicalBiases.length} canonical bias pages, ${priorityContinuation} curated continuation pages, ${contexts.length} context definitions, reciprocal reviewed relations, canonical utilities and contextual inbound graph coverage.`);
