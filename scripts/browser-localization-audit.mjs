import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const BASE_URL = (process.env.TARGET_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const MODE = process.env.BROWSER_AUDIT_MODE || (BASE_URL.includes('127.0.0.1') ? 'local' : 'production');
const OUT_DIR = process.env.BROWSER_AUDIT_OUT || `.artifacts/localization-browser/${MODE}`;
const FULL_SCAN = process.env.BROWSER_FULL_SCAN !== '0';
const FULL_SCAN_CONCURRENCY = Math.max(1, Number(process.env.BROWSER_FULL_SCAN_CONCURRENCY || 6));
const NAV_TIMEOUT = Number(process.env.BROWSER_NAV_TIMEOUT_MS || 20000);
const MAX_GROUPS = Number(process.env.BROWSER_MAX_ARCHETYPES || 14);
const manifest = JSON.parse(await readFile('data/locales.json', 'utf8'));
const canonicalLocale = manifest.canonicalLocale || 'en';
const locales = manifest.locales || [];
const localeBases = new Map(locales.map((locale) => [locale.code, locale.code === canonicalLocale ? '/' : (locale.urlBase || `/${locale.code.toLowerCase()}/`)]));
const nonCanonicalBases = [...localeBases.entries()].filter(([code]) => code !== canonicalLocale).map(([, base]) => base);
const viewports = [
  { name: 'small-mobile', width: 320, height: 568 },
  { name: 'mobile', width: 375, height: 667 },
  { name: 'large-mobile', width: 430, height: 932 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1366, height: 900 },
];
const keyboardViewports = new Set(['small-mobile', 'desktop']);
const evidenceViewports = new Set(viewports.map((item) => item.name));
const highSeverityTypes = new Set([
  'navigation-failed', 'page-horizontal-overflow', 'interactive-outside-viewport', 'focus-trap',
  'focus-hidden', 'menu-focus-state', 'runtime-error', 'resource-error', 'html-lang-mismatch',
  'canonical-mismatch', 'accessible-name-english-leak', 'metadata-language-leak',
]);

await mkdir(OUT_DIR, { recursive: true });
const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  mode: MODE,
  baseUrl: BASE_URL,
  canonicalLocale,
  locales: locales.map((locale) => ({ ...locale, routeBase: localeBases.get(locale.code) })),
  viewports,
  coverage: {},
  findings: [],
  runtime: [],
  longStrings: {},
  summary: {},
};

const sitemapPaths = await loadSitemapPaths();
const pathsByLocale = new Map(locales.map((locale) => [locale.code, pathsForLocale(locale.code, sitemapPaths)]));
for (const locale of locales) {
  const paths = pathsByLocale.get(locale.code) || [];
  const selected = selectArchetypes(locale.code, paths);
  report.coverage[locale.code] = {
    publishedPaths: paths.length,
    selected: selected.map((item) => ({ archetype: item.archetype, path: item.path })),
  };
}

const browser = await chromium.launch({ headless: true });
try {
  if (FULL_SCAN) await runFullCorpusScan(browser);
  await runEvidenceMatrix(browser);
  report.summary = summarize(report.findings);
  await writeJson(join(OUT_DIR, 'report.json'), report);
  await writeFile(join(OUT_DIR, 'summary.md'), renderSummaryMarkdown(report), 'utf8');
  console.log(renderConsoleSummary(report));
  if (report.summary.high + report.summary.critical > 0) process.exitCode = 1;
} finally {
  await browser.close();
}

async function loadSitemapPaths() {
  const response = await fetch(`${BASE_URL}/sitemap.xml`, { headers: { 'cache-control': 'no-cache' } });
  if (!response.ok) throw new Error(`browser_audit:sitemap ${response.status} ${BASE_URL}/sitemap.xml`);
  const xml = await response.text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => {
    try { return normalizePathname(new URL(decodeXml(match[1])).pathname); } catch { return null; }
  }).filter(Boolean);
  return [...new Set(paths)].sort();
}

function pathsForLocale(code, paths) {
  const base = localeBases.get(code);
  if (code === canonicalLocale) {
    return paths.filter((path) => !nonCanonicalBases.some((localeBase) => path.startsWith(localeBase)));
  }
  return paths.filter((path) => path.startsWith(base));
}

function selectArchetypes(code, paths) {
  const base = localeBases.get(code);
  const relative = (path) => path.slice(base === '/' ? 1 : base.length).replace(/^\//, '');
  const groups = new Map();
  const home = paths.find((path) => path === base) || base;
  groups.set('home', [home]);
  for (const path of paths) {
    if (path === home) continue;
    const rel = relative(path);
    const segment = rel.split('/').filter(Boolean)[0] || 'other';
    if (!groups.has(segment)) groups.set(segment, []);
    groups.get(segment).push(path);
  }
  const preferred = ['explore', 'biases', 'techniques', 'contexts', 'guides', 'skills', 'practice', 'research', 'articles', 'everyday', 'kinds', 'categories', 'compare', 'evidence', 'data', 'experiments', 'glossary'];
  const ordered = ['home', ...preferred.filter((name) => groups.has(name)), ...[...groups.keys()].filter((name) => name !== 'home' && !preferred.includes(name)).sort()];
  const selected = [];
  for (const name of ordered.slice(0, MAX_GROUPS)) {
    const candidates = groups.get(name) || [];
    if (!candidates.length) continue;
    const index = candidates.sort((a, b) => a.length - b.length)[0];
    selected.push({ archetype: name, path: index });
    const detail = candidates.filter((path) => path !== index).sort((a, b) => b.length - a.length)[0];
    if (detail && ['biases', 'techniques', 'contexts', 'guides', 'skills', 'practice', 'research', 'articles', 'everyday', 'compare', 'evidence'].includes(name)) {
      selected.push({ archetype: `${name}-detail`, path: detail });
    }
  }
  return uniqueBy(selected, (item) => item.path).slice(0, MAX_GROUPS + 6);
}

async function runFullCorpusScan(browser) {
  const jobs = [];
  for (const locale of locales) for (const path of pathsByLocale.get(locale.code) || []) jobs.push({ locale: locale.code, path });
  let cursor = 0;
  const workers = Array.from({ length: Math.min(FULL_SCAN_CONCURRENCY, jobs.length) }, async () => {
    const context = await browser.newContext({ viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    while (cursor < jobs.length) {
      const index = cursor++;
      const job = jobs[index];
      const runtime = attachRuntimeCollectors(page, job.locale, job.path, 'full-scan');
      try {
        await gotoPath(page, job.path);
        const state = await inspectPage(page, job.locale, job.path, { width: 320, height: 568, name: 'small-mobile' }, { lightweight: true });
        addStateFindings(job.locale, job.path, 'small-mobile', state, true);
      } catch (error) {
        addFinding('high', 'navigation-failed', job.locale, job.path, 'small-mobile', { message: String(error?.message || error) });
      } finally {
        runtime.flush();
      }
    }
    await context.close();
  });
  await Promise.all(workers);
}

async function runEvidenceMatrix(browser) {
  for (const locale of locales) {
    const selected = report.coverage[locale.code].selected;
    report.longStrings[locale.code] = [];
    for (const item of selected) {
      for (const viewport of viewports) {
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        const runtime = attachRuntimeCollectors(page, locale.code, item.path, viewport.name);
        try {
          await gotoPath(page, item.path);
          const state = await inspectPage(page, locale.code, item.path, viewport, { lightweight: false });
          addStateFindings(locale.code, item.path, viewport.name, state, false);
          if (viewport.name === 'small-mobile') report.longStrings[locale.code].push(...state.longStrings.map((entry) => ({ path: item.path, ...entry })));
          await persistEvidence(page, locale.code, item.archetype, item.path, viewport);
          if (keyboardViewports.has(viewport.name)) await exerciseKeyboard(page, locale.code, item.archetype, item.path, viewport);
          if (viewport.name === 'small-mobile') await exerciseSecondaryStates(page, locale.code, item.archetype, item.path, viewport);
        } catch (error) {
          addFinding('high', 'navigation-failed', locale.code, item.path, viewport.name, { message: String(error?.message || error) });
        } finally {
          runtime.flush();
          await context.close();
        }
      }
    }
    report.longStrings[locale.code] = report.longStrings[locale.code]
      .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
      .slice(0, 30);
  }
}

async function gotoPath(page, path) {
  const url = new URL(path, `${BASE_URL}/`).href;
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  if (!response) throw new Error(`No response for ${url}`);
  if (response.status() >= 400) throw new Error(`${response.status()} ${url}`);
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
}

async function inspectPage(page, locale, path, viewport, { lightweight }) {
  const expectedLang = locale.toLowerCase();
  const expectedCanonical = canonicalFor(locale, path);
  const state = await page.evaluate(({ expectedLang, expectedCanonical }) => {
    const root = document.documentElement;
    const visible = (el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
    const rectData = (rect) => ({ x: round(rect.x), y: round(rect.y), width: round(rect.width), height: round(rect.height), right: round(rect.right), bottom: round(rect.bottom) });
    const selectorHint = (el) => {
      if (el.id) return `#${CSS.escape(el.id)}`;
      const data = [...el.attributes].find((attr) => attr.name.startsWith('data-') && /menu|search|filter|nav|card|dialog|modal|tab|chip|badge/.test(attr.name));
      if (data) return `${el.tagName.toLowerCase()}[${data.name}]`;
      const cls = [...el.classList].slice(0, 2).map((name) => `.${CSS.escape(name)}`).join('');
      return `${el.tagName.toLowerCase()}${cls}`;
    };
    const rootOverflow = Math.max(root.scrollWidth, document.body?.scrollWidth || 0) - innerWidth;
    const outsideInteractive = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')]
      .filter((el) => visible(el) && !el.closest('[hidden],[inert],[aria-hidden="true"]'))
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => rect.left < -1 || rect.right > innerWidth + 1)
      .slice(0, 20)
      .map(({ el, rect }) => ({ selector: selectorHint(el), text: text(el).slice(0, 120), rect: rectData(rect) }));
    const clippedText = [...document.querySelectorAll('button,a,label,p,li,h1,h2,h3,h4,span,td,th')]
      .filter((el) => visible(el) && text(el))
      .filter((el) => {
        const style = getComputedStyle(el);
        const clipX = ['hidden', 'clip'].includes(style.overflowX);
        const clipY = ['hidden', 'clip'].includes(style.overflowY);
        return (clipX && el.scrollWidth > el.clientWidth + 1) || (clipY && el.scrollHeight > el.clientHeight + 1);
      })
      .slice(0, 25)
      .map((el) => ({ selector: selectorHint(el), text: text(el).slice(0, 160), clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight }));
    const tinyTargets = [...document.querySelectorAll('a[href],button,input,select,[role="button"],[role="tab"]')]
      .filter((el) => visible(el))
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => (rect.width < 24 || rect.height < 24))
      .slice(0, 25)
      .map(({ el, rect }) => ({ selector: selectorHint(el), text: text(el).slice(0, 100), rect: rectData(rect) }));
    const lang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    const canonical = document.querySelector('link[rel="canonical"]')?.href || '';
    const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
    const ogLocale = document.querySelector('meta[property="og:locale"]')?.content || '';
    const alternates = [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((el) => ({ hreflang: el.hreflang, href: el.href }));
    const suspiciousAttrs = [];
    if (expectedLang !== 'en') {
      const englishUi = /\b(search|menu|close|open|next|previous|save|share|copy link|cite|filter|clear|reset|no results|skip to content|main navigation|language|show|hide|back|read more|current page)\b/i;
      for (const el of document.querySelectorAll('[aria-label],[aria-description],[title],[placeholder]')) {
        if (el.closest('[lang="en"]') || el.getAttribute('lang') === 'en') continue;
        for (const attr of ['aria-label', 'aria-description', 'title', 'placeholder']) {
          const value = el.getAttribute(attr) || '';
          if (value && englishUi.test(value)) suspiciousAttrs.push({ selector: selectorHint(el), attr, value: value.slice(0, 160) });
        }
      }
    }
    const candidates = [...document.querySelectorAll('button,a,label,h1,h2,h3,[class*="badge"],[class*="chip"],[class*="tab"],[class*="breadcrumb"],input[placeholder]')]
      .filter((el) => visible(el))
      .map((el) => {
        const value = el instanceof HTMLInputElement ? el.placeholder : text(el);
        if (!value || value.length < 8) return null;
        const rect = el.getBoundingClientRect();
        const words = value.split(/\s+/).filter(Boolean);
        const longestWord = words.sort((a, b) => b.length - a.length)[0] || '';
        const constrained = rect.width < innerWidth * 0.75;
        const riskScore = value.length + Math.max(0, longestWord.length - 12) * 4 + (constrained ? 20 : 0) + (el.scrollWidth > el.clientWidth + 1 ? 100 : 0);
        return { selector: selectorHint(el), text: value.slice(0, 240), chars: value.length, longestWordChars: longestWord.length, width: round(rect.width), linesApprox: Math.max(1, Math.round(rect.height / Math.max(1, parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.2))), riskScore };
      }).filter(Boolean).sort((a, b) => b.riskScore - a.riskScore).slice(0, 30);
    const hiddenFocusable = [...document.querySelectorAll('[aria-hidden="true"] a[href],[aria-hidden="true"] button,[aria-hidden="true"] input,[aria-hidden="true"] select,[aria-hidden="true"] textarea,[aria-hidden="true"] [tabindex]')]
      .filter((el) => !el.hasAttribute('disabled') && Number(el.getAttribute('tabindex') || 0) >= 0)
      .slice(0, 20)
      .map((el) => ({ selector: selectorHint(el), text: text(el).slice(0, 100) }));
    return { rootOverflow, outsideInteractive, clippedText, tinyTargets, lang, canonical, metaDescription, ogLocale, alternates, suspiciousAttrs, longStrings: candidates, hiddenFocusable, title: document.title, expectedLang, expectedCanonical };
  }, { expectedLang, expectedCanonical });
  if (!lightweight) {
    state.headings = await page.locator('h1,h2,h3').allTextContents().catch(() => []);
  }
  return state;
}

function addStateFindings(locale, path, viewport, state, lightweight) {
  const expected = locale.toLowerCase();
  if (state.lang !== expected) addFinding('high', 'html-lang-mismatch', locale, path, viewport, { actual: state.lang, expected });
  if (state.canonical !== state.expectedCanonical) addFinding('high', 'canonical-mismatch', locale, path, viewport, { actual: state.canonical, expected: state.expectedCanonical });
  if (state.rootOverflow > 1) addFinding('high', 'page-horizontal-overflow', locale, path, viewport, { overflowPx: state.rootOverflow });
  for (const item of state.outsideInteractive) addFinding('high', 'interactive-outside-viewport', locale, path, viewport, item);
  for (const item of state.clippedText) addFinding('medium', 'clipped-text', locale, path, viewport, item);
  for (const item of state.hiddenFocusable) addFinding('high', 'hidden-focusable', locale, path, viewport, item);
  for (const item of state.suspiciousAttrs) addFinding('high', 'accessible-name-english-leak', locale, path, viewport, item);
  if (!lightweight) {
    for (const item of state.tinyTargets) addFinding('low', 'small-target', locale, path, viewport, item);
    if (!state.metaDescription.trim()) addFinding('medium', 'missing-meta-description', locale, path, viewport, {});
  }
}

async function persistEvidence(page, locale, archetype, path, viewport) {
  if (!evidenceViewports.has(viewport.name)) return;
  const base = safeName(`${locale}__${archetype}__${path}__${viewport.name}`);
  const screenshotPath = join(OUT_DIR, 'screenshots', `${base}.png`);
  const domPath = join(OUT_DIR, 'dom', `${base}.html`);
  const axPath = join(OUT_DIR, 'accessibility', `${base}.yml`);
  await mkdir(dirname(screenshotPath), { recursive: true });
  await mkdir(dirname(domPath), { recursive: true });
  await mkdir(dirname(axPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: false, animations: 'disabled' });
  await writeFile(domPath, await page.content(), 'utf8');
  let ax = '';
  try { ax = await page.locator('body').ariaSnapshot({ timeout: 5000 }); }
  catch (error) { ax = `# ariaSnapshot failed: ${String(error?.message || error)}\n`; addFinding('medium', 'accessibility-snapshot-failed', locale, path, viewport.name, { message: String(error?.message || error) }); }
  await writeFile(axPath, ax, 'utf8');
  if (locale !== canonicalLocale) scanAccessibilitySnapshotForEnglish(locale, path, viewport.name, ax);
}

function scanAccessibilitySnapshotForEnglish(locale, path, viewport, snapshot) {
  const lines = snapshot.split('\n');
  const englishUi = /\b(Search|Menu|Close|Open|Next|Previous|Save|Share|Copy link|Cite|Filter|Clear|Reset|No results|Skip to content|Main navigation|Language|Show|Hide|Back|Read more|Current page)\b/;
  const hits = lines.filter((line) => englishUi.test(line) && !/English|Cognitive Biases|GitHub|DOI|AI|LLM/.test(line)).slice(0, 12);
  for (const line of hits) addFinding('high', 'accessible-name-english-leak', locale, path, viewport, { ariaSnapshotLine: line.trim().slice(0, 220) });
}

async function exerciseKeyboard(page, locale, archetype, path, viewport) {
  const focusDir = join(OUT_DIR, 'focus');
  await mkdir(focusDir, { recursive: true });
  const visited = [];
  let repeated = 0;
  for (let i = 0; i < 36; i += 1) {
    await page.keyboard.press('Tab');
    const state = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
      const visibleFocus = (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none';
      return {
        tag: el.tagName.toLowerCase(), id: el.id || '', label: label.slice(0, 120), href: el.getAttribute('href') || '',
        rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
        visibleFocus, outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`, boxShadow: style.boxShadow,
      };
    });
    if (!state) continue;
    const signature = `${state.tag}|${state.id}|${state.href}|${state.label}`;
    if (visited.includes(signature)) repeated += 1; else repeated = 0;
    visited.push(signature);
    if (state.rect.right < 0 || state.rect.left > viewport.width || state.rect.bottom < 0 || state.rect.top > viewport.height) {
      addFinding('high', 'focus-hidden', locale, path, viewport.name, state);
    }
    if (!state.visibleFocus) addFinding('medium', 'focus-indicator-weak', locale, path, viewport.name, state);
    if (i < 3) {
      const name = safeName(`${locale}__${archetype}__${path}__${viewport.name}__focus-${i + 1}`);
      await page.screenshot({ path: join(focusDir, `${name}.png`), fullPage: false, animations: 'disabled' });
    }
    if (repeated >= 2) {
      addFinding('high', 'focus-trap', locale, path, viewport.name, { sequence: visited.slice(-6) });
      break;
    }
  }

  const toggles = page.locator('button[aria-expanded][aria-controls]');
  const count = await toggles.count().catch(() => 0);
  if (count) {
    const toggle = toggles.first();
    const before = await toggle.getAttribute('aria-expanded');
    await toggle.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    const after = await toggle.getAttribute('aria-expanded');
    if (before === after || after !== 'true') addFinding('high', 'menu-focus-state', locale, path, viewport.name, { message: 'aria-expanded did not become true with keyboard', before, after });
    if (after === 'true') {
      const expandedAx = await page.locator('body').ariaSnapshot().catch(() => '');
      const name = safeName(`${locale}__${archetype}__${path}__${viewport.name}__menu-open`);
      await page.screenshot({ path: join(focusDir, `${name}.png`), fullPage: false, animations: 'disabled' });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      const closed = await toggle.getAttribute('aria-expanded');
      const activeIsToggle = await toggle.evaluate((el) => document.activeElement === el).catch(() => false);
      if (closed !== 'false') addFinding('high', 'menu-focus-state', locale, path, viewport.name, { message: 'Escape did not close expanded control', closed });
      if (!activeIsToggle) addFinding('medium', 'menu-focus-return', locale, path, viewport.name, { message: 'Focus did not return to menu toggle after Escape' });
      const closedAx = await page.locator('body').ariaSnapshot().catch(() => '');
      if (expandedAx && closedAx && expandedAx === closedAx) addFinding('medium', 'menu-accessibility-state-static', locale, path, viewport.name, { message: 'ARIA snapshot did not change between menu open and closed states' });
    }
  }
}

async function exerciseSecondaryStates(page, locale, archetype, path, viewport) {
  const search = page.locator('input[type="search"]:visible').first();
  if (await search.count().catch(() => 0)) {
    const stateDir = join(OUT_DIR, 'states');
    await mkdir(stateDir, { recursive: true });
    const original = await search.inputValue().catch(() => '');
    await search.fill('zzzzzz-browser-localization-no-result');
    await page.waitForTimeout(150);
    const name = safeName(`${locale}__${archetype}__${path}__${viewport.name}__search-no-results`);
    await page.screenshot({ path: join(stateDir, `${name}.png`), fullPage: false, animations: 'disabled' });
    const ax = await page.locator('body').ariaSnapshot().catch(() => '');
    await writeFile(join(stateDir, `${name}.aria.yml`), ax, 'utf8');
    await search.fill(original);
  }

  const disclosure = page.locator('[aria-expanded="false"][aria-controls]:visible').first();
  if (await disclosure.count().catch(() => 0)) {
    const before = await disclosure.getAttribute('aria-expanded');
    await disclosure.click().catch(() => {});
    await page.waitForTimeout(100);
    const after = await disclosure.getAttribute('aria-expanded');
    if (before === after) addFinding('medium', 'interaction-state-static', locale, path, viewport.name, { archetype, message: 'Disclosure did not update aria-expanded after activation' });
    if (after === 'true') await page.keyboard.press('Escape').catch(() => {});
  }
}

function attachRuntimeCollectors(page, locale, path, viewport) {
  const seen = [];
  const onConsole = (message) => {
    if (message.type() === 'error') seen.push({ type: 'runtime-error', message: message.text().slice(0, 500) });
  };
  const onPageError = (error) => seen.push({ type: 'runtime-error', message: String(error?.message || error).slice(0, 500) });
  const onResponse = (response) => {
    const status = response.status();
    if (status < 400) return;
    const url = response.url();
    if (url === new URL(path, `${BASE_URL}/`).href && status === 404) return;
    if (url.startsWith(BASE_URL)) seen.push({ type: 'resource-error', status, url: url.slice(0, 500) });
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('response', onResponse);
  return {
    flush() {
      for (const entry of uniqueBy(seen, (item) => JSON.stringify(item))) {
        report.runtime.push({ locale, path, viewport, ...entry });
        addFinding('high', entry.type, locale, path, viewport, entry);
      }
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      page.off('response', onResponse);
    }
  };
}

function addFinding(severity, type, locale, path, viewport, details = {}) {
  const signature = JSON.stringify([severity, type, locale, path, viewport, details]);
  if (!addFinding.seen) addFinding.seen = new Set();
  if (addFinding.seen.has(signature)) return;
  addFinding.seen.add(signature);
  report.findings.push({ severity, type, locale, path, viewport, details });
}

function canonicalFor(locale, path) {
  if (MODE === 'production') return new URL(path, `${BASE_URL}/`).href;
  return new URL(path, 'https://cognitive-biases.github.io/').href;
}

function summarize(findings) {
  const out = { critical: 0, high: 0, medium: 0, low: 0, total: findings.length };
  for (const finding of findings) out[finding.severity] = (out[finding.severity] || 0) + 1;
  return out;
}

function renderConsoleSummary(value) {
  const lines = [
    `Browser localization audit (${value.mode})`,
    `Locales: ${locales.map((item) => item.code).join(', ')}`,
    `Viewports: ${viewports.map((item) => `${item.name}=${item.width}x${item.height}`).join(', ')}`,
    `Findings: critical=${value.summary.critical} high=${value.summary.high} medium=${value.summary.medium} low=${value.summary.low}`,
  ];
  for (const finding of value.findings.filter((item) => highSeverityTypes.has(item.type)).slice(0, 30)) {
    lines.push(`- [${finding.severity}] ${finding.type} ${finding.locale} ${finding.viewport} ${finding.path} ${JSON.stringify(finding.details).slice(0, 240)}`);
  }
  return lines.join('\n');
}

function renderSummaryMarkdown(value) {
  const rows = locales.map((locale) => {
    const c = value.coverage[locale.code];
    return `| ${locale.code} | ${c.publishedPaths} | ${c.selected.length} |`;
  }).join('\n');
  const findings = value.findings.slice(0, 200).map((item) => `- **${item.severity}** \`${item.type}\` — ${item.locale} / ${item.viewport} / \`${item.path}\` — ${escapeMd(JSON.stringify(item.details))}`).join('\n') || '- None.';
  return `# Browser localization audit — ${value.mode}\n\nGenerated: ${value.generatedAt}\n\n## Coverage\n\n| Locale | Published paths scanned | Representative archetypes |\n| --- | ---: | ---: |\n${rows}\n\nViewports: ${viewports.map((item) => `${item.width}×${item.height}`).join(', ')}.\n\n## Findings\n\nCritical: ${value.summary.critical}; high: ${value.summary.high}; medium: ${value.summary.medium}; low: ${value.summary.low}.\n\n${findings}\n`;
}

function normalizePathname(value) {
  const path = value || '/';
  return path.endsWith('/') || /\.[a-z0-9]+$/i.test(path) ? path : `${path}/`;
}

function safeName(value) {
  return value.replace(/^https?:\/\//, '').replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 180) || 'page';
}

function uniqueBy(items, keyFn) {
  const map = new Map();
  for (const item of items) if (!map.has(keyFn(item))) map.set(keyFn(item), item);
  return [...map.values()];
}

function decodeXml(value) {
  return String(value).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function round(value) { return Math.round(value * 10) / 10; }
async function writeJson(path, value) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function escapeMd(value) { return String(value).replace(/([*_`])/g, '\\$1'); }
