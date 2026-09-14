import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const BASE_URL = (process.env.TARGET_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const MODE = process.env.BROWSER_AUDIT_MODE || (BASE_URL.includes('127.0.0.1') ? 'local' : 'production');
const OUT_DIR = process.env.BROWSER_AUDIT_OUT || `.artifacts/localization-browser/${MODE}`;
const FULL_SCAN = process.env.BROWSER_FULL_SCAN !== '0';
const FULL_SCAN_CONCURRENCY = Math.max(1, Number(process.env.BROWSER_FULL_SCAN_CONCURRENCY || 6));
const NAV_TIMEOUT = Number(process.env.BROWSER_NAV_TIMEOUT_MS || 20000);
const MAX_ARCHETYPES = Number(process.env.BROWSER_MAX_ARCHETYPES || 14);
const PUBLIC_ORIGIN = 'https://cognitive-biases.github.io';
const manifest = JSON.parse(await readFile('data/locales.json', 'utf8'));
const canonicalLocale = manifest.canonicalLocale || 'en';
const locales = manifest.locales || [];
const localeBases = new Map(locales.map((locale) => [
  locale.code,
  locale.code === canonicalLocale ? '/' : (locale.urlBase || `/${locale.code.toLowerCase()}/`),
]));
const nonCanonicalBases = [...localeBases.entries()]
  .filter(([code]) => code !== canonicalLocale)
  .map(([, base]) => base);

const viewports = [
  { name: 'small-mobile', width: 320, height: 568 },
  { name: 'mobile', width: 375, height: 667 },
  { name: 'large-mobile', width: 430, height: 932 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1366, height: 900 },
];
const keyboardViewports = new Set(['small-mobile', 'desktop']);
const highSeverityTypes = new Set([
  'navigation-failed',
  'page-horizontal-overflow',
  'interactive-outside-viewport',
  'hidden-focusable',
  'focus-trap',
  'focus-hidden',
  'menu-focus-state',
  'runtime-error',
  'resource-error',
  'html-lang-mismatch',
  'canonical-mismatch',
  'accessible-name-english-leak',
  'metadata-language-leak',
  'stress-page-horizontal-overflow',
]);

await mkdir(OUT_DIR, { recursive: true });
const report = {
  version: 2,
  generatedAt: new Date().toISOString(),
  mode: MODE,
  baseUrl: BASE_URL,
  canonicalLocale,
  qualityLevels: [
    'source',
    'generated-output',
    'rendered-browser-experience',
    'accessibility-machine-interpretation',
  ],
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
  if (report.summary.critical + report.summary.high > 0) process.exitCode = 1;
} finally {
  await browser.close();
}

async function loadSitemapPaths() {
  const response = await fetch(`${BASE_URL}/sitemap.xml`, { headers: { 'cache-control': 'no-cache' } });
  if (!response.ok) throw new Error(`browser_audit:sitemap ${response.status} ${BASE_URL}/sitemap.xml`);
  const xml = await response.text();
  return [...new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => {
      try { return normalizePathname(new URL(decodeXml(match[1])).pathname); }
      catch { return null; }
    })
    .filter(Boolean))].sort();
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
    const first = relative(path).split('/').filter(Boolean)[0] || 'other';
    if (!groups.has(first)) groups.set(first, []);
    groups.get(first).push(path);
  }
  const preferred = [
    'explore', 'biases', 'bias', 'techniques', 'contexts', 'situations', 'guides', 'skills',
    'practice', 'research', 'articles', 'everyday', 'kinds', 'categories', 'compare', 'evidence',
    'data', 'experiments', 'glossary', 'agent-skills',
  ];
  const ordered = [
    'home',
    ...preferred.filter((name) => groups.has(name)),
    ...[...groups.keys()].filter((name) => name !== 'home' && !preferred.includes(name)).sort(),
  ];
  const selected = [];
  for (const name of ordered) {
    if (selected.length >= MAX_ARCHETYPES + 6) break;
    const candidates = (groups.get(name) || []).sort((a, b) => a.length - b.length || a.localeCompare(b));
    if (!candidates.length) continue;
    selected.push({ archetype: name, path: candidates[0] });
    const detail = [...candidates].filter((path) => path !== candidates[0]).sort((a, b) => b.length - a.length)[0];
    if (detail && /bias|techniques|contexts|situations|guides|skills|practice|research|articles|everyday|compare|evidence|agent-skills/.test(name)) {
      selected.push({ archetype: `${name}-detail`, path: detail });
    }
  }
  return uniqueBy(selected, (item) => item.path).slice(0, MAX_ARCHETYPES + 6);
}

async function runFullCorpusScan(browser) {
  const jobs = [];
  for (const locale of locales) {
    for (const path of pathsByLocale.get(locale.code) || []) jobs.push({ locale: locale.code, path });
  }
  let cursor = 0;
  const workers = Array.from({ length: Math.min(FULL_SCAN_CONCURRENCY, Math.max(1, jobs.length)) }, async () => {
    const context = await browser.newContext({ viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      const runtime = attachRuntimeCollectors(page, job.locale, job.path, 'small-mobile-full-scan');
      try {
        await gotoPath(page, job.path);
        const state = await inspectPage(page, job.locale, job.path, { name: 'small-mobile', width: 320, height: 568 }, true);
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
    report.longStrings[locale.code] = [];
    const selected = report.coverage[locale.code].selected;
    for (const item of selected) {
      for (const viewport of viewports) {
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        const runtime = attachRuntimeCollectors(page, locale.code, item.path, viewport.name);
        try {
          await gotoPath(page, item.path);
          const state = await inspectPage(page, locale.code, item.path, viewport, false);
          addStateFindings(locale.code, item.path, viewport.name, state, false);
          if (viewport.name === 'small-mobile') {
            report.longStrings[locale.code].push(...state.longStrings.map((entry) => ({ path: item.path, ...entry })));
          }
          await persistEvidence(context, page, locale.code, item.archetype, item.path, viewport);
          if (keyboardViewports.has(viewport.name)) await exerciseKeyboard(page, locale.code, item.archetype, item.path, viewport);
          if (viewport.name === 'small-mobile') {
            await exerciseSecondaryStates(page, locale.code, item.archetype, item.path, viewport);
            await stressLongStrings(page, locale.code, item.archetype, item.path, viewport);
          }
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
      .slice(0, 40);
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

async function inspectPage(page, locale, path, viewport, lightweight) {
  const expectedLang = locale.toLowerCase();
  const expectedCanonical = canonicalFor(path);
  const expectedLocaleCodes = locales.map((item) => item.code.toLowerCase());
  return page.evaluate(({ expectedLang, expectedCanonical, expectedLocaleCodes, lightweight }) => {
    const roundLocal = (value) => Math.round(value * 10) / 10;
    const root = document.documentElement;
    const visible = (el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
    const rectData = (rect) => ({
      x: roundLocal(rect.x), y: roundLocal(rect.y), width: roundLocal(rect.width), height: roundLocal(rect.height),
      right: roundLocal(rect.right), bottom: roundLocal(rect.bottom),
    });
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
      .map((el) => ({
        selector: selectorHint(el), text: text(el).slice(0, 160),
        clientWidth: el.clientWidth, scrollWidth: el.scrollWidth,
        clientHeight: el.clientHeight, scrollHeight: el.scrollHeight,
      }));

    const tinyTargets = lightweight ? [] : [...document.querySelectorAll('a[href],button,input,select,[role="button"],[role="tab"]')]
      .filter((el) => visible(el))
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width < 24 || rect.height < 24)
      .slice(0, 25)
      .map(({ el, rect }) => ({ selector: selectorHint(el), text: text(el).slice(0, 100), rect: rectData(rect) }));

    const lang = (root.getAttribute('lang') || '').toLowerCase();
    const canonical = document.querySelector('link[rel="canonical"]')?.href || '';
    const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
    const ogLocale = document.querySelector('meta[property="og:locale"]')?.content || '';
    const alternates = [...document.querySelectorAll('link[rel="alternate"][hreflang]')]
      .map((el) => ({ hreflang: (el.getAttribute('hreflang') || '').toLowerCase(), href: el.href }));
    const alternateDuplicates = alternates
      .map((item) => item.hreflang)
      .filter((value, index, all) => value && all.indexOf(value) !== index);
    const selfAlternate = alternates.find((item) => item.hreflang === expectedLang);
    const xDefault = alternates.find((item) => item.hreflang === 'x-default');
    const jsonLd = [];
    for (const [index, script] of [...document.querySelectorAll('script[type="application/ld+json"]')].entries()) {
      try {
        const value = JSON.parse(script.textContent || 'null');
        const languages = [];
        const walk = (node) => {
          if (!node || typeof node !== 'object') return;
          if (Array.isArray(node)) { for (const item of node) walk(item); return; }
          if (typeof node.inLanguage === 'string') languages.push(node.inLanguage.toLowerCase());
          else if (Array.isArray(node.inLanguage)) languages.push(...node.inLanguage.filter((item) => typeof item === 'string').map((item) => item.toLowerCase()));
          for (const item of Object.values(node)) walk(item);
        };
        walk(value);
        jsonLd.push({ index, valid: true, languages: [...new Set(languages)] });
      } catch (error) {
        jsonLd.push({ index, valid: false, error: String(error?.message || error) });
      }
    }

    const suspiciousAttrs = [];
    if (expectedLang !== 'en') {
      const englishUi = /\b(search|menu|close|open|next|previous|save|share|copy link|cite|filter|clear|reset|no results|skip to content|main navigation|language|show|hide|back|read more|current page)\b/i;
      for (const el of document.querySelectorAll('[aria-label],[aria-description],[title],[placeholder]')) {
        if (el.closest('[lang="en"]') || (el.getAttribute('lang') || '').toLowerCase() === 'en') continue;
        for (const attr of ['aria-label', 'aria-description', 'title', 'placeholder']) {
          const value = el.getAttribute(attr) || '';
          if (value && englishUi.test(value)) suspiciousAttrs.push({ selector: selectorHint(el), attr, value: value.slice(0, 160) });
        }
      }
    }

    const longStrings = [...document.querySelectorAll('button,a,label,h1,h2,h3,[class*="badge"],[class*="chip"],[class*="tab"],[class*="breadcrumb"],input[placeholder]')]
      .filter((el) => visible(el))
      .map((el) => {
        const value = el instanceof HTMLInputElement ? el.placeholder : text(el);
        if (!value || value.length < 8) return null;
        const rect = el.getBoundingClientRect();
        const words = value.split(/\s+/).filter(Boolean).sort((a, b) => b.length - a.length);
        const longestWord = words[0] || '';
        const constrained = rect.width < innerWidth * 0.75;
        const riskScore = value.length + Math.max(0, longestWord.length - 12) * 4 + (constrained ? 20 : 0) + (el.scrollWidth > el.clientWidth + 1 ? 100 : 0);
        const style = getComputedStyle(el);
        const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2 || 16;
        return {
          selector: selectorHint(el), text: value.slice(0, 240), chars: value.length,
          longestWordChars: longestWord.length, width: roundLocal(rect.width),
          linesApprox: Math.max(1, Math.round(rect.height / Math.max(1, lineHeight))), riskScore,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 30);

    const hiddenFocusable = [...document.querySelectorAll('[aria-hidden="true"] a[href],[aria-hidden="true"] button,[aria-hidden="true"] input,[aria-hidden="true"] select,[aria-hidden="true"] textarea,[aria-hidden="true"] [tabindex]')]
      .filter((el) => !el.hasAttribute('disabled') && Number(el.getAttribute('tabindex') || 0) >= 0)
      .slice(0, 20)
      .map((el) => ({ selector: selectorHint(el), text: text(el).slice(0, 100) }));

    const landmarks = lightweight ? [] : [...document.querySelectorAll('main,nav,header,footer,aside,[role="main"],[role="navigation"],[role="banner"],[role="contentinfo"]')]
      .map((el) => ({ tag: el.tagName.toLowerCase(), role: el.getAttribute('role') || '', label: el.getAttribute('aria-label') || '', visible: visible(el) }));
    const headings = lightweight ? [] : [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
      .filter(visible)
      .map((el) => ({ level: Number(el.tagName.slice(1)), text: text(el).slice(0, 180) }));

    return {
      rootOverflow, outsideInteractive, clippedText, tinyTargets, lang, canonical,
      metaDescription, ogLocale, alternates, alternateDuplicates: [...new Set(alternateDuplicates)],
      selfAlternate, xDefault, jsonLd, suspiciousAttrs, longStrings, hiddenFocusable,
      landmarks, headings, title: document.title, expectedLang, expectedCanonical,
      expectedLocaleCodes,
    };
  }, { expectedLang, expectedCanonical, expectedLocaleCodes, lightweight });
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
    if (state.alternateDuplicates.length) addFinding('medium', 'duplicate-hreflang', locale, path, viewport, { values: state.alternateDuplicates });
    if (state.alternates.length && !state.selfAlternate) addFinding('medium', 'missing-self-hreflang', locale, path, viewport, { expected });
    if (state.alternates.length && !state.xDefault) addFinding('medium', 'missing-x-default', locale, path, viewport, {});
    for (const item of state.jsonLd.filter((value) => !value.valid)) addFinding('high', 'structured-data-invalid', locale, path, viewport, item);
    const declaredLanguages = state.jsonLd.flatMap((item) => item.languages || []);
    if (declaredLanguages.length && !declaredLanguages.includes(expected)) {
      addFinding('medium', 'structured-data-language-mismatch', locale, path, viewport, { declaredLanguages: [...new Set(declaredLanguages)], expected });
    }
  }
}

async function persistEvidence(context, page, locale, archetype, path, viewport) {
  const base = safeName(`${locale}__${archetype}__${path}__${viewport.name}`);
  const screenshotPath = join(OUT_DIR, 'screenshots', `${base}.png`);
  const domPath = join(OUT_DIR, 'dom', `${base}.html`);
  const ariaPath = join(OUT_DIR, 'accessibility', `${base}.aria.yml`);
  const axPath = join(OUT_DIR, 'accessibility', `${base}.ax.json`);
  for (const file of [screenshotPath, domPath, ariaPath, axPath]) await mkdir(dirname(file), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: false, animations: 'disabled' });
  await writeFile(domPath, await page.content(), 'utf8');

  let aria = '';
  try { aria = await page.locator('body').ariaSnapshot({ timeout: 5000 }); }
  catch (error) {
    aria = `# ariaSnapshot failed: ${String(error?.message || error)}\n`;
    addFinding('medium', 'accessibility-snapshot-failed', locale, path, viewport.name, { message: String(error?.message || error) });
  }
  await writeFile(ariaPath, aria, 'utf8');

  let axTree = { nodes: [] };
  try {
    const session = await context.newCDPSession(page);
    axTree = await session.send('Accessibility.getFullAXTree');
    await session.detach();
  } catch (error) {
    addFinding('high', 'accessibility-tree-failed', locale, path, viewport.name, { message: String(error?.message || error) });
  }
  await writeJson(axPath, axTree);
  if (locale !== canonicalLocale) {
    scanAccessibilityForEnglish(locale, path, viewport.name, aria, axTree);
  }
}

function scanAccessibilityForEnglish(locale, path, viewport, aria, axTree) {
  const englishUi = /\b(Search|Menu|Close|Open|Next|Previous|Save|Share|Copy link|Cite|Filter|Clear|Reset|No results|Skip to content|Main navigation|Language|Show|Hide|Back|Read more|Current page)\b/;
  const allowed = /English|Cognitive Biases|GitHub|DOI|AI|LLM|OpenAI/;
  for (const line of aria.split('\n').filter((line) => englishUi.test(line) && !allowed.test(line)).slice(0, 12)) {
    addFinding('high', 'accessible-name-english-leak', locale, path, viewport, { ariaSnapshotLine: line.trim().slice(0, 220) });
  }
  const hits = [];
  for (const node of axTree.nodes || []) {
    const name = node?.name?.value || '';
    const description = node?.description?.value || '';
    for (const [field, value] of [['name', name], ['description', description]]) {
      if (value && englishUi.test(value) && !allowed.test(value)) hits.push({ role: node?.role?.value || '', field, value: value.slice(0, 220) });
    }
  }
  for (const hit of hits.slice(0, 12)) addFinding('high', 'accessible-name-english-leak', locale, path, viewport, hit);
}

async function exerciseKeyboard(page, locale, archetype, path, viewport) {
  const focusDir = join(OUT_DIR, 'focus');
  await mkdir(focusDir, { recursive: true });
  const visited = [];
  let repeated = 0;
  let previousSignature = null;
  for (let i = 0; i < 36; i += 1) {
    await page.keyboard.press('Tab');
    const state = await focusedState(page);
    if (!state) continue;
    const signature = `${state.tag}|${state.id}|${state.href}|${state.label}`;
    repeated = visited.includes(signature) ? repeated + 1 : 0;
    visited.push(signature);
    if (state.rect.right < 0 || state.rect.left > viewport.width || state.rect.bottom < 0 || state.rect.top > viewport.height) {
      addFinding('high', 'focus-hidden', locale, path, viewport.name, state);
    }
    if (!state.visibleFocus) addFinding('medium', 'focus-indicator-weak', locale, path, viewport.name, state);
    if (i < 3) {
      const name = safeName(`${locale}__${archetype}__${path}__${viewport.name}__focus-${i + 1}`);
      await page.screenshot({ path: join(focusDir, `${name}.png`), fullPage: false, animations: 'disabled' });
    }
    if (i === 5 && previousSignature) {
      await page.keyboard.press('Shift+Tab');
      const reverse = await focusedState(page);
      const reverseSignature = reverse ? `${reverse.tag}|${reverse.id}|${reverse.href}|${reverse.label}` : '';
      if (!reverse || reverseSignature !== previousSignature) {
        addFinding('medium', 'reverse-focus-order-unexpected', locale, path, viewport.name, { expectedPrevious: previousSignature, actual: reverseSignature });
      }
      await page.keyboard.press('Tab');
    }
    if (repeated >= 2) {
      addFinding('high', 'focus-trap', locale, path, viewport.name, { sequence: visited.slice(-6) });
      break;
    }
    previousSignature = signature;
  }

  const toggle = page.locator('button[aria-expanded][aria-controls]:visible').first();
  if (await toggle.count().catch(() => 0)) {
    await toggle.focus();
    const before = await toggle.getAttribute('aria-expanded');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    const afterEnter = await toggle.getAttribute('aria-expanded');
    if (before === afterEnter) addFinding('high', 'menu-focus-state', locale, path, viewport.name, { message: 'Enter did not update aria-expanded', before, afterEnter });
    if (afterEnter === 'true') {
      const name = safeName(`${locale}__${archetype}__${path}__${viewport.name}__menu-open`);
      await page.screenshot({ path: join(focusDir, `${name}.png`), fullPage: false, animations: 'disabled' });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      const closed = await toggle.getAttribute('aria-expanded');
      const activeIsToggle = await toggle.evaluate((el) => document.activeElement === el).catch(() => false);
      if (closed !== 'false') addFinding('high', 'menu-focus-state', locale, path, viewport.name, { message: 'Escape did not close expanded control', closed });
      if (!activeIsToggle) addFinding('medium', 'menu-focus-return', locale, path, viewport.name, { message: 'Focus did not return to toggle after Escape' });
    }
    await toggle.focus();
    const beforeSpace = await toggle.getAttribute('aria-expanded');
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
    const afterSpace = await toggle.getAttribute('aria-expanded');
    if (beforeSpace === afterSpace) addFinding('medium', 'space-activation-static', locale, path, viewport.name, { beforeSpace, afterSpace });
    if (afterSpace === 'true') await page.keyboard.press('Escape').catch(() => {});
  }

  const tab = page.locator('[role="tab"]:visible').first();
  if (await tab.count().catch(() => 0)) {
    await tab.focus();
    const before = await page.evaluate(() => document.activeElement?.outerHTML?.slice(0, 240) || '');
    await page.keyboard.press('ArrowRight');
    const after = await page.evaluate(() => document.activeElement?.outerHTML?.slice(0, 240) || '');
    if (before === after && await page.locator('[role="tab"]:visible').count() > 1) {
      addFinding('medium', 'tab-arrow-navigation-static', locale, path, viewport.name, {});
    }
  }
}

async function focusedState(page) {
  return page.evaluate(() => {
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
}

async function exerciseSecondaryStates(page, locale, archetype, path, viewport) {
  const stateDir = join(OUT_DIR, 'states');
  await mkdir(stateDir, { recursive: true });
  const search = page.locator('input[type="search"]:visible').first();
  if (await search.count().catch(() => 0)) {
    const original = await search.inputValue().catch(() => '');
    await search.fill('zzzzzz-browser-localization-no-result');
    await page.waitForTimeout(180);
    const name = safeName(`${locale}__${archetype}__${path}__${viewport.name}__search-no-results`);
    await page.screenshot({ path: join(stateDir, `${name}.png`), fullPage: false, animations: 'disabled' });
    const aria = await page.locator('body').ariaSnapshot().catch(() => '');
    await writeFile(join(stateDir, `${name}.aria.yml`), aria, 'utf8');
    if (locale !== canonicalLocale) scanAccessibilityForEnglish(locale, path, viewport.name, aria, { nodes: [] });
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

async function stressLongStrings(page, locale, archetype, path, viewport) {
  const result = await page.evaluate(() => {
    const visible = (el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const candidates = [...document.querySelectorAll('button,a,label,h1,h2,h3,[class*="badge"],[class*="chip"],[class*="tab"],[class*="breadcrumb"],input[placeholder]')]
      .filter(visible)
      .slice(0, 80);
    let mutated = 0;
    for (const el of candidates) {
      if (el instanceof HTMLInputElement) {
        const value = el.placeholder || '';
        if (value.length >= 3 && value.length <= 120) { el.placeholder = `${value} ${value.slice(0, Math.ceil(value.length * 0.4))}`; mutated += 1; }
        continue;
      }
      if (el.children.length) continue;
      const value = (el.textContent || '').trim();
      if (value.length < 3 || value.length > 120) continue;
      el.textContent = `${value} ${value.slice(0, Math.ceil(value.length * 0.4))}`;
      mutated += 1;
    }
    const rootOverflow = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) - innerWidth;
    const clipped = candidates.filter(visible).filter((el) => {
      const style = getComputedStyle(el);
      return (['hidden', 'clip'].includes(style.overflowX) && el.scrollWidth > el.clientWidth + 1)
        || (['hidden', 'clip'].includes(style.overflowY) && el.scrollHeight > el.clientHeight + 1);
    }).slice(0, 20).map((el) => ({ tag: el.tagName.toLowerCase(), text: (el.textContent || el.placeholder || '').trim().slice(0, 180), clientWidth: el.clientWidth, scrollWidth: el.scrollWidth }));
    const outsideInteractive = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')]
      .filter(visible)
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => rect.left < -1 || rect.right > innerWidth + 1)
      .slice(0, 20)
      .map(({ el, rect }) => ({ tag: el.tagName.toLowerCase(), text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 120), left: rect.left, right: rect.right }));
    return { mutated, rootOverflow, clipped, outsideInteractive };
  });
  if (!result.mutated) return;
  if (result.rootOverflow > 1) addFinding('high', 'stress-page-horizontal-overflow', locale, path, viewport.name, { archetype, overflowPx: result.rootOverflow, expansion: 'approximately-40-percent' });
  for (const item of result.outsideInteractive) addFinding('medium', 'stress-interactive-outside-viewport', locale, path, viewport.name, { ...item, expansion: 'approximately-40-percent' });
  for (const item of result.clipped) addFinding('medium', 'stress-clipped-text', locale, path, viewport.name, { ...item, expansion: 'approximately-40-percent' });
  const name = safeName(`${locale}__${archetype}__${path}__${viewport.name}__stress-140`);
  const dir = join(OUT_DIR, 'stress');
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`), fullPage: false, animations: 'disabled' });
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
    },
  };
}

function addFinding(severity, type, locale, path, viewport, details = {}) {
  const signature = JSON.stringify([severity, type, locale, path, viewport, details]);
  if (!addFinding.seen) addFinding.seen = new Set();
  if (addFinding.seen.has(signature)) return;
  addFinding.seen.add(signature);
  report.findings.push({ severity, type, locale, path, viewport, details });
}

function canonicalFor(path) {
  return new URL(path, `${PUBLIC_ORIGIN}/`).href;
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
  for (const finding of value.findings.filter((item) => item.severity === 'critical' || item.severity === 'high').slice(0, 40)) {
    lines.push(`- [${finding.severity}] ${finding.type} ${finding.locale} ${finding.viewport} ${finding.path} ${JSON.stringify(finding.details).slice(0, 260)}`);
  }
  return lines.join('\n');
}

function renderSummaryMarkdown(value) {
  const rows = locales.map((locale) => {
    const c = value.coverage[locale.code];
    return `| ${locale.code} | ${c.publishedPaths} | ${c.selected.length} |`;
  }).join('\n');
  const byType = [...new Map(value.findings.map((item) => [item.type, 0])).keys()]
    .map((type) => [type, value.findings.filter((item) => item.type === type).length])
    .sort((a, b) => b[1] - a[1]);
  const typeRows = byType.map(([type, count]) => `| ${type} | ${count} |`).join('\n') || '| none | 0 |';
  const findings = value.findings.slice(0, 250)
    .map((item) => `- **${item.severity}** \`${item.type}\` — ${item.locale} / ${item.viewport} / \`${item.path}\` — ${escapeMd(JSON.stringify(item.details))}`)
    .join('\n') || '- None.';
  return `# Browser localization audit — ${value.mode}\n\nGenerated: ${value.generatedAt}\n\n## Coverage\n\n| Locale | Published paths scanned | Representative archetypes |\n| --- | ---: | ---: |\n${rows}\n\nViewports: ${viewports.map((item) => `${item.width}×${item.height}`).join(', ')}.\n\nEvidence per representative state: screenshot + post-render DOM + Playwright ARIA snapshot + raw Chromium accessibility tree. Keyboard review runs at 320px and desktop; approximately 40% long-string expansion runs at 320px.\n\n## Findings\n\nCritical: ${value.summary.critical}; high: ${value.summary.high}; medium: ${value.summary.medium}; low: ${value.summary.low}.\n\n| Type | Count |\n| --- | ---: |\n${typeRows}\n\n${findings}\n`;
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

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function escapeMd(value) {
  return String(value).replace(/([*_`])/g, '\\$1');
}
