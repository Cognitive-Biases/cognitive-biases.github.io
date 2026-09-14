import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  inspectRenderedPage,
  persistEvidence,
  exerciseKeyboard,
  exerciseSecondaryStates,
  runPseudoStress,
  attachRuntimeCollectors,
} from './browser-localization-support.mjs';

const SITE = 'https://cognitive-biases.github.io';
const BASE_URL = (process.env.TARGET_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const MODE = process.env.BROWSER_AUDIT_MODE || (BASE_URL.includes('127.0.0.1') ? 'local' : 'production');
const OUT_DIR = process.env.BROWSER_AUDIT_OUT || `.artifacts/localization-browser/${MODE}`;
const FULL_SCAN = process.env.BROWSER_FULL_SCAN !== '0';
const CONCURRENCY = Math.max(1, Number(process.env.BROWSER_FULL_SCAN_CONCURRENCY || 8));
const MAX_GROUPS = Number(process.env.BROWSER_MAX_ARCHETYPES || 10);
const PSEUDO_EXPANSION = Number(process.env.BROWSER_PSEUDO_EXPANSION || 0.45);
const EXPECTED_DEPLOY_SHA = process.env.EXPECTED_DEPLOY_SHA || '';
const manifest = JSON.parse(await readFile('data/locales.json', 'utf8'));
const canonicalLocale = manifest.canonicalLocale || 'en';
const locales = manifest.locales || [];
const localeBases = new Map(locales.map((locale) => [locale.code, locale.code === canonicalLocale ? '/' : (locale.urlBase || `/${locale.code.toLowerCase()}/`)]));
const nonCanonicalBases = [...localeBases.entries()].filter(([code]) => code !== canonicalLocale).map(([, base]) => base);
const allViewports = [
  { name: 'small-mobile', width: 320, height: 568 },
  { name: 'mobile', width: 375, height: 667 },
  { name: 'large-mobile', width: 430, height: 932 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1366, height: 900 },
];
const requested = new Set((process.env.BROWSER_VIEWPORTS || allViewports.map((item) => item.name).join(',')).split(',').map((value) => value.trim()).filter(Boolean));
const viewports = allViewports.filter((item) => requested.has(item.name));
const report = {
  version: 2,
  generatedAt: new Date().toISOString(),
  mode: MODE,
  baseUrl: BASE_URL,
  locales: locales.map((locale) => ({ ...locale, routeBase: localeBases.get(locale.code) })),
  viewports,
  coverage: {},
  findings: [],
  runtime: [],
  longStrings: {},
  instrumentationErrors: [],
  summary: {},
};

await mkdir(OUT_DIR, { recursive: true });
const sitemapPaths = await loadSitemapPaths();
const pathsByLocale = new Map(locales.map((locale) => [locale.code, pathsForLocale(locale.code, sitemapPaths)]));
for (const locale of locales) {
  const paths = pathsByLocale.get(locale.code) || [];
  report.coverage[locale.code] = {
    publishedPaths: paths.length,
    selected: selectArchetypes(locale.code, paths),
    errorPath: missingPathFor(locale.code),
  };
}

const browser = await chromium.launch({ headless: true });
try {
  await selfTest(browser);
  if (EXPECTED_DEPLOY_SHA) await verifyDeployRevision();
  if (FULL_SCAN) await runFullScan(browser);
  await runEvidenceMatrix(browser);
  await run404Matrix(browser);
  report.summary = summarize(report.findings);
  await writeJson(join(OUT_DIR, 'report.json'), report);
  await writeFile(join(OUT_DIR, 'summary.md'), renderMarkdown(), 'utf8');
  console.log(renderConsole());
  if (report.instrumentationErrors.length) process.exitCode = 2;
  else if (report.summary.critical + report.summary.high > 0) process.exitCode = 1;
} finally {
  await browser.close();
}

async function selfTest(browser) {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await goto(page, '/', 200, false);
    await inspectRenderedPage(page, { expectedLang: canonicalLocale, expectedCanonical: `${SITE}/`, lightweight: true });
  } catch (error) {
    report.instrumentationErrors.push({ stage: 'self-test', message: String(error?.message || error) });
    throw error;
  } finally {
    await context.close();
  }
}

async function verifyDeployRevision() {
  const response = await fetch(`${BASE_URL}/deploy-revision.txt`, { headers: { 'cache-control': 'no-cache' } });
  const actual = response.ok ? (await response.text()).trim() : '';
  if (actual !== EXPECTED_DEPLOY_SHA) finding('high', 'deployment-revision-mismatch', 'all', '/deploy-revision.txt', 'production', { expected: EXPECTED_DEPLOY_SHA, actual, status: response.status });
}

async function runFullScan(browser) {
  const jobs = [];
  for (const locale of locales) for (const path of pathsByLocale.get(locale.code) || []) jobs.push({ locale: locale.code, path });
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, async () => {
    const context = await browser.newContext({ viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      const detach = attachRuntimeCollectors(page, runtimeArgs(job.locale, job.path, 'full-scan'));
      try {
        await goto(page, job.path, 200, false);
        const state = await inspectRenderedPage(page, { expectedLang: job.locale.toLowerCase(), expectedCanonical: `${SITE}${job.path}`, lightweight: true });
        addStateFindings(job.locale, job.path, 'small-mobile', state, true, false);
      } catch (error) {
        handleAuditError(error, job.locale, job.path, 'small-mobile');
      } finally {
        detach();
      }
    }
    await context.close();
  }));
}

async function runEvidenceMatrix(browser) {
  for (const locale of locales) {
    report.longStrings[locale.code] = [];
    for (const item of report.coverage[locale.code].selected) {
      for (const viewport of viewports) {
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        const detach = attachRuntimeCollectors(page, runtimeArgs(locale.code, item.path, viewport.name));
        try {
          await goto(page, item.path, 200, true);
          const state = await inspectRenderedPage(page, { expectedLang: locale.code.toLowerCase(), expectedCanonical: `${SITE}${item.path}` });
          addStateFindings(locale.code, item.path, viewport.name, state, false, false);
          if (viewport.name === 'small-mobile') {
            report.longStrings[locale.code].push(...state.longStrings.map((entry) => ({ path: item.path, ...entry })));
            const stress = await runPseudoStress(page, { expansion: PSEUDO_EXPANSION });
            if (stress.rootOverflow > 1 || stress.clipped || stress.outside) finding('medium', 'pseudo-long-string-overflow', locale.code, item.path, viewport.name, { expansion: PSEUDO_EXPANSION, ...stress });
          }
          await persistEvidence(page, evidenceArgs(locale.code, item.archetype, item.path, viewport));
          if (viewport.name === 'small-mobile' || viewport.name === 'desktop') await exerciseKeyboard(page, evidenceArgs(locale.code, item.archetype, item.path, viewport));
          if (viewport.name === 'small-mobile') await exerciseSecondaryStates(page, evidenceArgs(locale.code, item.archetype, item.path, viewport));
        } catch (error) {
          handleAuditError(error, locale.code, item.path, viewport.name);
        } finally {
          detach();
          await context.close();
        }
      }
    }
    report.longStrings[locale.code] = report.longStrings[locale.code].sort((a, b) => b.riskScore - a.riskScore).slice(0, 30);
  }
}

async function run404Matrix(browser) {
  for (const locale of locales) {
    const path = missingPathFor(locale.code);
    for (const viewport of viewports.filter((item) => item.name === 'small-mobile' || item.name === 'desktop')) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      try {
        await goto(page, path, 404, true);
        const state = await inspectRenderedPage(page, { expectedLang: locale.code.toLowerCase(), lightweight: false });
        addStateFindings(locale.code, path, viewport.name, state, false, true);
        await persistEvidence(page, evidenceArgs(locale.code, '404', path, viewport));
        await exerciseKeyboard(page, evidenceArgs(locale.code, '404', path, viewport));
      } catch (error) {
        handleAuditError(error, locale.code, path, viewport.name);
      } finally {
        await context.close();
      }
    }
  }
}

function addStateFindings(locale, path, viewport, state, lightweight, is404) {
  const expected = locale.toLowerCase();
  if (state.lang !== expected) finding('high', is404 ? 'localized-404-language-mismatch' : 'html-lang-mismatch', locale, path, viewport, { actual: state.lang, expected });
  if (!is404 && state.canonical !== state.expectedCanonical) finding('high', 'canonical-mismatch', locale, path, viewport, { actual: state.canonical, expected: state.expectedCanonical });
  if (state.rootOverflow > 1) finding('high', 'page-horizontal-overflow', locale, path, viewport, { overflowPx: state.rootOverflow });
  for (const item of state.outsideInteractive) finding('high', 'interactive-outside-viewport', locale, path, viewport, item);
  for (const item of state.clippedText) finding('medium', 'clipped-text', locale, path, viewport, item);
  for (const item of state.hiddenFocusable) finding('high', 'hidden-focusable', locale, path, viewport, item);
  for (const item of state.suspiciousAttrs) finding('high', 'accessible-name-english-leak', locale, path, viewport, item);
  if (!is404) validateLanguageMetadata(locale, path, viewport, state);
  if (!lightweight) {
    for (const item of state.tinyTargets) finding('low', 'small-target', locale, path, viewport, item);
    if (!state.metaDescription.trim()) finding('medium', 'missing-meta-description', locale, path, viewport, {});
  }
}

function validateLanguageMetadata(locale, path, viewport, state) {
  const byLang = new Map(state.alternates.map((item) => [item.hreflang.toLowerCase(), item.href]));
  if (locale !== canonicalLocale) {
    const self = byLang.get(locale.toLowerCase());
    if (self && self !== state.expectedCanonical) finding('high', 'hreflang-mismatch', locale, path, viewport, { hreflang: locale, actual: self, expected: state.expectedCanonical });
    if (byLang.has('x-default') && byLang.has('en') && byLang.get('x-default') !== byLang.get('en')) finding('high', 'hreflang-mismatch', locale, path, viewport, { hreflang: 'x-default', actual: byLang.get('x-default'), expected: byLang.get('en') });
  } else if (byLang.has('x-default') && byLang.get('x-default') !== state.expectedCanonical) {
    finding('high', 'hreflang-mismatch', locale, path, viewport, { hreflang: 'x-default', actual: byLang.get('x-default'), expected: state.expectedCanonical });
  }
  if (state.ogLocale && !localeMatches(state.ogLocale.replace('_', '-'), locale)) finding('medium', 'og-locale-mismatch', locale, path, viewport, { actual: state.ogLocale, expected: locale });
  const mismatched = [...new Set(state.inLanguages)].filter((value) => !localeMatches(value, locale));
  if (mismatched.length) finding('medium', 'structured-data-language-mismatch', locale, path, viewport, { values: mismatched });
}

function runtimeArgs(locale, path, viewport) {
  return { baseUrl: BASE_URL, locale, path, viewport, onFinding: finding, runtime: report.runtime };
}

function evidenceArgs(locale, archetype, path, viewport) {
  return { outDir: OUT_DIR, locale, archetype, path, viewport, onFinding: finding, canonicalLocale };
}

async function goto(page, path, expectedStatus, settle) {
  const url = new URL(path, `${BASE_URL}/`).href;
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  if (!response) throw new Error(`navigation:no response ${url}`);
  if (response.status() !== expectedStatus && !(expectedStatus === 200 && response.status() < 400)) throw new Error(`navigation:${response.status()} expected ${expectedStatus} ${url}`);
  if (settle) await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  return response;
}

function handleAuditError(error, locale, path, viewport) {
  const message = String(error?.message || error);
  if (message.startsWith('instrumentation:')) {
    report.instrumentationErrors.push({ locale, path, viewport, message });
    throw error;
  }
  finding('high', 'navigation-failed', locale, path, viewport, { message });
}

function finding(severity, type, locale, path, viewport, details = {}) {
  const signature = JSON.stringify([severity, type, locale, path, viewport, details]);
  if (!finding.seen) finding.seen = new Set();
  if (finding.seen.has(signature)) return;
  finding.seen.add(signature);
  report.findings.push({ severity, type, locale, path, viewport, details });
}

async function loadSitemapPaths() {
  const response = await fetch(`${BASE_URL}/sitemap.xml`, { headers: { 'cache-control': 'no-cache' } });
  if (!response.ok) throw new Error(`browser_audit:sitemap ${response.status}`);
  const xml = await response.text();
  return [...new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => {
    try { return normalizePathname(new URL(decodeXml(match[1])).pathname); } catch { return null; }
  }).filter(Boolean))].sort();
}

function pathsForLocale(code, paths) {
  const base = localeBases.get(code);
  if (code === canonicalLocale) return paths.filter((path) => !nonCanonicalBases.some((localeBase) => path.startsWith(localeBase)));
  return paths.filter((path) => path.startsWith(base));
}

function selectArchetypes(code, paths) {
  const base = localeBases.get(code);
  const relative = (path) => path.slice(base === '/' ? 1 : base.length).replace(/^\//, '');
  const groups = new Map([['home', [paths.find((path) => path === base) || base]]]);
  for (const path of paths) {
    if (path === base) continue;
    const segment = relative(path).split('/').filter(Boolean)[0] || 'other';
    if (!groups.has(segment)) groups.set(segment, []);
    groups.get(segment).push(path);
  }
  const preferred = ['explore', 'biases', 'bias', 'bias-cognitivi', 'techniques', 'tecniche', 'contexts', 'guides', 'skills', 'competenze', 'agent-skills', 'practice', 'research', 'articles', 'everyday', 'categories', 'compare', 'evidence', 'data', 'glossary'];
  const ordered = ['home', ...preferred.filter((name) => groups.has(name)), ...[...groups.keys()].filter((name) => name !== 'home' && !preferred.includes(name)).sort()];
  const selected = [];
  for (const name of ordered.slice(0, MAX_GROUPS)) {
    const candidates = [...(groups.get(name) || [])].sort((a, b) => a.length - b.length);
    if (!candidates.length) continue;
    selected.push({ archetype: name, path: candidates[0] });
    const detail = candidates.filter((path) => path !== candidates[0]).sort((a, b) => b.length - a.length)[0];
    if (detail) selected.push({ archetype: `${name}-detail`, path: detail });
  }
  return uniqueBy(selected, (item) => item.path).slice(0, MAX_GROUPS + 5);
}

function missingPathFor(locale) {
  const base = localeBases.get(locale);
  return `${base}${base.endsWith('/') ? '' : '/'}__browser-audit-missing__/`.replace(/\/+/g, '/');
}

function localeMatches(value, locale) {
  const a = String(value).toLowerCase();
  const b = String(locale).toLowerCase();
  return a === b || a.startsWith(`${b}-`) || b.startsWith(`${a}-`);
}

function summarize(items) {
  const out = { critical: 0, high: 0, medium: 0, low: 0, total: items.length };
  for (const item of items) out[item.severity] = (out[item.severity] || 0) + 1;
  return out;
}

function renderConsole() {
  const lines = [
    `Browser localization audit (${MODE})`,
    `Locales: ${locales.map((item) => item.code).join(', ')}`,
    `Viewports: ${viewports.map((item) => `${item.name}=${item.width}x${item.height}`).join(', ')}`,
    `Findings: critical=${report.summary.critical} high=${report.summary.high} medium=${report.summary.medium} low=${report.summary.low}`,
    `Instrumentation errors: ${report.instrumentationErrors.length}`,
  ];
  for (const item of report.findings.filter((finding) => finding.severity === 'critical' || finding.severity === 'high').slice(0, 50)) lines.push(`- [${item.severity}] ${item.type} ${item.locale} ${item.viewport} ${item.path} ${JSON.stringify(item.details).slice(0, 260)}`);
  return lines.join('\n');
}

function renderMarkdown() {
  const rows = locales.map((locale) => {
    const c = report.coverage[locale.code];
    return `| ${locale.code} | ${c.publishedPaths} | ${c.selected.length} | ${c.errorPath} |`;
  }).join('\n');
  const findings = report.findings.slice(0, 400).map((item) => `- **${item.severity}** \`${item.type}\` — ${item.locale} / ${item.viewport} / \`${item.path}\` — ${escapeMd(JSON.stringify(item.details))}`).join('\n') || '- None.';
  return `# Browser localization audit — ${MODE}\n\nGenerated: ${report.generatedAt}\n\n## Coverage\n\n| Locale | Published paths scanned | Representative archetypes | 404 route |\n| --- | ---: | ---: | --- |\n${rows}\n\nViewports: ${viewports.map((item) => `${item.width}×${item.height}`).join(', ')}.\n\n## Findings\n\nCritical: ${report.summary.critical}; high: ${report.summary.high}; medium: ${report.summary.medium}; low: ${report.summary.low}. Instrumentation errors: ${report.instrumentationErrors.length}.\n\n${findings}\n`;
}

function normalizePathname(value) { const path = value || '/'; return path.endsWith('/') || /\.[a-z0-9]+$/i.test(path) ? path : `${path}/`; }
function decodeXml(value) { return String(value).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"); }
function uniqueBy(items, keyFn) { const map = new Map(); for (const item of items) if (!map.has(keyFn(item))) map.set(keyFn(item), item); return [...map.values()]; }
async function writeJson(path, value) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function escapeMd(value) { return String(value).replace(/([*_`])/g, '\\$1'); }
